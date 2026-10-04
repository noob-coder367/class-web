# Data architecture audit

## Scope

Audit performed before the datastore refactor. No production SQL was executed and no existing `classroom_store` table, data, schema, or legacy migration was removed.

## Current architecture

| Feature | Data source hiện tại | File/service xử lý | Có dùng `classroom_store`? | Cần migrate sau này? | Rủi ro hiện tại |
|---|---|---|---:|---:|---|
| Announcements | `classroom_store` key `announcements`; announcement images in Supabase Storage | `announcements.service.js` | Có | Có | Read-modify-write toàn JSON; memory cache; concurrent writes cần DB transaction |
| Timetable | `classroom_store` key `timetable` | `timetable.service.js` | Có | Có | JSON key nhỏ hiện tại, nhưng không query/filter được |
| Rules / violations | `classroom_store` keys `rules`, `violations`; violation photos in Storage | `rules.service.js` | Có | Có | Violations tăng dần; toàn bộ danh sách được parse khi đọc |
| Homework notices | `classroom_store` key `homework` | `homework.service.js` | Có | Có | Toàn bộ bài tập được đọc/ghi mỗi mutation |
| Class Space | `classroom_store` key `class-space`; room cover images in Storage | `classSpace.service.js` | Có | Có | Danh sách phòng và questions nằm trong một JSON lớn |
| Utility PDF roster | `classroom_store` key `utility-roster` | `classSpace.service.js` | Có | Có | Danh sách tên nằm trong JSON; file PDF không lưu trong DB |
| Class roster | `classroom_store` key `class-roster`; profile/class-list relational data cũng được đọc trực tiếp | `classRoster.service.js`, `admin.service.js` | Có | Có | Hai nguồn dữ liệu cần thống nhất trước khi migrate |
| Ghost account / username history | keys `ghost-state`, `username-changes` | `auth.service.js` | Có | Có | Counters/history JSON có race risk khi scale nhiều backend instances |
| Presentations | key `presentations`; slide data trong JSONB | `presentation.service.js` | Có | Có | Slide payload có thể lớn; toàn bộ presentation list read-modify-write |
| Push subscriptions | PostgreSQL `push_subscriptions`; fallback hiện báo migration thiếu bảng | `push.service.js` | Không dùng thực tế | Không, sau khi SQL đã chạy | Fallback hiện không phải persistence path thật |
| AI history/quota | PostgreSQL `ai_conversations`, `ai_messages`, `ai_daily_usage`, RPC quota functions | `ai-history.service.js` | Không | Không | Relational path đã có index; cần giới hạn page size ở các endpoint nếu tăng lớn |
| Resources | PostgreSQL `resources`, `resource_categories`, `resource_files`; files in private Storage bucket | `repositories/resources.repository.js`, `resource.service.js` | Không | Không | Trước refactor list/count queries có thể load toàn bộ resources/files |
| Cleaning duty | PostgreSQL schedule/status/reviews/photos metadata; media in Storage | `cleaningDuty.service.js` | Không | Không | Photo listing/signed URL work should remain page-bounded as volume grows |
| Class Money | PostgreSQL relational tables; receipt photos in Storage | `classMoney.service.js` | Không | Không | Most transaction/audit endpoints already use range pagination |
| Events | PostgreSQL `events`; images in Storage | `events.service.js` | Không | Không | Verify list endpoint pagination as event history grows |
| Homework submissions | PostgreSQL assignment/submission metadata; attachments in Storage | `homeworkSubmission.service.js` | Không | Không | Base64 JSON submission path can create RAM spikes for large payloads |
| GitHub images | GitHub API/repository manifest and image files | `githubImages.service.js` | Không | Không | External API/storage dependency; not a classroom database concern |

## Exact `classroom_store` compatibility keys

- `announcements`
- `timetable`
- `homework`
- `rules`
- `violations`
- `class-space`
- `utility-roster`
- `class-roster`
- `presentations`
- `username-changes`
- `ghost-state`

The compatibility path remains `backend/src/utils/classroomDbStore.js`, which first reads PostgreSQL `classroom_store` and lazily imports the legacy `classroom-data/*.json` object when a key is missing. Legacy Storage files are retained.

## Changes in this refactor

- Added `backend/src/repositories/base.repository.js`.
  - Centralizes server-side Supabase/PostgreSQL repository operations.
  - Adds contextual database logging (`table`, `operation`, database code/details/hint).
  - Supports field selection, filtering, sorting, bounded page size, total count, and `hasMore`.
  - Converts database failures into a typed 503 repository error instead of silently returning an empty result.
- Added `backend/src/repositories/resources.repository.js`.
  - Moves Resources relational metadata queries and mutations out of `resource.service.js`.
  - Resource listing is bounded by `page`/`pageSize` (`pageSize` capped at 100; default 50).
  - Category counts use count queries rather than loading all resource rows into Node memory.
  - Storage upload/delete behavior remains in the service layer.
- Updated `resource.service.js` to use the repository for resource/category/file metadata while preserving current response shapes and routes.
- Marked `classroomDbStore.js` explicitly as a legacy compatibility adapter.

## Storage architecture observed

- `classroom-data`: legacy JSON backup/compatibility bucket; should remain private.
- `classroom-resources`: private resource file bucket; DB stores metadata and `file_path`.
- Cleaning media, class-space covers, announcement/rules images, and class-money photos use domain paths in Storage with metadata or JSON references.
- The backend uses one server-side `supabaseAdmin` client configured from environment variables. The service-role key is not imported by frontend code.

## SQL migrations

**MIGRATION REQUIRED: No new migration is required for this refactor.** The repository foundation uses existing tables and the already-present `resource-management-schema.sql`.

Do not run SQL automatically. Existing SQL files remain user-reviewed/manual operations:

- `supabase/classroom-store-schema.sql` — compatibility store, if not already installed.
- `supabase/resource-management-schema.sql` — Resources tables and private bucket, if not already installed.
- `supabase/cleaning-duty-schema.sql` and `supabase/cleaning-duty-media-schema.sql` — cleaning data/media.
- `supabase/class-money-schema.sql` and patch files — class money.
- `supabase/ai-chat-history.sql` — AI history and quota.
- `supabase/push-subscriptions.sql` — push subscription persistence.

## Recommended migration order

1. Announcements and homework notices: split list metadata/content into relational tables with indexes and cursor pagination.
2. Rules violations and cleaning schedule/status: relationalize history and add date/status indexes.
3. Class Space: separate rooms, questions, attempts, and results; keep cover images in Storage.
4. Presentations: separate presentation/slides/elements only after defining payload size limits and versioning.
5. Class roster, ghost state, and username history: move counters/history to transactional tables or RPCs.
6. Timetable: migrate last because its current payload is small and stable.

## Remaining risks / follow-up

- Existing legacy services still intentionally read-modify-write complete JSON values through `classroom_store`; this task does not migrate business data wholesale.
- `classroomDbStore.updateStore` is not a cross-instance transaction. Future migrations should use SQL transactions/RPCs or optimistic version checks consistently.
- Cleaning photos and homework submissions still accept base64 JSON paths with large Express limits; a future upload migration should use direct/multipart Storage upload and metadata-first persistence.
- Resource search filtering currently happens after the bounded repository page is fetched. For large resource catalogs, move search into Postgres (`ilike`/full-text index) before pagination.
- Existing controllers intentionally keep their current response formats; pagination metadata should be added in a backward-compatible field when each frontend consumer is ready.
