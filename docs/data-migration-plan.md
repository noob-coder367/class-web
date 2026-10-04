# Supabase data migration and deployment plan

## Current status — do not continue with migration 004 yet

The user reports that migrations **001 and 002 succeeded** and migration **003 failed** with `42804`: `announcement_images.announcement_id` was declared `text` while the already-existing `announcements.id` is `uuid`.

The corrected `003` is now additive and transaction-scoped. **Rerun corrected 003 by itself and wait for success before running 004.** Do not drop, recreate, truncate, or delete the existing `public.announcements`, `public.classroom_store`, homework tables, any other domain tables, or Storage objects.

No SQL was executed against Supabase by this task. The current live state after the earlier failed attempt—including whether `announcement_images`, any index, constraint, or function was committed—cannot be determined from this repository checkout. Use the read-only checks below before rerunning. A failed preflight in corrected 003 aborts its transaction with an explanatory error; it does not try to repair incompatible data by deleting it.

## 1. Existing-schema assumptions and checked-in schema inventory

The production `public.announcements` schema supplied for this repair is:

| Column | Type |
|---|---|
| `id` | `uuid` |
| `title`, `content`, `notify_type`, `section`, `created_by_name`, `hidden_by_name`, `subject_user_name`, `from_level`, `to_level` | `text` |
| `images` | `jsonb` |
| `expires_at`, `created_at`, `hidden_at`, `updated_at` | `timestamptz` |
| `created_by`, `source_homework_id`, `hidden_by`, `subject_user_id` | `uuid` |
| `is_exam_reminder`, `is_system`, `hidden` | `boolean` |

The corrected 003 preserves these types, including all UUID references. It adds absent fields such as `document_kind` and `short_id` using `ADD COLUMN IF NOT EXISTS`, verifies the existing column types, does not `ALTER TYPE`, and does not rewrite existing announcement rows. Defaults affect new rows only; checks on legacy values are added `NOT VALID` so existing values are not silently changed.

The checked-in repository contains SQL for `classroom_store`, AI history, Class Money, Cleaning Duty, Resources, and Push. The homework submission service references `homework_assignments` and `homework_submissions`, and migration 002 was reported successful, but the referenced file `supabase/supabase/homework-submission-schema.sql` is **not present in this checkout**. Thus the actual production homework base-table DDL cannot be independently compared from repository files; verify the live column types with the read-only preflight query below. Runtime homework notice IDs are generated with `randomUUID()` and stored as text; the UUID string is also written to `announcements.source_homework_id`.

## 2. Read-only inspection after the failed 003 attempt

Run these queries in Supabase SQL Editor before rerunning 003. They only inspect catalog metadata and do not modify data.

### Tables and column types

```sql
select table_name, column_name, data_type, udt_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'announcements', 'announcement_images', 'homework_notices',
    'profiles', 'homework_assignments', 'homework_submissions',
    'events', 'class_money_books', 'cleaning_duty_schedule',
    'resources', 'resource_files'
  )
order by table_name, ordinal_position;
```

Confirm at least `announcements.id`, `created_by`, `source_homework_id`, `hidden_by`, and `subject_user_id` are `uuid`; if `announcement_images` exists, inspect its current `announcement_id` and `id` types. Also confirm `profiles.id` and `homework_assignments.id` are `uuid`, and `homework_submissions.assignment_id`/`user_id` are compatible with the referenced assignment/profile IDs.

### Existing constraints and validation status

```sql
select conrelid::regclass as table_name, conname, contype, convalidated,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  to_regclass('public.announcements'),
  to_regclass('public.announcement_images'),
  to_regclass('public.homework_notices')
)
order by table_name, conname;
```

### Existing indexes

```sql
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('announcements', 'announcement_images', 'homework_notices')
order by tablename, indexname;
```

### Announcement-related routines/functions

003 itself does not create an RPC, but check for manually created or earlier-version routines before assuming a clean state:

```sql
select routine_schema, routine_name, routine_type, data_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name ilike '%announcement%'
order by routine_name;
```

If `announcement_images` exists and `announcement_id` is still `text`, inspect its raw values **only after confirming that column's type is text**:

```sql
select id, announcement_id
from public.announcement_images
where announcement_id is null
   or btrim(announcement_id) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
```

Do not delete or manually cast those rows to make the migration pass. Corrected 003 preserves an old text FK column as `announcement_id_legacy_text`, maps only UUID-formatted values to a new UUID column, and aborts if it finds values it cannot safely map or null relationships it cannot preserve. Because the migration is wrapped in a transaction, that error rolls back the attempted repair; review the exact rows and decide a data-preserving mapping before retrying.

## 3. Exact recovery procedure for the previous 003 failure

1. **Stop here. Do not run 004 or any later deployment migration yet.** Do not drop any object. Do not assume the previous 003 attempt left the database clean or fully applied.
2. Run the read-only table/column, constraint, and index queries above. Save the output, especially the current `announcement_images` schema and any existing FK/index definitions. The deployment agent cannot see the live catalog and must not infer partial state from the error alone.
3. Review the raw text IDs if `announcement_images.announcement_id` is `text`. If there are malformed/non-UUID values, stop and preserve them for explicit reconciliation; corrected 003 intentionally raises rather than discarding or guessing their relationships.
4. After preflight, run the complete corrected [`202610040003_announcements_relational.sql`](../supabase/migrations/202610040003_announcements_relational.sql) **as one script**. It begins and commits a transaction. It validates the existing announcements field types, preserves UUIDs, creates/adds missing columns, indexes and safe constraints, converts only valid pre-existing image references while retaining the raw legacy text column, and backfills valid legacy IDs/images. Invalid legacy `classroom_store.announcements` IDs are reported with `NOTICE` and skipped; the original JSON remains in `classroom_store`.
5. If 003 errors, do not continue. Read the raised message, perform read-only inspection, retain the old source values, and resolve only the named incompatibility. The corrected migration does not issue `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or `DELETE FROM`.
6. After 003 succeeds, rerun the column and constraint queries. Confirm `announcements.id` and `announcement_images.announcement_id` are `uuid`, `announcement_id` is `NOT NULL`, and a FK references `public.announcements(id)`. On an existing table the FK may be `NOT VALID` so historical orphan UUIDs remain untouched while new writes are checked. Inspect orphans before optionally validating it:

```sql
select ai.id, ai.announcement_id
from public.announcement_images ai
left join public.announcements a on a.id = ai.announcement_id
where a.id is null;
```

7. Only after corrected 003 completes and checks pass, continue sequentially with 004–009, then 011–014. Run one file at a time and verify success before proceeding.

## 4. Migration order

The sequence remains exactly:

1. `202610040001_relational_auth_state.sql` — ghost reservations/creation quota, username history, transactional RPCs.
2. `202610040002_homework_direct_upload.sql` — upload-intent metadata and homework submission RPCs; requires the existing homework assignment/submission tables.
3. `202610040003_announcements_relational.sql` — corrected UUID-compatible announcements and image metadata migration. **This is the next migration to rerun.**
4. `202610040004_class_space_relational.sql` — room/question/editor/result/attempt and utility-roster tables and RPCs. Existing RPC overloads are retained.
5. `202610040005_timetable_relational.sql` — structured timetable/session/period/break/entry/change-notice tables.
6. `202610040006_rules_relational.sql` — Rules/violation/photo tables and database-side member totals.
7. `202610040007_roster_relational.sql` — roster/member tables and safe named constraints.
8. `202610040008_push_relational.sql` — push subscriptions/preferences.
9. `202610040009_cleaning_direct_upload.sql` — metadata-only Cleaning Duty upload intents.
10. `202610040011_class_money_overview.sql` — Class Money aggregate RPC.
11. `202610040012_announcement_short_id_counter.sql` — atomic announcement short-ID allocator; requires corrected 003.
12. `202610040013_class_money_atomic_payment.sql` — Class Money payment/audit RPC; requires the existing Class Money base schema and 011.
13. `202610040014_homework_notices_relational.sql` — homework notices and UUID-compatible announcement link; requires corrected 003.

`202610040010_presentation_cleanup.sql` remains **separate and optional**. It is not part of the normal sequence, and its destructive Presentation table cleanup remains commented out. Do not delete unrelated Storage objects.

## 5. Static type audit for migrations 001–014

Run the local, read-only developer check before deployment:

```bash
python3 scripts/check-migration-types.py
```

The checker examines the 14 numbered SQL files and checked-in schema SQL for FK source/target type equality, declared PK/unique targets, conflicting `ADD COLUMN` types, and common UUID contracts (`profiles.id`, homework IDs, announcements, and related references). A passing result is a static repository check, **not** proof of current live catalog state. The actual homework base-schema file is absent here, so its UUID contract must also be confirmed by the live read-only query.

The audit found and corrected these type/data-safety issues:

| Migration | ID/FK contract reviewed | Finding and action |
|---|---|---|
| 001 | `ghost_account_creations.user_id` and `username_changes.user_id` are `uuid → profiles.id uuid` | No FK type mismatch found. Malformed non-array legacy JSON collections now skip safely rather than aborting the backfill. |
| 002 | `homework_upload_intents.assignment_id uuid → homework_assignments.id`; `user_id uuid → profiles.id`; file `intent_id uuid → upload intent id uuid` | Declarations are UUID-compatible by migration contract and user reports 002 succeeded. Homework base DDL is not checked into this repository, so verify actual assignment/submission key types before any re-run. |
| 003 | `announcements.id uuid`; account/source references `uuid`; `announcement_images.announcement_id uuid → announcements.id uuid` | **Root cause fixed.** Previous text/UUID mismatch is removed; existing schema is type-checked, no UUID-to-text conversion occurs, and partial image metadata is preserved or rejected explicitly. |
| 004 | Class Space/child IDs are `text → text`; user/member IDs are text values with no incompatible UUID FK | No text/UUID FK mismatch found. Existing RPC overloads are retained rather than dropped. |
| 005 | Timetable and child `timetable_id` values are `uuid → uuid` | No FK type mismatch found. Date backfill casts now use PostgreSQL input validation, including impossible calendar dates. |
| 006 | Rules section/settings and violation/photo keys are `text → text`; user/roster identifiers are non-FK text values | No FK type mismatch found. Integer/date backfill casts now reject overflow/impossible dates safely. |
| 007 | Roster/member identifiers and `roster_id` are `text → text`; profile identity remains in `profiles` | No FK type mismatch found. Removed duplicate inline/named FK/check declarations; named checks remain `NOT VALID` for existing rows. |
| 008 | Push user IDs are `uuid → profiles.id uuid`; subscription IDs are UUID | No static mismatch found; verify `profiles.id` live. |
| 009 | Cleaning upload-intent/file IDs are UUID; uploader is `uuid → profiles.id uuid` | No static mismatch found; verify profile key live. Duty IDs are metadata values, not a cross-table FK in this migration. |
| 010 | Optional cleanup only | No normal deployment DDL; remains separate and destructive lines are commented. |
| 011 | Class Money overview RPC receives `book_id uuid` and joins existing Class Money UUID keys | No FK mismatch; schema columns are checked in the repository's Class Money SQL. Added PostgREST schema reload notification. |
| 012 | Short-ID counter key/document-kind are text and short-ID counter values integer | No UUID FK mismatch; depends on fields/indexes from corrected 003. |
| 013 | Class Money IDs/references are UUID; monetary values use integer/bigint/numeric as declared in base schema | No static FK type mismatch found against checked-in Class Money schema. |
| 014 | `homework_notices.exam_announcement_id uuid → announcements.id uuid` | **Fixed:** previous declaration used text against the UUID announcement key. Existing text reference columns are retained under a legacy name and only safe UUID mappings are copied; new links are set only if the referenced announcement exists. |

The static checker verifies 57 declared FK column pairs in 14 numbered migrations against checked-in declarations/contracts. It does not connect to the database, validate data, execute migrations, or replace the production preflight.

## 6. Existing schema prerequisites and safety notes

- `public.profiles` and Supabase `auth.users` must exist with UUID IDs as expected by the application.
- `homework_assignments.id` and `homework_submissions.assignment_id`/`user_id` must match the UUID contract in migration 002. The checked-in DDL file referenced by older docs is absent from this repository; do not rerun a base schema blindly.
- Preserve `public.classroom_store`, existing relational tables, all buckets, and Storage objects. Legacy values remain available as source/backup after backfill.
- For existing image IDs that cannot be mapped to UUIDs, do not invent random announcement IDs. Corrected 003 skips malformed legacy announcement records with a notice; the legacy JSON stays intact.
- Index creation can fail on pre-existing duplicate values. Such failures should be inspected and reconciled explicitly; do not resolve them by deleting production rows.
- Staging-first execution and a current backup remain recommended. No live Supabase SQL was run by this task.
