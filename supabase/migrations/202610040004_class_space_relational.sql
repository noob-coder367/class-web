-- Relational class-space storage.
-- The legacy classroom_store rows are immutable migration sources: this migration
-- only reads class-space and utility-roster keys and never updates/deletes them.

create table if not exists public.class_spaces (
  id text primary key check (char_length(trim(id)) between 1 and 200),
  code text not null default '',
  question_count integer not null default 0 check (question_count >= 0),
  title text not null default 'Lớp học',
  cover text not null default '',
  backdrop_type text not null default '' check (backdrop_type in ('', 'theme', 'image')),
  backdrop_theme text not null default '',
  backdrop_image text not null default '',
  is_public boolean not null default true,
  visible_in_class boolean not null default true,
  password_hash text not null default '',
  password text not null default '',
  shuffle boolean not null default false,
  allow_retry boolean not null default true,
  allow_multi_try boolean not null default false,
  auto_advance_multi_try boolean not null default false,
  show_essay_hints boolean not null default true,
  enable_leaderboard boolean not null default false,
  owner_id text not null default '',
  owner_name text not null default 'Ẩn danh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Make a hand-created/partially-created installation converge to this shape.
alter table public.class_spaces add column if not exists code text;
alter table public.class_spaces add column if not exists question_count integer;
alter table public.class_spaces add column if not exists title text;
alter table public.class_spaces add column if not exists cover text;
alter table public.class_spaces add column if not exists backdrop_type text;
alter table public.class_spaces add column if not exists backdrop_theme text;
alter table public.class_spaces add column if not exists backdrop_image text;
alter table public.class_spaces add column if not exists is_public boolean;
alter table public.class_spaces add column if not exists visible_in_class boolean;
alter table public.class_spaces add column if not exists password_hash text;
alter table public.class_spaces add column if not exists password text;
alter table public.class_spaces add column if not exists shuffle boolean;
alter table public.class_spaces add column if not exists allow_retry boolean;
alter table public.class_spaces add column if not exists allow_multi_try boolean;
alter table public.class_spaces add column if not exists auto_advance_multi_try boolean;
alter table public.class_spaces add column if not exists show_essay_hints boolean;
alter table public.class_spaces add column if not exists enable_leaderboard boolean;
alter table public.class_spaces add column if not exists owner_id text;
alter table public.class_spaces add column if not exists owner_name text;
alter table public.class_spaces add column if not exists created_at timestamptz;
alter table public.class_spaces add column if not exists updated_at timestamptz;

update public.class_spaces set code = '' where code is null;
update public.class_spaces set question_count = 0 where question_count is null or question_count < 0;
update public.class_spaces set title = 'Lớp học' where title is null or btrim(title) = '';
update public.class_spaces set cover = '' where cover is null;
update public.class_spaces set backdrop_type = '' where backdrop_type is null or backdrop_type not in ('', 'theme', 'image');
update public.class_spaces set backdrop_theme = '' where backdrop_theme is null;
update public.class_spaces set backdrop_image = '' where backdrop_image is null;
update public.class_spaces set is_public = true where is_public is null;
update public.class_spaces set visible_in_class = true where visible_in_class is null;
update public.class_spaces set password_hash = '' where password_hash is null;
update public.class_spaces set password = '' where password is null;
update public.class_spaces set shuffle = false where shuffle is null;
update public.class_spaces set allow_retry = true where allow_retry is null;
update public.class_spaces set allow_multi_try = false where allow_multi_try is null;
update public.class_spaces set auto_advance_multi_try = false where auto_advance_multi_try is null;
update public.class_spaces set show_essay_hints = true where show_essay_hints is null;
update public.class_spaces set enable_leaderboard = false where enable_leaderboard is null;
update public.class_spaces set owner_id = '' where owner_id is null;
update public.class_spaces set owner_name = 'Ẩn danh' where owner_name is null or btrim(owner_name) = '';
update public.class_spaces set created_at = now() where created_at is null;
update public.class_spaces set updated_at = created_at where updated_at is null;
update public.class_spaces set code = '' where code !~ '^[0-9]{6}$';
with duplicate_codes as (
  select ctid, row_number() over (partition by code order by id) as duplicate_number
  from public.class_spaces
  where code <> ''
)
update public.class_spaces cs
set code = ''
from duplicate_codes dup
where cs.ctid = dup.ctid and dup.duplicate_number > 1;

alter table public.class_spaces alter column code set default '';
alter table public.class_spaces alter column code set not null;
alter table public.class_spaces alter column question_count set default 0;
alter table public.class_spaces alter column question_count set not null;
alter table public.class_spaces alter column title set default 'Lớp học';
alter table public.class_spaces alter column title set not null;
alter table public.class_spaces alter column cover set default '';
alter table public.class_spaces alter column cover set not null;
alter table public.class_spaces alter column backdrop_type set default '';
alter table public.class_spaces alter column backdrop_type set not null;
alter table public.class_spaces alter column backdrop_theme set default '';
alter table public.class_spaces alter column backdrop_theme set not null;
alter table public.class_spaces alter column backdrop_image set default '';
alter table public.class_spaces alter column backdrop_image set not null;
alter table public.class_spaces alter column is_public set default true;
alter table public.class_spaces alter column is_public set not null;
alter table public.class_spaces alter column visible_in_class set default true;
alter table public.class_spaces alter column visible_in_class set not null;
alter table public.class_spaces alter column password_hash set default '';
alter table public.class_spaces alter column password_hash set not null;
alter table public.class_spaces alter column password set default '';
alter table public.class_spaces alter column password set not null;
alter table public.class_spaces alter column shuffle set default false;
alter table public.class_spaces alter column shuffle set not null;
alter table public.class_spaces alter column allow_retry set default true;
alter table public.class_spaces alter column allow_retry set not null;
alter table public.class_spaces alter column allow_multi_try set default false;
alter table public.class_spaces alter column allow_multi_try set not null;
alter table public.class_spaces alter column auto_advance_multi_try set default false;
alter table public.class_spaces alter column auto_advance_multi_try set not null;
alter table public.class_spaces alter column show_essay_hints set default true;
alter table public.class_spaces alter column show_essay_hints set not null;
alter table public.class_spaces alter column enable_leaderboard set default false;
alter table public.class_spaces alter column enable_leaderboard set not null;
alter table public.class_spaces alter column owner_id set default '';
alter table public.class_spaces alter column owner_id set not null;
alter table public.class_spaces alter column owner_name set default 'Ẩn danh';
alter table public.class_spaces alter column owner_name set not null;
alter table public.class_spaces alter column created_at set default now();
alter table public.class_spaces alter column created_at set not null;
alter table public.class_spaces alter column updated_at set default now();
alter table public.class_spaces alter column updated_at set not null;

do $$
begin
  begin alter table public.class_spaces add constraint class_spaces_code_chk check (code = '' or code ~ '^[0-9]{6}$'); exception when duplicate_object then null; end;
  begin alter table public.class_spaces add constraint class_spaces_backdrop_chk check (backdrop_type in ('', 'theme', 'image')); exception when duplicate_object then null; end;
end $$;

create index if not exists class_spaces_created_at_idx on public.class_spaces (created_at desc);
create index if not exists class_spaces_owner_idx on public.class_spaces (owner_id, created_at desc);
create index if not exists class_spaces_visible_idx on public.class_spaces (visible_in_class, created_at desc);

create table if not exists public.class_space_questions (
  class_space_id text not null references public.class_spaces(id) on delete cascade,
  position integer not null check (position >= 0),
  question jsonb not null default '{}'::jsonb,
  primary key (class_space_id, position)
);
create index if not exists class_space_questions_space_idx on public.class_space_questions (class_space_id, position);

create table if not exists public.class_space_editors (
  class_space_id text not null references public.class_spaces(id) on delete cascade,
  user_id text not null,
  email text not null,
  username text not null default '',
  primary key (class_space_id, user_id)
);
create index if not exists class_space_editors_user_idx on public.class_space_editors (user_id, class_space_id);

create table if not exists public.class_space_results (
  class_space_id text not null references public.class_spaces(id) on delete cascade,
  user_id text not null,
  user_name text not null default 'Ẩn danh',
  correct integer not null default 0 check (correct >= 0),
  total integer not null default 0 check (total >= 0),
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  completed_at timestamptz not null default now(),
  primary key (class_space_id, user_id)
);
create index if not exists class_space_results_leaderboard_idx
  on public.class_space_results (class_space_id, correct desc, duration_ms asc, completed_at asc);

create table if not exists public.class_space_attempts (
  class_space_id text not null references public.class_spaces(id) on delete cascade,
  user_id text not null,
  started_at timestamptz not null,
  primary key (class_space_id, user_id)
);
create index if not exists class_space_attempts_user_idx on public.class_space_attempts (user_id, class_space_id);

create table if not exists public.utility_rosters (
  id text primary key check (id = 'default'),
  file_name text not null default '',
  updated_at timestamptz not null default now()
);
create table if not exists public.utility_roster_members (
  roster_id text not null references public.utility_rosters(id) on delete cascade,
  position integer not null check (position >= 0),
  student_number integer check (student_number is null or student_number > 0),
  name text not null check (char_length(trim(name)) > 0),
  primary key (roster_id, position)
);
create index if not exists utility_roster_members_number_idx on public.utility_roster_members (student_number, position);

-- Backfill the exact keys used by the former service adapter. Every insert is
-- conflict-safe, so rerunning this migration never overwrites relational data.
do $$
begin
  if to_regclass('public.classroom_store') is not null then
    insert into public.class_spaces (
      id, code, title, cover, backdrop_type, backdrop_theme, backdrop_image,
      is_public, visible_in_class, password_hash, password, shuffle, allow_retry,
      allow_multi_try, auto_advance_multi_try, show_essay_hints, enable_leaderboard,
      owner_id, owner_name, created_at, updated_at
    )
    select
      nullif(btrim(item->>'id'), ''),
      coalesce(nullif(btrim(item->>'code'), ''), ''),
      coalesce(nullif(btrim(item->>'title'), ''), 'Lớp học'),
      coalesce(item->>'cover', ''),
      case when item->>'backdropType' in ('theme', 'image') then item->>'backdropType' else '' end,
      coalesce(item->>'backdropTheme', ''),
      coalesce(item->>'backdropImage', ''),
      case when item->>'isPublic' in ('true', 'false') then (item->>'isPublic')::boolean else true end,
      case when item->>'visibleInClass' in ('true', 'false') then (item->>'visibleInClass')::boolean else true end,
      coalesce(item->>'passwordHash', ''),
      coalesce(item->>'password', ''),
      case when item->>'shuffle' in ('true', 'false') then (item->>'shuffle')::boolean else false end,
      case when item->>'allowRetry' in ('true', 'false') then (item->>'allowRetry')::boolean else true end,
      case when item->>'allowMultiTry' in ('true', 'false') then (item->>'allowMultiTry')::boolean else false end,
      case when item->>'autoAdvanceMultiTry' in ('true', 'false') then (item->>'autoAdvanceMultiTry')::boolean else false end,
      case when item->>'showEssayHints' in ('true', 'false') then (item->>'showEssayHints')::boolean else true end,
      case when item->>'enableLeaderboard' in ('true', 'false') then (item->>'enableLeaderboard')::boolean else false end,
      coalesce(item->>'ownerId', ''),
      coalesce(nullif(btrim(item->>'ownerName'), ''), 'Ẩn danh'),
      case when pg_input_is_valid(item->>'createdAt', 'timestamptz') then (item->>'createdAt')::timestamptz else now() end,
      case when pg_input_is_valid(item->>'updatedAt', 'timestamptz') then (item->>'updatedAt')::timestamptz else now() end
    from public.classroom_store store
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(store.value->'items') = 'array' then store.value->'items' else '[]'::jsonb end
    ) item
    where store.key = 'class-space'
      and nullif(btrim(item->>'id'), '') is not null
    on conflict (id) do nothing;

    insert into public.class_space_questions (class_space_id, position, question)
    select cs.id, q.position - 1, q.question
    from public.classroom_store store
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(store.value->'items') = 'array' then store.value->'items' else '[]'::jsonb end
    ) item
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(item->'questions') = 'array' then item->'questions' else '[]'::jsonb end
    ) with ordinality q(question, position)
    join public.class_spaces cs on cs.id = nullif(btrim(item->>'id'), '')
    where store.key = 'class-space'
    on conflict do nothing;

    insert into public.class_space_editors (class_space_id, user_id, email, username)
    select cs.id, nullif(btrim(editor->>'userId'), ''), coalesce(editor->>'email', ''), coalesce(editor->>'username', '')
    from public.classroom_store store
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(store.value->'items') = 'array' then store.value->'items' else '[]'::jsonb end
    ) item
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(item->'editors') = 'array' then item->'editors' else '[]'::jsonb end
    ) editor
    join public.class_spaces cs on cs.id = nullif(btrim(item->>'id'), '')
    where store.key = 'class-space' and nullif(btrim(editor->>'userId'), '') is not null
    on conflict do nothing;

    insert into public.class_space_results (class_space_id, user_id, user_name, correct, total, duration_ms, completed_at)
    select cs.id, nullif(btrim(result.key), ''), coalesce(result.value->>'userName', 'Ẩn danh'),
      greatest(0, case when pg_input_is_valid(result.value->>'correct', 'integer') then (result.value->>'correct')::integer else 0 end),
      greatest(0, case when pg_input_is_valid(result.value->>'total', 'integer') then (result.value->>'total')::integer else 0 end),
      case when pg_input_is_valid(result.value->>'durationMs', 'bigint') and result.value->>'durationMs' ~ '^[0-9]+$' then (result.value->>'durationMs')::bigint else null end,
      case when pg_input_is_valid(result.value->>'completedAt', 'timestamptz') then (result.value->>'completedAt')::timestamptz else now() end
    from public.classroom_store store
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(store.value->'items') = 'array' then store.value->'items' else '[]'::jsonb end
    ) item
    cross join lateral jsonb_each(
      case when jsonb_typeof(item->'results') = 'object' then item->'results' else '{}'::jsonb end
    ) result
    join public.class_spaces cs on cs.id = nullif(btrim(item->>'id'), '')
    where store.key = 'class-space' and nullif(btrim(result.key), '') is not null
    on conflict do nothing;

    insert into public.class_space_attempts (class_space_id, user_id, started_at)
    select cs.id, nullif(btrim(attempt.key), ''),
      case when pg_input_is_valid(attempt.value->>'startedAt', 'timestamptz') then (attempt.value->>'startedAt')::timestamptz else now() end
    from public.classroom_store store
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(store.value->'items') = 'array' then store.value->'items' else '[]'::jsonb end
    ) item
    cross join lateral jsonb_each(
      case when jsonb_typeof(item->'attempts') = 'object' then item->'attempts' else '{}'::jsonb end
    ) attempt
    join public.class_spaces cs on cs.id = nullif(btrim(item->>'id'), '')
    where store.key = 'class-space' and nullif(btrim(attempt.key), '') is not null
    on conflict do nothing;

    insert into public.utility_rosters (id, file_name, updated_at)
    select 'default',
      coalesce(store.value->>'fileName', ''),
      case when pg_input_is_valid(store.value->>'updatedAt', 'timestamptz') then (store.value->>'updatedAt')::timestamptz else now() end
    from public.classroom_store store
    where store.key = 'utility-roster'
    on conflict (id) do nothing;

    insert into public.utility_roster_members(roster_id, position, student_number, name)
    select 'default', n.ordinality - 1,
      case when pg_input_is_valid(n.value->>'stt', 'integer') and (n.value->>'stt') ~ '^[1-9][0-9]*$' then (n.value->>'stt')::integer else n.ordinality::integer end,
      nullif(btrim(n.value->>'name'), '')
    from public.classroom_store store
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(store.value->'names') = 'array' then store.value->'names' else '[]'::jsonb end
    ) with ordinality n(value, ordinality)
    where store.key = 'utility-roster' and nullif(btrim(n.value->>'name'), '') is not null
    on conflict (roster_id, position) do nothing;
  end if;
end $$;

update public.class_spaces cs set question_count = (select count(*) from public.class_space_questions q where q.class_space_id = cs.id);

-- Repair duplicate/missing legacy codes without dropping a room. New codes are allocated
-- under the same advisory lock used by the write RPC.
with duplicate_codes as (
  select ctid, row_number() over (partition by code order by id) as duplicate_number
  from public.class_spaces
  where code <> ''
)
update public.class_spaces cs
set code = ''
from duplicate_codes dup
where cs.ctid = dup.ctid and dup.duplicate_number > 1;
do $$
declare v_id text; v_code text;
begin
  for v_id in select id from public.class_spaces where code = '' order by id loop
    loop
      v_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');
      exit when not exists (select 1 from public.class_spaces where code = v_code);
    end loop;
    update public.class_spaces set code = v_code where id = v_id;
  end loop;
end $$;
create unique index if not exists class_spaces_code_uidx on public.class_spaces (code) where code <> '';

-- Atomic replacement of room metadata/questions/editors. Results and attempts are
-- updated only with their user-scoped RPC/upsert, never overwritten as a snapshot.
create or replace function public.replace_class_space(p_item jsonb, p_expected_updated_at timestamptz default null)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id text := nullif(btrim(p_item->>'id'), '');
  v_code text := coalesce(p_item->>'code', '');
  v_current_updated_at timestamptz;
begin
  if v_id is null then raise exception 'class-space id is required' using errcode = '22023'; end if;
  select updated_at into v_current_updated_at from public.class_spaces where id = v_id for update;
  if found and p_expected_updated_at is not null and v_current_updated_at is distinct from p_expected_updated_at then
    raise exception 'CLASS_SPACE_STALE' using errcode = '40001';
  end if;
  if not found then
    perform pg_advisory_xact_lock(hashtext('class_spaces_code_allocator'));
    loop
      v_code := lpad(floor(random() * 1000000)::integer::text, 6, '0');
      exit when not exists (select 1 from public.class_spaces where code = v_code);
    end loop;
  end if;
  insert into public.class_spaces (
    id, code, question_count, title, cover, backdrop_type, backdrop_theme, backdrop_image,
    is_public, visible_in_class, password_hash, password, shuffle, allow_retry,
    allow_multi_try, auto_advance_multi_try, show_essay_hints, enable_leaderboard,
    owner_id, owner_name, created_at, updated_at
  ) values (
    v_id, v_code, jsonb_array_length(case when jsonb_typeof(p_item->'questions') = 'array' then p_item->'questions' else '[]'::jsonb end), coalesce(nullif(btrim(p_item->>'title'), ''), 'Lớp học'),
    coalesce(p_item->>'cover', ''), coalesce(p_item->>'backdropType', ''), coalesce(p_item->>'backdropTheme', ''),
    coalesce(p_item->>'backdropImage', ''), coalesce((p_item->>'isPublic')::boolean, true),
    coalesce((p_item->>'visibleInClass')::boolean, true), coalesce(p_item->>'passwordHash', ''),
    coalesce(p_item->>'password', ''), coalesce((p_item->>'shuffle')::boolean, false),
    coalesce((p_item->>'allowRetry')::boolean, true), coalesce((p_item->>'allowMultiTry')::boolean, false),
    coalesce((p_item->>'autoAdvanceMultiTry')::boolean, false), coalesce((p_item->>'showEssayHints')::boolean, true),
    coalesce((p_item->>'enableLeaderboard')::boolean, false), coalesce(p_item->>'ownerId', ''),
    coalesce(nullif(btrim(p_item->>'ownerName'), ''), 'Ẩn danh'),
    coalesce((p_item->>'createdAt')::timestamptz, now()), coalesce((p_item->>'updatedAt')::timestamptz, now())
  ) on conflict (id) do update set
    code = excluded.code, question_count = excluded.question_count, title = excluded.title, cover = excluded.cover,
    backdrop_type = excluded.backdrop_type, backdrop_theme = excluded.backdrop_theme,
    backdrop_image = excluded.backdrop_image, is_public = excluded.is_public,
    visible_in_class = excluded.visible_in_class, password_hash = excluded.password_hash,
    password = excluded.password, shuffle = excluded.shuffle, allow_retry = excluded.allow_retry,
    allow_multi_try = excluded.allow_multi_try, auto_advance_multi_try = excluded.auto_advance_multi_try,
    show_essay_hints = excluded.show_essay_hints, enable_leaderboard = excluded.enable_leaderboard,
    owner_id = excluded.owner_id, owner_name = excluded.owner_name, created_at = excluded.created_at,
    updated_at = excluded.updated_at;

  delete from public.class_space_questions where class_space_id = v_id;
  insert into public.class_space_questions (class_space_id, position, question)
  select v_id, value.ordinality - 1, value.item
  from jsonb_array_elements(case when jsonb_typeof(p_item->'questions') = 'array' then p_item->'questions' else '[]'::jsonb end)
    with ordinality as value(item, ordinality);

  delete from public.class_space_editors where class_space_id = v_id;
  insert into public.class_space_editors (class_space_id, user_id, email, username)
  select v_id, nullif(btrim(value.item->>'userId'), ''), coalesce(value.item->>'email', ''), coalesce(value.item->>'username', '')
  from jsonb_array_elements(case when jsonb_typeof(p_item->'editors') = 'array' then p_item->'editors' else '[]'::jsonb end) value(item)
  where nullif(btrim(value.item->>'userId'), '') is not null
  on conflict do nothing;

  return v_code;
end;
$$;

revoke all on table public.class_spaces, public.class_space_questions, public.class_space_editors,
  public.class_space_results, public.class_space_attempts, public.utility_rosters, public.utility_roster_members from public, anon, authenticated;
grant all on table public.class_spaces, public.class_space_questions, public.class_space_editors,
  public.class_space_results, public.class_space_attempts, public.utility_rosters, public.utility_roster_members to service_role;
alter table public.class_spaces enable row level security;
alter table public.class_space_questions enable row level security;
alter table public.class_space_editors enable row level security;
alter table public.class_space_results enable row level security;
alter table public.class_space_attempts enable row level security;
alter table public.utility_rosters enable row level security;
alter table public.utility_roster_members enable row level security;

drop policy if exists class_spaces_no_client_access on public.class_spaces;
drop policy if exists class_space_questions_no_client_access on public.class_space_questions;
drop policy if exists class_space_editors_no_client_access on public.class_space_editors;
drop policy if exists class_space_results_no_client_access on public.class_space_results;
drop policy if exists class_space_attempts_no_client_access on public.class_space_attempts;
drop policy if exists utility_rosters_no_client_access on public.utility_rosters;
drop policy if exists utility_roster_members_no_client_access on public.utility_roster_members;
revoke all on function public.replace_class_space(jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.replace_class_space(jsonb,timestamptz) to service_role;
comment on table public.class_spaces is 'Normalized class-space records; legacy classroom_store key class-space is retained as an immutable migration source.';
comment on table public.utility_rosters is 'Utility roster file metadata; legacy classroom_store key utility-roster is retained as an immutable migration source.';
comment on table public.utility_roster_members is 'One normalized row per parsed roster student; the source PDF remains in Storage.';
create or replace function public.list_class_space_creators()
returns table(owner_id text, owner_name text, single_room boolean)
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select cs.owner_id,
    (array_agg(cs.owner_name order by cs.created_at desc))[1],
    count(*) = 1
  from public.class_spaces cs
  where nullif(btrim(cs.owner_id), '') is not null
  group by cs.owner_id
  order by lower((array_agg(cs.owner_name order by cs.created_at desc))[1]), cs.owner_id
  limit 100
$$;

create or replace function public.replace_utility_roster(p_file_name text, p_updated_at timestamptz, p_names jsonb)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_name jsonb; v_position integer := 0; v_label text; v_number integer;
begin
  insert into public.utility_rosters(id,file_name,updated_at)
  values('default',coalesce(p_file_name,''),coalesce(p_updated_at,now()))
  on conflict(id) do update set file_name=excluded.file_name, updated_at=excluded.updated_at;
  delete from public.utility_roster_members where roster_id='default';
  if jsonb_typeof(p_names) <> 'array' then raise exception 'names must be an array' using errcode='22023'; end if;
  for v_name in select value from jsonb_array_elements(p_names) loop
    v_label := nullif(btrim(v_name->>'name'),'');
    if v_label is not null then
      v_number := case when coalesce(v_name->>'stt','') ~ '^[1-9][0-9]*$' then (v_name->>'stt')::integer else v_position + 1 end;
      insert into public.utility_roster_members(roster_id,position,student_number,name)
      values('default',v_position,v_number,v_label);
      v_position := v_position + 1;
    end if;
  end loop;
end $$;

create or replace function public.submit_class_space_result(
  p_class_space_id text, p_user_id text, p_user_name text, p_correct integer, p_total integer
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_space public.class_spaces%rowtype;
  v_attempt public.class_space_attempts%rowtype;
  v_existing public.class_space_results%rowtype;
  v_result public.class_space_results%rowtype;
  v_duration bigint;
  v_total integer;
begin
  select * into v_space from public.class_spaces where id=p_class_space_id for update;
  if not found then raise exception 'CLASS_SPACE_NOT_FOUND' using errcode='P0002'; end if;
  select coalesce(sum(case when q.question->>'kind'='truefalse' then jsonb_array_length(case when jsonb_typeof(q.question->'question'->'statements')='array' then q.question->'question'->'statements' else '[]'::jsonb end) else 1 end),0)::integer
    into v_total from public.class_space_questions q where q.class_space_id=p_class_space_id;
  select * into v_existing from public.class_space_results where class_space_id=p_class_space_id and user_id=p_user_id;
  if found and not v_space.allow_retry then raise exception 'CLASS_SPACE_RETRY_DISABLED' using errcode='42501'; end if;
  select * into v_attempt from public.class_space_attempts where class_space_id=p_class_space_id and user_id=p_user_id for update;
  if found then v_duration := greatest(0, floor(extract(epoch from (clock_timestamp()-v_attempt.started_at))*1000)::bigint); else v_duration := null; end if;
  insert into public.class_space_results(class_space_id,user_id,user_name,correct,total,duration_ms,completed_at)
  values(p_class_space_id,p_user_id,coalesce(nullif(btrim(p_user_name),''),'Ẩn danh'),greatest(0,least(coalesce(p_correct,0),v_total)),v_total,v_duration,now())
  on conflict(class_space_id,user_id) do update set user_name=excluded.user_name,correct=excluded.correct,total=excluded.total,duration_ms=excluded.duration_ms,completed_at=excluded.completed_at
  returning * into v_result;
  delete from public.class_space_attempts where class_space_id=p_class_space_id and user_id=p_user_id;
  return to_jsonb(v_result);
end $$;

create or replace function public.get_class_space_leaderboard(p_class_space_id text, p_page integer default 1, p_page_size integer default 100)
returns table(rank bigint, user_id text, user_name text, correct integer, total integer, duration_ms bigint, completed_at timestamptz)
language sql stable security definer
set search_path = pg_catalog, public
as $$
  with ranked as (
    select rank() over(order by r.correct desc, r.duration_ms asc nulls last, r.completed_at asc) as rank,
      r.user_id, r.user_name, r.correct, r.total, r.duration_ms, r.completed_at
    from public.class_space_results r where r.class_space_id = p_class_space_id
  )
  select ranked.* from ranked order by correct desc, duration_ms asc nulls last, completed_at asc
  offset (greatest(1,least(coalesce(p_page,1),10000))-1) * greatest(1,least(coalesce(p_page_size,100),100))
  limit greatest(1,least(coalesce(p_page_size,100),100))
$$;

revoke all on function public.list_class_space_creators() from public, anon, authenticated;
grant execute on function public.list_class_space_creators() to service_role;
revoke all on function public.get_class_space_leaderboard(text,integer,integer) from public, anon, authenticated;
grant execute on function public.get_class_space_leaderboard(text,integer,integer) to service_role;
revoke all on function public.replace_utility_roster(text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.replace_utility_roster(text,timestamptz,jsonb) to service_role;
revoke all on function public.submit_class_space_result(text,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.submit_class_space_result(text,text,text,integer,integer) to service_role;
notify pgrst, 'reload schema';
