# Supabase data migration and deployment plan

## Important: migrations were not executed

The code changes are complete, but **no SQL was run**. Review and run SQL yourself in Supabase. Do the sequence on staging first, compare counts, then repeat in production during a maintenance window. Back up the project and preserve the existing `classroom_store` and Storage data.

The migrations use `IF NOT EXISTS` / `CREATE OR REPLACE` and conflict-safe backfills where applicable. They do not delete/update legacy source rows. No Storage objects are copied or deleted. Presentation cleanup is separate and optional.

## 1. Preflight and existing schema prerequisites

Confirm these existing schemas/tables are present. **Do not blindly re-run a legacy schema file** against a project that already has its objects. If a whole prerequisite domain is absent, run the indicated file(s) before the numbered migrations.

| Prerequisite | Run only if missing | Needed before |
|---|---|---|
| Compatibility store | `supabase/classroom-store-schema.sql` | `001`, `003`–`008`, `014` backfills |
| AI history/quota tables and RPCs | `supabase/ai-chat-history.sql` | AI history/quota runtime |
| Resources/categories/files and private bucket | `supabase/resource-management-schema.sql` | Resources runtime (no numbered migration) |
| Cleaning schedule/status/reviews and media schema | `supabase/cleaning-duty-schema.sql`, then `supabase/cleaning-duty-media-schema.sql` | `009` |
| Class Money core and roster | `supabase/class-money-schema.sql`, then `supabase/class-money-roster-patch.sql` | `011`, `013` |
| Homework assignments/submissions | `supabase/supabase/homework-submission-schema.sql` | `002` |
| Push subscriptions (only if the table is absent) | `supabase/push-subscriptions.sql` | `008` |

The base app must already have `public.profiles` and Supabase `auth.users`. If `classroom_store` does not exist, install its schema before backfills. If a source store/key is absent, the SQL emits a notice or skips that source; install/restore the store and rerun the relevant migration before deploying the new code.

Keep `classroom-data` and all existing buckets. No feature-specific bucket is added by these migrations.

## 2. Numbered migration files — exact order

Run each file as a whole script in Supabase SQL Editor. Wait for success before continuing. The deployment sequence is `001`–`009`, then `011`–`014`; `010` is intentionally excluded (see Presentation cleanup below).

1. [`202610040001_relational_auth_state.sql`](../supabase/migrations/202610040001_relational_auth_state.sql) — creates ghost sequence/reservation/creation tables and username history; backfills `ghost-state` and `username-changes`; adds atomic quota/profile-update RPCs, RLS and service-role grants.
2. [`202610040002_homework_direct_upload.sql`](../supabase/migrations/202610040002_homework_direct_upload.sql) — creates direct-upload intent metadata, bounded assignment-summary RPC, and atomic submission-commit RPC. Requires existing homework assignment/submission tables.
3. [`202610040003_announcements_relational.sql`](../supabase/migrations/202610040003_announcements_relational.sql) — creates relational announcements/image metadata with constraints/indexes/RLS and backfills `classroom_store` key `announcements` without changing the source.
4. [`202610040004_class_space_relational.sql`](../supabase/migrations/202610040004_class_space_relational.sql) — creates class-space/question/editor/result/attempt and utility-roster/member tables; backfills `class-space` and `utility-roster`; installs room/roster/result RPCs.
5. [`202610040005_timetable_relational.sql`](../supabase/migrations/202610040005_timetable_relational.sql) — creates structured timetable/session/period/break/entry/change-notice tables and backfills `timetable`.
6. [`202610040006_rules_relational.sql`](../supabase/migrations/202610040006_rules_relational.sql) — creates Rules settings/sections/items, violations, photo metadata and ranking tables; backfills `rules` and `violations`; adds DB-side member totals.
7. [`202610040007_roster_relational.sql`](../supabase/migrations/202610040007_roster_relational.sql) — creates canonical `class_rosters`/`class_roster_members` mappings and backfills `class-roster`; account identity remains in `profiles`.
8. [`202610040008_push_relational.sql`](../supabase/migrations/202610040008_push_relational.sql) — creates/ensures relational push subscriptions/preferences and backfills `push-subscriptions`.
9. [`202610040009_cleaning_direct_upload.sql`](../supabase/migrations/202610040009_cleaning_direct_upload.sql) — creates short-lived metadata-only Cleaning Duty upload intents; binary files remain in the existing bucket.
10. [`202610040011_class_money_overview.sql`](../supabase/migrations/202610040011_class_money_overview.sql) — installs server-side Class Money overview aggregation RPC.
11. [`202610040012_announcement_short_id_counter.sql`](../supabase/migrations/202610040012_announcement_short_id_counter.sql) — installs atomic announcement short-ID counters/RPC; requires `003`.
12. [`202610040013_class_money_atomic_payment.sql`](../supabase/migrations/202610040013_class_money_atomic_payment.sql) — installs the transactional payment/ledger/audit RPC; requires existing Class Money tables and `011`.
13. [`202610040014_homework_notices_relational.sql`](../supabase/migrations/202610040014_homework_notices_relational.sql) — creates `homework_notices` and backfills `classroom_store` key `homework`; requires `003` for announcement-ID validation.

The updated [`supabase/ai-chat-history.sql`](../supabase/ai-chat-history.sql) has idempotent table/index/RLS declarations and `CREATE OR REPLACE` quota RPCs. If AI history is already installed, review and apply it to install the atomic first-use quota fix. It preserves all AI tables/data; do not drop or recreate them.

### Presentation cleanup (not part of the deploy sequence)

[`202610040010_presentation_cleanup.sql`](../supabase/migrations/202610040010_presentation_cleanup.sql) is a **separate, optional manual review script**. Its initial `to_regclass` query only checks whether exact legacy tables exist. `DROP TABLE` lines are commented and must remain disabled unless data has been backed up and removal has been explicitly approved. It never touches Storage. Review any known legacy Presentation-specific bucket/path manually; do not perform broad or guessed object deletion.

## 3. Backfill map

| Legacy source | Destination | Migration |
|---|---|---|
| `classroom_store` key `ghost-state` | `ghost_account_creations`, `ghost_account_reservations`, `ghost_account_sequence` | `001` |
| `classroom_store` key `username-changes` | `username_changes` | `001` |
| `classroom_store` key `announcements` | `announcements`, `announcement_images` | `003` |
| `classroom_store` keys `class-space`, `utility-roster` | `class_spaces`, questions/editors/results/attempts, `utility_rosters`, `utility_roster_members` | `004` |
| `classroom_store` key `timetable` | timetable root/child/notice tables | `005` |
| `classroom_store` keys `rules`, `violations` | Rules relational tables and `rule_violations`/photo metadata | `006` |
| `classroom_store` key `class-roster` | `class_rosters`, `class_roster_members` | `007` |
| `classroom_store` key `push-subscriptions` | `push_subscriptions`, `push_preferences` | `008` |
| `classroom_store` key `homework` | `homework_notices` | `014` |

Backfills retain source keys and do not move/delete Storage objects. Existing URLs/paths are retained or mapped as relational metadata.

## 4. Post-migration validation (read-only)

Run after the migration sequence. Compare destination counts with each populated legacy value using the source JSON paths used by its migration. Check migration `NOTICE` messages for malformed/skipped records before deployment.

### Required objects and RLS

```sql
select to_regclass('public.classroom_store') as legacy_store,
       to_regclass('public.announcements') as announcements,
       to_regclass('public.announcement_images') as announcement_images,
       to_regclass('public.timetables') as timetables,
       to_regclass('public.rule_violations') as violations,
       to_regclass('public.homework_notices') as homework_notices,
       to_regclass('public.class_spaces') as class_spaces,
       to_regclass('public.class_rosters') as class_rosters,
       to_regclass('public.ghost_account_creations') as ghost_creations,
       to_regclass('public.username_changes') as username_changes,
       to_regclass('public.push_subscriptions') as push_subscriptions;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('announcements','announcement_images','homework_notices',
    'class_spaces','class_space_questions','rule_violations','rule_violation_photos',
    'class_rosters','class_roster_members','ghost_account_creations','username_changes',
    'homework_upload_intents','cleaning_duty_upload_intents')
order by tablename;
```

### Destination row counts and quota invariants

```sql
select 'announcements' as table_name, count(*) from public.announcements
union all select 'announcement_images', count(*) from public.announcement_images
union all select 'homework_notices', count(*) from public.homework_notices
union all select 'class_spaces', count(*) from public.class_spaces
union all select 'class_space_questions', count(*) from public.class_space_questions
union all select 'rule_violations', count(*) from public.rule_violations
union all select 'class_rosters', count(*) from public.class_rosters
union all select 'class_roster_members', count(*) from public.class_roster_members
union all select 'ghost_account_creations', count(*) from public.ghost_account_creations
union all select 'ghost_account_reservations', count(*) from public.ghost_account_reservations
union all select 'username_changes', count(*) from public.username_changes
union all select 'push_subscriptions', count(*) from public.push_subscriptions;

-- No day should have more than two successful ghost creations.
select created_day, count(*) as successful_creations
from public.ghost_account_creations where status = 'created'
group by created_day having count(*) > 2;

-- These duplicate checks should return no rows.
select user_id, changed_at, count(*) from public.username_changes
 group by user_id, changed_at having count(*) > 1;
select roster_id, lower(regexp_replace(trim(display_name), '\s+', ' ', 'g')) as folded_name, count(*)
from public.class_roster_members group by roster_id, folded_name having count(*) > 1;
```

### Inspect source key counts and compare

```sql
select key, jsonb_typeof(value) as value_type,
       case when jsonb_typeof(value->'items') = 'array'
            then jsonb_array_length(value->'items') end as items_count,
       case when jsonb_typeof(value) = 'array'
            then jsonb_array_length(value) end as root_array_count
from public.classroom_store
where key in ('ghost-state','username-changes','announcements','class-space',
  'utility-roster','timetable','rules','violations','class-roster',
  'push-subscriptions','homework')
order by key;
```

The legacy values have different object/array shapes, so compare each count to the explicit extraction/backfill in the corresponding migration rather than assuming every key is an `items` array. Destination counts are in the preceding query. Both source and destination rows remain available for reconciliation.

### Constraints, duplicate protection and RPC presence

```sql
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'f' and connamespace = 'public'::regnamespace
  and conrelid::regclass::text in ('announcement_images','class_space_questions',
    'class_space_results','class_space_attempts','utility_roster_members',
    'rule_violation_photos','class_roster_members','homework_upload_intent_files')
order by 1,2;

select endpoint, count(*) from public.push_subscriptions group by endpoint having count(*) > 1;
select document_kind, short_id, count(*) from public.announcements
 where short_id is not null group by document_kind, short_id having count(*) > 1;

select to_regprocedure('public.ghost_reserve_account()'),
       to_regprocedure('public.change_display_name(uuid,text,boolean)'),
       to_regprocedure('public.allocate_announcement_short_id(text)'),
       to_regprocedure('public.class_money_update_member_payment(uuid,timestamp with time zone,bigint,text,uuid)'),
       to_regprocedure('public.homework_commit_submission(uuid,uuid,text,date)');
```

For API smoke tests, request `page=1&pageSize=100` and `page=2&pageSize=100`; verify max 100, stable ordering, and `pagination.hasMore`. Do not compare data by issuing an unbounded list request.

## 5. Deployment order

1. Back up Supabase and record legacy row counts plus bucket visibility/settings.
2. Check prerequisites; run only genuinely missing baseline schemas.
3. Run numbered migrations in order, skipping optional `010`.
4. Run the read-only checks; resolve `NOTICE` messages, missing RPCs, duplicate/index blockers, or count discrepancies.
5. Review/apply `supabase/ai-chat-history.sql` if needed, then deploy/restart backend and frontend together.
6. Smoke-test registration/ghost quota, username-change quota, announcements/images, timetable, Rules/evidence, homework notices/submissions, Class Space/cover, roster, Resources/large files, Events/images, Cleaning Duty/photos, Class Money receipts/payments, AI history/quota, and push.
7. Preserve `classroom_store` and legacy Storage through an observation period. Do not drop the adapter, source table, bucket, or source JSON as part of this task.

Binary request payloads were replaced for announcements, Events, Rules evidence, Class Space images, Class Money photos, and Resources; the frontend and backend were changed together. Clients now request signed URLs, upload Blobs directly to existing Storage buckets, then submit small metadata. Homework submissions and Cleaning Duty use expiring database upload intents. Existing public DTO/list array fields are retained; paged endpoints include pagination metadata.

## 6. Rollback

- **Before deployment:** if a migration fails, stop and retain the error/notice. Repair a documented constraint/data conflict and rerun; do not drop partially created tables without reviewing their rows.
- **Code rollback:** deploy the previous version only if it is compatible with the active schema. Old code reads `classroom_store`, but writes after cutover live in relational tables; pause writes and export/reconcile post-cutover changes before rollback to avoid invisibility/data loss.
- **Database rollback:** no automatic `DROP` rollback is supplied. Do not truncate/drop relational data. Use the project's reviewed backup-restore process only if a full restore is required.
- **Storage rollback:** do not remove Storage files automatically. Abandoned signed uploads can leave orphaned objects; identify exact paths and review metadata before manual cleanup.
- **Presentation:** no Presentation data cleanup is part of deployment/rollback. `202610040010_presentation_cleanup.sql` is optional, inspection-first, and destructive statements remain commented.
