-- Relational class roster/member state.
-- The legacy classroom_store row is an immutable migration source: this file only
-- reads key class-roster and never updates or deletes that row or its Storage JSON.

create table if not exists public.class_rosters (
  id text primary key,
  updated_at timestamptz not null default now()
);

alter table public.class_rosters add column if not exists updated_at timestamptz;
update public.class_rosters set updated_at = now() where updated_at is null;
alter table public.class_rosters alter column updated_at set default now();
alter table public.class_rosters alter column updated_at set not null;

do $$
begin
  begin
    alter table public.class_rosters add constraint class_rosters_default_id_chk check (id = 'default') not valid;
  exception when duplicate_object then null;
  end;
end $$;

insert into public.class_rosters (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.class_roster_members (
  id text primary key,
  roster_id text not null default 'default',
  name text not null,
  created_at timestamptz not null default now(),
  created_by text
);

-- Converge installations where an earlier hand-created table exists.
alter table public.class_roster_members add column if not exists id text;
alter table public.class_roster_members add column if not exists roster_id text;
alter table public.class_roster_members add column if not exists name text;
alter table public.class_roster_members add column if not exists created_at timestamptz;
alter table public.class_roster_members add column if not exists created_by text;
update public.class_roster_members
set id = md5('existing:class-roster-member:' || ctid::text)
where id is null or btrim(id) = '';
update public.class_roster_members set roster_id = 'default' where roster_id is null;
update public.class_roster_members set name = left(coalesce(nullif(btrim(name), ''), 'Chưa đặt tên'), 40) where name is null or btrim(name) = '';
update public.class_roster_members set created_at = now() where created_at is null;
alter table public.class_roster_members alter column id set not null;
alter table public.class_roster_members alter column roster_id set default 'default';
alter table public.class_roster_members alter column roster_id set not null;
alter table public.class_roster_members alter column name set not null;
alter table public.class_roster_members alter column created_at set default now();
alter table public.class_roster_members alter column created_at set not null;

do $$
begin
  begin
    alter table public.class_roster_members
      add constraint class_roster_members_roster_fk
      foreign key (roster_id) references public.class_rosters(id) on delete cascade not valid;
  exception when duplicate_object then null;
  end;
  begin
    alter table public.class_roster_members
      add constraint class_roster_members_id_chk
      check (char_length(trim(id)) between 1 and 200) not valid;
  exception when duplicate_object then null;
  end;
  begin
    alter table public.class_roster_members
      add constraint class_roster_members_name_chk
      check (char_length(trim(name)) between 1 and 40) not valid;
  exception when duplicate_object then null;
  end;
end $$;

create index if not exists class_roster_members_roster_name_idx
  on public.class_roster_members (roster_id, name);
create index if not exists class_roster_members_created_at_idx
  on public.class_roster_members (roster_id, created_at desc);
create unique index if not exists class_roster_members_folded_name_uidx
  on public.class_roster_members (roster_id, lower(btrim(name)));

-- Backfill the exact legacy key used by classRoster.service.js. Inserts are
-- conflict-safe and therefore rerunning this migration never overwrites rows
-- already present in the normalized tables.
do $$
begin
  if to_regclass('public.classroom_store') is not null then
    insert into public.class_roster_members (id, roster_id, name, created_at, created_by)
    select legacy.id, 'default', legacy.name, legacy.created_at, legacy.created_by
    from (
      select distinct on (lower(btrim(item->>'name')))
        coalesce(
          case when char_length(btrim(item->>'id')) between 1 and 200 then nullif(btrim(item->>'id'), '') end,
          md5('legacy:class-roster:' || item_position::text || ':' || btrim(item->>'name'))
        ) as id,
        left(btrim(item->>'name'), 40) as name,
        case
          when pg_input_is_valid(item->>'createdAt', 'timestamptz') then (item->>'createdAt')::timestamptz
          else now()
        end as created_at,
        left(nullif(btrim(item->>'createdBy'), ''), 64) as created_by
      from public.classroom_store store
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(store.value->'items') = 'array' then store.value->'items' else '[]'::jsonb end
      ) with ordinality as entries(item, item_position)
      where store.key = 'class-roster'
        and jsonb_typeof(item) = 'object'
        and nullif(btrim(item->>'name'), '') is not null
      order by lower(btrim(item->>'name')), item_position
    ) as legacy
    on conflict do nothing;
  end if;
end $$;

alter table public.class_rosters enable row level security;
alter table public.class_roster_members enable row level security;
revoke all on table public.class_rosters, public.class_roster_members from public, anon, authenticated;
grant all on table public.class_rosters, public.class_roster_members to service_role;

drop policy if exists class_rosters_no_client_access on public.class_rosters;
drop policy if exists class_roster_members_no_client_access on public.class_roster_members;

comment on table public.class_rosters is 'Normalized class roster metadata; legacy classroom_store key class-roster is retained as an immutable migration source.';
comment on table public.class_roster_members is 'Normalized pending roster names; real account rows remain sourced from profiles.';
notify pgrst, 'reload schema';
