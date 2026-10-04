# Classroom store concurrency fix report

## Root causes and risks found

- `updateStore` previously did read → mutate → unconditional write, so concurrent Render instances could overwrite one another.
- `writeStore` accepted `expectedVersion`, but the old `updateStore` never passed it and insert-conflict handling recursively retried without a bound.
- Auth normalized malformed `ghost-state` and `username-changes` into empty/default values, which could reset quota/history after a persistence or data-format problem.
- Ghost registration wrote a state seed before creating the account and then wrote the final state separately; failures could leave state/account inconsistent.
- Error responses could expose raw Supabase messages from auth/profile paths.
- The existing server client correctly uses `supabaseAdmin` with the service-role key; no second server client was added.

## Files changed

- `backend/src/utils/classroomDbStore.js`
- `backend/src/services/auth.service.js`
- `backend/src/middlewares/error.middleware.js`
- `backend/package.json`
- `backend/test/classroomDbStore.test.js`
- `docs/classroom-store-concurrency-fix.md`

## Concurrency strategy

1. `classroomDbStore` reads `{ value, version, updated_at }`.
2. Mutations update with both `key` and the observed `version`.
3. Successful writes increment the version by one.
4. A zero-row update is a typed `VERSION_CONFLICT` (HTTP 409), never a silent overwrite.
5. `updateStore` retries only version conflicts, up to three retries by default (maximum configurable cap: eight).
6. Database, permission/RLS, missing-table, and connection failures are classified and surfaced as safe 503 errors.
7. Legacy file absence is still a valid first-run empty-store case; Storage/JSON parse/read failures are not converted to empty data.

### Ghost accounts

- `ghost-state` now supports `reserved` entries.
- The index and daily slot are reserved through an atomic versioned mutation.
- The account/profile is created only after reservation succeeds.
- The reservation is finalized into `created` only after account and profile persistence succeeds.
- If account/profile/final-state persistence fails, the account/profile is cleaned up and the reservation is released on a best-effort versioned mutation.
- Daily limit calculation counts both `created` and active `reserved` entries, preventing concurrent requests from exceeding two per Vietnam day.
- Existing states without `reserved` remain backward-compatible and are normalized to an empty array without hiding database errors.

### Username history

- History entries are appended through `updateStore`, so concurrent changes retry against the latest version instead of overwriting each other.
- The weekly limit is checked inside the atomic mutator, not only in a preceding read.
- If the profile update fails after reserving a history entry, that entry is removed through another versioned mutation; rollback failure is logged and the request still fails.
- Malformed history data and persistence failures return errors instead of resetting to `{}`.

## Tests and checks

- `backend npm test`: **10 passed** using Node's built-in `node:test`; no new dependency.
- Covered: successful ghost read, DB read failure, successful versioned write, version conflict, concurrent mutation retry, concurrent username history, backend restart persistence, ghost reservation failure/success semantics, and weekly username quota.
- `node --check` for all backend source/test modules: **pass**.
- `git diff --check`: **pass**.
- Frontend lint: **0 warnings, 0 errors**.
- Frontend production build: **pass**.

The tests use an in-memory fake Supabase adapter and never connect to production.

## SQL

No SQL migration is required for this fix. The existing `classroom_store` table's `version` column and key uniqueness are used. No SQL was executed, and no production data, bucket, or table was deleted/reset.

## Remaining migration work

The following features still intentionally use the compatibility store and should be migrated later with domain-specific tables/transactions: announcements, timetable, rules/violations, homework notices, presentations, class-space, roster, utility roster, ghost state, and username history. This task only hardens the compatibility boundary and the two auth-related mutation flows; it does not rewrite those features.
