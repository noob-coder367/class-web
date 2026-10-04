-- Relational timetable state. The legacy classroom_store row is intentionally
-- retained as an immutable source; this migration only copies from it.
create table if not exists public.timetables (
  id uuid primary key default gen_random_uuid(),
  class_name text not null unique,
  effective_from date,
  subjects jsonb not null default '[]'::jsonb,
  days jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.timetables add column if not exists class_name text;
alter table public.timetables add column if not exists effective_from date;
alter table public.timetables add column if not exists subjects jsonb;
alter table public.timetables add column if not exists days jsonb;
alter table public.timetables add column if not exists created_at timestamptz;
alter table public.timetables add column if not exists updated_at timestamptz;
update public.timetables set class_name = '10A4' where nullif(btrim(class_name), '') is null;
update public.timetables set subjects = '[]'::jsonb where subjects is null;
update public.timetables set days = '[]'::jsonb where days is null;
update public.timetables set created_at = now() where created_at is null;
update public.timetables set updated_at = now() where updated_at is null;
alter table public.timetables alter column class_name set not null;
alter table public.timetables alter column subjects set default '[]'::jsonb;
alter table public.timetables alter column subjects set not null;
alter table public.timetables alter column days set default '[]'::jsonb;
alter table public.timetables alter column days set not null;
alter table public.timetables alter column created_at set default now();
alter table public.timetables alter column created_at set not null;
alter table public.timetables alter column updated_at set default now();
alter table public.timetables alter column updated_at set not null;
create unique index if not exists timetables_class_name_uidx on public.timetables (class_name);

create table if not exists public.timetable_sessions (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references public.timetables(id) on delete cascade,
  session text not null check (session in ('morning', 'afternoon')),
  label text not null default '',
  days_note text not null default '',
  arrival text not null default '',
  has_flag_ceremony boolean not null default false,
  flag_ceremony_configured boolean not null default false,
  flag_ceremony_time text,
  flag_ceremony_note text,
  unique (timetable_id, session)
);
alter table public.timetable_sessions add column if not exists label text;
alter table public.timetable_sessions add column if not exists days_note text;
alter table public.timetable_sessions add column if not exists arrival text;
alter table public.timetable_sessions add column if not exists has_flag_ceremony boolean;
alter table public.timetable_sessions add column if not exists flag_ceremony_configured boolean;
alter table public.timetable_sessions add column if not exists flag_ceremony_time text;
alter table public.timetable_sessions add column if not exists flag_ceremony_note text;
update public.timetable_sessions set label = '' where label is null;
update public.timetable_sessions set days_note = '' where days_note is null;
update public.timetable_sessions set arrival = '' where arrival is null;
update public.timetable_sessions set has_flag_ceremony = false where has_flag_ceremony is null;
update public.timetable_sessions set flag_ceremony_configured = false where flag_ceremony_configured is null;
alter table public.timetable_sessions alter column label set default '';
alter table public.timetable_sessions alter column label set not null;
alter table public.timetable_sessions alter column days_note set default '';
alter table public.timetable_sessions alter column days_note set not null;
alter table public.timetable_sessions alter column arrival set default '';
alter table public.timetable_sessions alter column arrival set not null;
alter table public.timetable_sessions alter column has_flag_ceremony set default false;
alter table public.timetable_sessions alter column has_flag_ceremony set not null;
alter table public.timetable_sessions alter column flag_ceremony_configured set default false;
alter table public.timetable_sessions alter column flag_ceremony_configured set not null;

create table if not exists public.timetable_periods (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references public.timetables(id) on delete cascade,
  session text not null check (session in ('morning', 'afternoon')),
  period_id smallint not null check (period_id between 1 and 8),
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text not null check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  note text,
  unique (timetable_id, session, period_id)
);
alter table public.timetable_periods add column if not exists start_time text;
alter table public.timetable_periods add column if not exists end_time text;
alter table public.timetable_periods add column if not exists note text;

create table if not exists public.timetable_breaks (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references public.timetables(id) on delete cascade,
  session text not null check (session in ('morning', 'afternoon')),
  after_period smallint not null check (after_period between 1 and 8),
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text not null check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  label text not null default 'Giải lao',
  unique (timetable_id, session, after_period)
);
alter table public.timetable_breaks add column if not exists start_time text;
alter table public.timetable_breaks add column if not exists end_time text;
alter table public.timetable_breaks add column if not exists label text;

create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references public.timetables(id) on delete cascade,
  session text not null check (session in ('morning', 'afternoon')),
  day_id text not null check (day_id in ('t2', 't3', 't4', 't5', 't6', 't7')),
  period_id smallint not null check (period_id between 1 and 8),
  subject text not null default '',
  unique (timetable_id, session, day_id, period_id)
);
alter table public.timetable_entries add column if not exists subject text;

create table if not exists public.timetable_change_notices (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references public.timetables(id) on delete cascade,
  active boolean not null default false,
  has_changes boolean not null default false,
  date_from date,
  date_to date,
  summary text not null default 'Chưa có sự thay đổi',
  lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (timetable_id)
);
alter table public.timetable_change_notices add column if not exists active boolean;
alter table public.timetable_change_notices add column if not exists has_changes boolean;
alter table public.timetable_change_notices add column if not exists date_from date;
alter table public.timetable_change_notices add column if not exists date_to date;
alter table public.timetable_change_notices add column if not exists summary text;
alter table public.timetable_change_notices add column if not exists lines jsonb;
alter table public.timetable_change_notices add column if not exists created_at timestamptz;
update public.timetable_change_notices set active = false where active is null;
update public.timetable_change_notices set has_changes = false where has_changes is null;
update public.timetable_change_notices set summary = 'Chưa có sự thay đổi' where summary is null;
update public.timetable_change_notices set lines = '[]'::jsonb where lines is null;
update public.timetable_change_notices set created_at = now() where created_at is null;
alter table public.timetable_change_notices alter column active set default false;
alter table public.timetable_change_notices alter column active set not null;
alter table public.timetable_change_notices alter column has_changes set default false;
alter table public.timetable_change_notices alter column has_changes set not null;
alter table public.timetable_change_notices alter column summary set default 'Chưa có sự thay đổi';
alter table public.timetable_change_notices alter column summary set not null;
alter table public.timetable_change_notices alter column lines set default '[]'::jsonb;
alter table public.timetable_change_notices alter column lines set not null;
alter table public.timetable_change_notices alter column created_at set default now();
alter table public.timetable_change_notices alter column created_at set not null;

create index if not exists timetable_sessions_timetable_idx on public.timetable_sessions (timetable_id, session);
create index if not exists timetable_periods_timetable_idx on public.timetable_periods (timetable_id, session, period_id);
create index if not exists timetable_breaks_timetable_idx on public.timetable_breaks (timetable_id, session, after_period);
create index if not exists timetable_entries_timetable_idx on public.timetable_entries (timetable_id, session, day_id, period_id);
create index if not exists timetable_notices_active_idx on public.timetable_change_notices (timetable_id, active, created_at desc);

-- The service reads the exact legacy key 'timetable' (not the Storage file
-- name). Backfill is insert-only and therefore safe to rerun without changing
-- either the legacy source or already relationalized rows.
do $$
declare
  source_value jsonb;
  source_session jsonb;
  source_notice jsonb;
  timetable_id uuid;
  class_name_value text;
  session_name text;
begin
  if to_regclass('public.classroom_store') is not null then
    execute 'select value from public.classroom_store where key = $1'
      into source_value using 'timetable';

    if jsonb_typeof(source_value) = 'object' then
      class_name_value := coalesce(nullif(btrim(source_value->>'className'), ''), '10A4');

      insert into public.timetables (class_name, effective_from, subjects, days, updated_at)
      values (
        class_name_value,
        case when source_value->>'effectiveFrom' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          then (source_value->>'effectiveFrom')::date else null end,
        case when jsonb_typeof(source_value->'subjects') = 'array' then source_value->'subjects' else '[]'::jsonb end,
        case when jsonb_typeof(source_value->'days') = 'array' then source_value->'days' else '[]'::jsonb end,
        case when pg_input_is_valid(source_value->>'updatedAt', 'timestamptz')
          then (source_value->>'updatedAt')::timestamptz else now() end
      )
      on conflict (class_name) do nothing;

      select id into timetable_id from public.timetables where class_name = class_name_value;

      foreach session_name in array array['morning'::text, 'afternoon'::text] loop
        source_session := case when jsonb_typeof(source_value->session_name) = 'object'
          then source_value->session_name else '{}'::jsonb end;
        insert into public.timetable_sessions (
          timetable_id, session, label, days_note, arrival,
          has_flag_ceremony, flag_ceremony_configured, flag_ceremony_time, flag_ceremony_note
        )
        values (
          timetable_id, session_name,
          coalesce(source_session->>'label', ''),
          coalesce(source_session->>'daysNote', ''),
          case when source_session->>'arrival' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            then source_session->>'arrival' else '' end,
          jsonb_typeof(source_session->'flagCeremony') = 'object',
          source_session ? 'flagCeremony',
          case when source_session->'flagCeremony'->>'time' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            then source_session->'flagCeremony'->>'time' else null end,
          nullif(source_session->'flagCeremony'->>'note', '')
        )
        on conflict (timetable_id, session) do nothing;

        insert into public.timetable_periods (timetable_id, session, period_id, start_time, end_time, note)
        select timetable_id, session_name,
          case when item->>'id' ~ '^[1-8]$' then (item->>'id')::smallint else ordinality::smallint end,
          case when item->>'start' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then item->>'start' else '00:00' end,
          case when item->>'end' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then item->>'end' else '00:00' end,
          nullif(item->>'note', '')
        from jsonb_array_elements(
          case when jsonb_typeof(source_session->'periods') = 'array' then source_session->'periods' else '[]'::jsonb end
        ) with ordinality as periods(item, ordinality)
        where ordinality <= 8
        on conflict (timetable_id, session, period_id) do nothing;

        insert into public.timetable_breaks (timetable_id, session, after_period, start_time, end_time, label)
        select timetable_id, session_name,
          case when item->>'after' ~ '^[1-8]$' then (item->>'after')::smallint else 2 end,
          case when item->>'start' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then item->>'start' else '00:00' end,
          case when item->>'end' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then item->>'end' else '00:00' end,
          coalesce(nullif(item->>'label', ''), 'Giải lao')
        from jsonb_array_elements(
          case when jsonb_typeof(source_session->'breaks') = 'array' then source_session->'breaks' else '[]'::jsonb end
        ) with ordinality as breaks(item, ordinality)
        where ordinality <= 4
        on conflict (timetable_id, session, after_period) do nothing;

        insert into public.timetable_entries (timetable_id, session, day_id, period_id, subject)
        select timetable_id, session_name, grid.key, cells.ordinality::smallint, coalesce(cells.value #>> '{}', '')
        from jsonb_each(
          case when jsonb_typeof(source_session->'grid') = 'object' then source_session->'grid' else '{}'::jsonb end
        ) as grid(key, value)
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(grid.value) = 'array' then grid.value else '[]'::jsonb end
        ) with ordinality as cells(value, ordinality)
        where grid.key in ('t2', 't3', 't4', 't5', 't6', 't7') and cells.ordinality <= 8
        on conflict (timetable_id, session, day_id, period_id) do nothing;
      end loop;

      source_notice := case when jsonb_typeof(source_value->'changeNotice') = 'object'
        then source_value->'changeNotice' else '{}'::jsonb end;
      insert into public.timetable_change_notices (
        timetable_id, active, has_changes, date_from, date_to, summary, lines, created_at
      )
      values (
        timetable_id,
        source_notice->>'active' = 'true',
        source_notice->>'hasChanges' = 'true',
        case when coalesce(source_notice->>'from', source_notice->>'dateFrom') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          then coalesce(source_notice->>'from', source_notice->>'dateFrom')::date else null end,
        case when coalesce(source_notice->>'to', source_notice->>'dateTo') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          then coalesce(source_notice->>'to', source_notice->>'dateTo')::date else null end,
        coalesce(nullif(source_notice->>'summary', ''), 'Chưa có sự thay đổi'),
        case when jsonb_typeof(source_notice->'lines') = 'array' then source_notice->'lines' else '[]'::jsonb end,
        case when pg_input_is_valid(source_notice->>'createdAt', 'timestamptz')
          then (source_notice->>'createdAt')::timestamptz else now() end
      )
      on conflict (timetable_id) do nothing;
    end if;
  end if;
end $$;

alter table public.timetables enable row level security;
alter table public.timetable_sessions enable row level security;
alter table public.timetable_periods enable row level security;
alter table public.timetable_breaks enable row level security;
alter table public.timetable_entries enable row level security;
alter table public.timetable_change_notices enable row level security;
revoke all on public.timetables, public.timetable_sessions, public.timetable_periods,
  public.timetable_breaks, public.timetable_entries, public.timetable_change_notices from anon, authenticated;
grant all on public.timetables, public.timetable_sessions, public.timetable_periods,
  public.timetable_breaks, public.timetable_entries, public.timetable_change_notices to service_role;
