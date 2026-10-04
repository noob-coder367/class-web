-- Relational Rules domain. The legacy classroom_store rows are an immutable
-- migration source; this migration never updates or deletes them.
-- Legacy keys used by rules.service.js: rules and violations.

create table if not exists public.rules_settings (
  id text primary key check (id = 'default'),
  title text not null default 'NỘI QUY LỚP',
  starting_points integer not null default 100 check (starting_points between 1 and 200),
  notice_title text not null default 'LƯU Ý',
  notice_body text not null default '',
  violations_updated_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.rule_sections (
  id text primary key,
  settings_id text not null default 'default' references public.rules_settings(id) on delete cascade,
  title text not null default 'Mục',
  position integer not null default 0 check (position >= 0),
  unique (settings_id, position)
);

create table if not exists public.rule_items (
  section_id text not null references public.rule_sections(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  text text not null,
  points integer not null default 5 check (points between 0 and 100),
  primary key (section_id, position)
);

create table if not exists public.rule_violations (
  id text primary key,
  violation_date date not null,
  period text not null default '',
  student_name text not null,
  user_id text,
  roster_id text,
  offense text not null,
  warning text not null default '',
  points integer not null default 5 check (points between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(student_name)) > 0),
  check (length(btrim(offense)) > 0),
  check (user_id is null or roster_id is null)
);

create table if not exists public.rule_violation_photos (
  violation_id text not null references public.rule_violations(id) on delete cascade,
  position integer not null default 0 check (position >= 0 and position < 3),
  storage_path text not null,
  name text not null default '',
  primary key (violation_id, position),
  unique (storage_path)
);

-- Ranking rows are an optional normalized snapshot target. The service keeps
-- buildLeaderboard synchronous and computes its public DTO from current roster
-- members plus rule_violations, so existing API behavior does not depend on a
-- stale snapshot.
create table if not exists public.rule_rankings (
  member_id text primary key,
  username text not null default '',
  role text not null default 'user',
  is_placeholder boolean not null default false,
  score integer not null default 0 check (score >= 0),
  deducted integer not null default 0 check (deducted >= 0),
  violation_count integer not null default 0 check (violation_count >= 0),
  rank integer not null default 1 check (rank >= 1),
  calculated_at timestamptz not null default now()
);

create index if not exists rule_sections_settings_position_idx
  on public.rule_sections (settings_id, position);
create index if not exists rule_items_section_position_idx
  on public.rule_items (section_id, position);
create index if not exists rule_violations_date_created_idx
  on public.rule_violations (violation_date desc, created_at desc);
create index if not exists rule_violations_user_date_idx
  on public.rule_violations (user_id, violation_date desc)
  where user_id is not null;
create index if not exists rule_violations_roster_date_idx
  on public.rule_violations (roster_id, violation_date desc)
  where roster_id is not null;
create index if not exists rule_violations_name_idx
  on public.rule_violations (lower(student_name));
create index if not exists rule_violation_photos_path_idx
  on public.rule_violation_photos (storage_path);
create index if not exists rule_rankings_score_idx
  on public.rule_rankings (score desc, violation_count asc, username asc);

-- Backfill only missing relational rows. All casts are guarded so one malformed
-- legacy item cannot abort installation, and reruns never overwrite edits.
do $$
declare
  source_value jsonb;
  item jsonb;
  section_item jsonb;
  photo jsonb;
  section_no integer;
  item_no integer;
  photo_no integer;
  raw_user_id text;
  raw_roster_id text;
  raw_created_at text;
  raw_updated_at text;
  settings_updated_at timestamptz;
begin
  if to_regclass('public.classroom_store') is null then
    raise notice 'classroom_store absent: Rules legacy backfill skipped';
    return;
  end if;

  select value into source_value from public.classroom_store where key = 'rules';
  if jsonb_typeof(source_value) = 'object' then
    insert into public.rules_settings (
      id, title, starting_points, notice_title, notice_body, updated_at
    ) values (
      'default',
      coalesce(nullif(btrim(source_value->>'title'), ''), 'NỘI QUY LỚP'),
      case when source_value->>'startingPoints' ~ '^-?[0-9]+$'
        then least(200, greatest(1, (source_value->>'startingPoints')::integer)) else 100 end,
      coalesce(nullif(btrim(source_value->'notice'->>'title'), ''), 'LƯU Ý'),
      coalesce(source_value->'notice'->>'body', ''),
      case when pg_input_is_valid(source_value->>'updatedAt', 'timestamptz')
        then (source_value->>'updatedAt')::timestamptz else now() end
    ) on conflict (id) do nothing;

    section_no := 0;
    for section_item in select value from jsonb_array_elements(
      case when jsonb_typeof(source_value->'sections') = 'array' then source_value->'sections' else '[]'::jsonb end
    ) as sections(value)
    loop
      section_no := section_no + 1;
      insert into public.rule_sections(id, settings_id, title, position)
      values (
        coalesce(nullif(btrim(section_item->>'id'), ''), 's' || section_no::text),
        'default',
        coalesce(nullif(btrim(section_item->>'title'), ''), 'Mục'),
        section_no - 1
      ) on conflict (id) do nothing;

      item_no := 0;
      for item in select value from jsonb_array_elements(
        case when jsonb_typeof(section_item->'items') = 'array' then section_item->'items' else '[]'::jsonb end
      ) as items(value)
      loop
        item_no := item_no + 1;
        if nullif(btrim(case when jsonb_typeof(item) = 'string' then item #>> '{}' else item->>'text' end), '') is not null then
          insert into public.rule_items(section_id, position, text, points)
          values (
            coalesce(nullif(btrim(section_item->>'id'), ''), 's' || section_no::text),
            item_no - 1,
            case when jsonb_typeof(item) = 'string' then btrim(item #>> '{}') else btrim(item->>'text') end,
            case when (item->>'points') ~ '^-?[0-9]+$' then least(100, greatest(0, (item->>'points')::integer)) else 5 end
          ) on conflict (section_id, position) do nothing;
        end if;
      end loop;
    end loop;
  end if;

  select value into source_value from public.classroom_store where key = 'violations';
  if jsonb_typeof(source_value) = 'object' then
    raw_updated_at := source_value->>'updatedAt';
    if pg_input_is_valid(raw_updated_at, 'timestamptz') then
      settings_updated_at := raw_updated_at::timestamptz;
    else
      settings_updated_at := now();
    end if;
    insert into public.rules_settings(id, violations_updated_at)
    values ('default', settings_updated_at)
    on conflict (id) do update
      set violations_updated_at = coalesce(public.rules_settings.violations_updated_at, excluded.violations_updated_at);

    for item in select value from jsonb_array_elements(
      case when jsonb_typeof(source_value->'items') = 'array' then source_value->'items' else '[]'::jsonb end
    ) as items(value)
    loop
      if nullif(btrim(item->>'id'), '') is null
        or not ((item->>'date') ~ '^\d{4}-\d{2}-\d{2}$')
        or nullif(btrim(item->>'name'), '') is null
        or nullif(btrim(item->>'offense'), '') is null then
        continue;
      end if;
      raw_user_id := nullif(btrim(item->>'userId'), '');
      raw_roster_id := nullif(btrim(item->>'rosterId'), '');
      if raw_roster_id is null and left(coalesce(raw_user_id, ''), 7) = 'roster:' then
        raw_roster_id := nullif(substr(raw_user_id, 8), '');
        raw_user_id := null;
      elsif raw_roster_id is not null then
        raw_user_id := null;
      end if;
      raw_created_at := item->>'createdAt';
      insert into public.rule_violations (
        id, violation_date, period, student_name, user_id, roster_id,
        offense, warning, points, created_at, updated_at
      ) values (
        btrim(item->>'id'),
        (item->>'date')::date,
        left(coalesce(item->>'period', ''), 24),
        left(btrim(item->>'name'), 80),
        left(raw_user_id, 64),
        left(raw_roster_id, 64),
        left(btrim(item->>'offense'), 160),
        left(coalesce(item->>'warning', ''), 400),
        case when (item->>'points') ~ '^-?[0-9]+$' then least(100, greatest(0, (item->>'points')::integer)) else 5 end,
        case when pg_input_is_valid(raw_created_at, 'timestamptz') then raw_created_at::timestamptz else now() end,
        settings_updated_at
      ) on conflict (id) do nothing;

      photo_no := 0;
      for photo in select value from jsonb_array_elements(
        case when jsonb_typeof(item->'photos') = 'array' then item->'photos' else '[]'::jsonb end
      ) as photos(value)
      loop
        photo_no := photo_no + 1;
        if photo_no <= 3 and nullif(btrim(photo->>'path'), '') is not null
          and (photo->>'path') like 'violations/%'
          and position('..' in (photo->>'path')) = 0 then
          insert into public.rule_violation_photos(violation_id, position, storage_path, name)
          values (
            btrim(item->>'id'), photo_no - 1, btrim(photo->>'path'),
            left(coalesce(nullif(btrim(photo->>'name'), ''), split_part(photo->>'path', '/', -1)), 80)
          ) on conflict do nothing;
        end if;
      end loop;
    end loop;
  end if;
end $$;

alter table public.rules_settings enable row level security;
alter table public.rule_sections enable row level security;
alter table public.rule_items enable row level security;
alter table public.rule_violations enable row level security;
alter table public.rule_violation_photos enable row level security;
alter table public.rule_rankings enable row level security;

revoke all on table public.rules_settings, public.rule_sections, public.rule_items,
  public.rule_violations, public.rule_violation_photos, public.rule_rankings from public, anon, authenticated;
grant all on table public.rules_settings, public.rule_sections, public.rule_items,
  public.rule_violations, public.rule_violation_photos, public.rule_rankings to service_role;

drop policy if exists rules_settings_no_client_access on public.rules_settings;
drop policy if exists rule_sections_no_client_access on public.rule_sections;
drop policy if exists rule_items_no_client_access on public.rule_items;
drop policy if exists rule_violations_no_client_access on public.rule_violations;
drop policy if exists rule_violation_photos_no_client_access on public.rule_violation_photos;
drop policy if exists rule_rankings_no_client_access on public.rule_rankings;

comment on table public.rules_settings is 'Normalized Rules settings; legacy classroom_store.rules is retained as an immutable migration source.';
comment on table public.rule_sections is 'Relational Rules sections; section position preserves the public DTO order.';
comment on table public.rule_items is 'Relational Rules items; item position preserves the public DTO order.';
comment on table public.rule_violations is 'Normalized violation records; legacy classroom_store.violations is retained as an immutable migration source.';
comment on table public.rule_violation_photos is 'Violation evidence metadata; Storage objects are managed by rules.service.js.';
comment on table public.rule_rankings is 'Optional ranking snapshots; the synchronous public leaderboard remains computed from current roster and violations.';

create or replace function public.rules_member_violation_totals(p_members jsonb)
returns table(member_id text, deducted bigint, violation_count bigint)
language sql stable security definer
set search_path = pg_catalog, public
as $$
  with members as (
    select * from jsonb_to_recordset(case when jsonb_typeof(p_members)='array' then p_members else '[]'::jsonb end)
      as m(id text, username text, is_placeholder boolean, roster_id text)
  )
  select m.id, coalesce(sum(v.points),0)::bigint, count(v.id)::bigint
  from members m
  left join public.rule_violations v on (
    (coalesce(m.is_placeholder,false) and (
      (nullif(m.roster_id,'') is not null and v.roster_id=m.roster_id)
      or (nullif(m.roster_id,'') is null and v.roster_id is null and v.user_id is null and lower(v.student_name)=lower(m.username))
    ))
    or (not coalesce(m.is_placeholder,false) and (
      v.user_id=m.id
      or (v.user_id is null and v.roster_id is null and lower(v.student_name)=lower(m.username))
    ))
  )
  group by m.id
$$;
revoke all on function public.rules_member_violation_totals(jsonb) from public, anon, authenticated;
grant execute on function public.rules_member_violation_totals(jsonb) to service_role;

notify pgrst, 'reload schema';
