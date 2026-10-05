# Data architecture audit

## Scope and result

This is the post-refactor code audit for `noob-coder367/class-web`, based on the repository HEAD present at task start. The refactor keeps `public.classroom_store` and its legacy Storage backup intact, but removes business-service reads/writes through `classroomDbStore`; new relational tables become canonical after the user applies the SQL in [`data-migration-plan.md`](data-migration-plan.md).

**No SQL was executed by this task.** The user reports that 001 and 002 succeeded and 003 failed because its `announcement_images.announcement_id` was `text` while the existing `announcements.id` is `uuid`. Migration 003 is corrected to preserve the existing UUID schema; whether the failed attempt left objects behind must be confirmed with the read-only catalog checks in [`data-migration-plan.md`](data-migration-plan.md). No production rows or Storage objects were deleted by this task. Presentation cleanup is separate and optional.

## Persistence inventory

| Domain | Canonical runtime path after SQL is applied | Legacy source/backfill | Read bounds / concurrency | File storage |
|---|---|---|---|---|
| Ghost accounts | `ghost_account_sequence`, `ghost_account_reservations`, `ghost_account_creations`, transactional RPCs | `classroom_store` key `ghost-state` | Atomic reservation/finalize/release/rollback; max two successful creations/day; 30-minute reservation expiry | None |
| Username history | `username_changes` and `change_display_name` RPC | `classroom_store` key `username-changes` | Weekly limit and profile update in one transaction; history retained | None |
| Announcements | `announcements` repository + `announcement_images` metadata | `classroom_store` key `announcements` | Filtered/orderable paged queries; page size capped at 100; short-ID allocator RPC | `announcement-images`, signed upload; database stores path/URL/MIME/size |
| Timetable | `timetables`, sessions, periods, breaks, entries, change notices | `classroom_store` key `timetable` | Structured rows; deterministic ordering; bounded child-table reads | None |
| Rules | `rules_settings`, `rule_sections`, `rule_items` | `classroom_store` key `rules` | Normalized settings and ordered child rows | None |
| Violations | `rule_violations`, `rule_violation_photos` | `classroom_store` key `violations` | Filter by date/member, ordered pages (max 100), DB-side member totals | `classroom-data` bucket; evidence uploads use signed URLs and relational metadata |
| Homework notices | `homework_notices` | `classroom_store` key `homework` | Newest-first page queries, max 100; existing internal consumers keep array DTOs | No notice binary |
| Class Space | `class_spaces`, questions, editors, results, attempts | `classroom_store` key `class-space` | Room-scoped reads; paged room/leaderboard reads; atomic configuration/result RPCs | Existing `class-space-images` bucket; signed upload |
| Utility roster | `utility_rosters`, `utility_roster_members` | `classroom_store` key `utility-roster` | Structured member rows and ordered reads | No PDF binary is stored in the relational table; the legacy bucket remains unchanged |
| Class roster | `class_rosters`, `class_roster_members`; profile matching remains against `profiles` | `classroom_store` key `class-roster` | Normalized roster mapping and placeholder identities | None |
| Push | `push_subscriptions`, `push_preferences` | `classroom_store` key `push-subscriptions` | Explicit columns and 100-row range pages; no endpoint returns raw subscription credentials | None |
| AI history/quota | Existing `ai_conversations`, `ai_messages`, `ai_daily_usage` | Already relational | Conversation/message pages capped at 100; atomic daily quota upsert/RPC | None |
| Cleaning Duty | Existing normalized schedule/status/reviews/photo metadata | Already relational | Bounded schedule/review/photo listing; direct per-image upload intents | Existing `classroom-data` bucket |
| Class Money | Existing relational books, collections, members, expenses, transactions, audit logs | Already relational | Paged lists; atomic payment update/audit RPC; aggregate totals in SQL | Existing `class-money-photos`; direct signed upload |
| Events | Existing `events` table | Already relational | Newest-first page (max 100) | Existing public `event-images`; signed uploads |
| Resources | Existing `resources`, categories, files through repository | Already relational | Repository queries page at max 100; count queries; explicit selected fields | Existing private `classroom-resources`; direct signed upload for large files |
| Homework submissions | Existing relational assignments/submissions plus upload-intent metadata | Already relational | Assignment summary RPC and paged lists; per-user/time-limited intent; atomic submission commit | Existing `classroom-data`; binary upload direct from client, up to 10 files × 20 MB |
| GitHub site images | GitHub repository manifest/API | Not a classroom-store domain | Single-image operation has an explicit size limit; backend needs image bytes to call GitHub API | Existing configured GitHub image destination; no new bucket |

## Legacy-store scan

Runtime imports/usages of `classroomDbStore`, `readStore`, `writeStore`, `updateStore`, `loadAll`, and `mutateStore` are now isolated to `backend/src/utils/classroomDbStore.js` itself. It remains the compatibility/backup adapter; the feature services no longer use it as their canonical path.

Migration SQL reads the legacy JSON values using the keys documented above and uses conflict-safe inserts. It does not delete or update `classroom_store` source rows. Corrected 003 also has explicit handling for a pre-existing `announcement_images` table: valid text UUID references can be copied into a UUID FK column while their original strings are retained in a legacy column; unconvertible relationships raise an error instead of being deleted or guessed. The classroom data bucket and Storage objects are retained.

## Upload/RAM scan

- Homework submissions: manifest + metadata intent; each file goes directly to the existing `classroom-data` bucket with a signed upload URL. Backend verifies object names/sizes and commits submission metadata using an RPC.
- Cleaning Duty, Resources, announcements, events, Rules evidence, Class Money receipts, and Class Space images: signed upload URL to each existing bucket, then a small authenticated metadata request.
- Global `express.json` remains bounded at 15 MB; it was not raised to accommodate binary uploads.
- Remaining Base64/FileReader usage is limited to browser-local previews/IndexedDB conversion or the GitHub-image integration, whose server must send image bytes to GitHub. PPTX MIME-type mentions are legitimate file-type support, not the removed Presentation feature. HTML `role="presentation"` is an accessibility value, not a feature reference.

## Presentation and AI

- Presentation feature pages, components, services, routes, backend handlers, imports, and navigation code were removed. `supabase/migrations/202610040010_presentation_cleanup.sql` is a separate manual/optional inspection script; its `DROP TABLE` lines are commented and no Storage paths are deleted.
- AI service, routes, conversation tables, and quota tables are preserved. AI navigation/shortcut entries are hidden/removed; direct AI route/backend capability remains.
- Resource Management remains at the outer navigation level and still uses the existing route, repository, storage, and `resourceManagement` authorization.

## Limitations and deployment risks

1. Migrations were deliberately not executed against Supabase. This sandbox has no local PostgreSQL server binaries, so PostgreSQL integration/rerun tests were unavailable; SQL grammar parsing and the static FK/type checker were run instead. The failed-003 production catalog state and external base-table schemas still require the read-only live checks in the migration plan before execution.
2. A few relational service writes remain multiple requests rather than one transaction (notably timetable/rules replacement); SQL constraints and conflict checks reduce risk, but a database failure mid-sequence can leave a partial write until retried.
3. Class-roster migration creates a unique folded-name index. If a manually created `class_roster_members` table already contains duplicate folded names, inspect and reconcile those rows before that migration.
4. Direct signed-upload objects can become orphaned if a user abandons the form after uploading but before committing metadata. They are not automatically swept by this refactor; do not run broad Storage deletion as cleanup.
5. The frontend build reports a bundle-size advisory for the existing PDF worker/application bundle; build succeeds.

## Related files

- Ordered/manual SQL instructions and validation: [`docs/data-migration-plan.md`](data-migration-plan.md)
- SQL migrations: `supabase/migrations/202610040001_*.sql` through `202610040014_*.sql`
- Presentation cleanup inspection: `supabase/migrations/202610040010_presentation_cleanup.sql`
