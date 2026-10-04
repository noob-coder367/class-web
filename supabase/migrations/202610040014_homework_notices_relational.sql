-- Relational persistence for homework notices. The legacy classroom_store row
-- remains a read-only source. Announcements use the existing production UUID ID.
begin;

create table if not exists public.homework_notices (
  id text primary key check (length(trim(id)) between 1 and 200),
  title text not null default 'Báo bài',
  report_date date,
  has_exam boolean not null default false,
  exam_date date,
  exam_subject text not null default '',
  exam_content text not null default '',
  experiment_content text not null default '',
  homework_content text not null default '',
  exam_announcement_id uuid references public.announcements(id) on delete set null,
  announcement_short_id integer check (announcement_short_id is null or announcement_short_id > 0),
  exam_today_notified_at timestamptz,
  exam_cleared_at timestamptz,
  created_at timestamptz not null default now(),
  created_by text,
  created_by_name text not null default 'Admin'
);

-- Add absent columns without changing any pre-existing column types.
alter table public.homework_notices add column if not exists title text;
alter table public.homework_notices add column if not exists report_date date;
alter table public.homework_notices add column if not exists has_exam boolean;
alter table public.homework_notices add column if not exists exam_date date;
alter table public.homework_notices add column if not exists exam_subject text;
alter table public.homework_notices add column if not exists exam_content text;
alter table public.homework_notices add column if not exists experiment_content text;
alter table public.homework_notices add column if not exists homework_content text;
alter table public.homework_notices add column if not exists exam_announcement_id uuid;
alter table public.homework_notices add column if not exists announcement_short_id integer;
alter table public.homework_notices add column if not exists exam_today_notified_at timestamptz;
alter table public.homework_notices add column if not exists exam_cleared_at timestamptz;
alter table public.homework_notices add column if not exists created_at timestamptz;
alter table public.homework_notices add column if not exists created_by text;
alter table public.homework_notices add column if not exists created_by_name text;

-- If a partial/manual installation has a text announcement reference, retain
-- it under an explicit legacy name and map only valid UUID strings. Invalid or
-- orphaned old values remain available in the legacy text column.
do $$
declare
  reference_type oid;
  has_legacy_column boolean;
begin
  select a.atttypid into reference_type from pg_attribute a
   where a.attrelid='public.homework_notices'::regclass
     and a.attname='exam_announcement_id' and a.attnum > 0 and not a.attisdropped;
  select exists (select 1 from pg_attribute a
    where a.attrelid='public.homework_notices'::regclass
      and a.attname='exam_announcement_id_legacy_text' and a.attnum > 0 and not a.attisdropped)
    into has_legacy_column;

  if reference_type='text'::regtype then
    if has_legacy_column then
      raise exception 'Both text exam_announcement_id and exam_announcement_id_legacy_text exist; inspect this partial state before rerunning.';
    end if;
    alter table public.homework_notices rename column exam_announcement_id to exam_announcement_id_legacy_text;
    alter table public.homework_notices alter column exam_announcement_id_legacy_text drop not null;
    alter table public.homework_notices add column exam_announcement_id uuid;
  elsif reference_type is distinct from 'uuid'::regtype then
    raise exception 'public.homework_notices.exam_announcement_id must be uuid or legacy text; found %. No type conversion was attempted.',
      coalesce(format_type(reference_type, null), '<missing>');
  end if;

  if exists (select 1 from pg_attribute a where a.attrelid='public.homework_notices'::regclass
       and a.attname='exam_announcement_id_legacy_text' and a.attnum > 0 and not a.attisdropped) then
    update public.homework_notices
       set exam_announcement_id = exam_announcement_id_legacy_text::uuid
     where exam_announcement_id is null
       and btrim(exam_announcement_id_legacy_text) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  end if;
end $$;

create index if not exists homework_notices_created_idx on public.homework_notices (created_at desc, id);
create index if not exists homework_notices_report_date_idx on public.homework_notices (report_date desc, created_at desc);
create index if not exists homework_notices_exam_date_idx on public.homework_notices (exam_date, has_exam) where has_exam;

-- Ensure UUID -> UUID FK. NOT VALID permits preserved historical orphan UUIDs
-- while enforcing future references; no existing notice is deleted.
do $$
declare
  child_attnum smallint;
  parent_attnum smallint;
  wrong_fk boolean;
begin
  select attnum into child_attnum from pg_attribute where attrelid='public.homework_notices'::regclass
    and attname='exam_announcement_id' and not attisdropped;
  select attnum into parent_attnum from pg_attribute where attrelid='public.announcements'::regclass
    and attname='id' and not attisdropped;
  if parent_attnum is null then
    raise exception 'public.announcements.id is missing; run and verify corrected migration 003 before 014.';
  end if;
  if (select atttypid from pg_attribute where attrelid='public.announcements'::regclass and attname='id') <> 'uuid'::regtype then
    raise exception 'public.announcements.id must be uuid before migration 014.';
  end if;
  if (select atttypid from pg_attribute where attrelid='public.homework_notices'::regclass and attname='exam_announcement_id') <> 'uuid'::regtype then
    raise exception 'public.homework_notices.exam_announcement_id must be uuid before adding the FK.';
  end if;

  select exists (
    select 1 from pg_constraint c where c.conrelid='public.homework_notices'::regclass and c.contype='f'
      and c.conkey=array[child_attnum]::smallint[]
      and (c.confrelid <> 'public.announcements'::regclass or c.confkey <> array[parent_attnum]::smallint[])
  ) into wrong_fk;
  if wrong_fk then
    raise exception 'homework_notices.exam_announcement_id has an unrelated existing FK; inspect before retrying.';
  end if;
  if not exists (
    select 1 from pg_constraint c where c.conrelid='public.homework_notices'::regclass and c.contype='f'
      and c.conkey=array[child_attnum]::smallint[]
      and c.confrelid='public.announcements'::regclass and c.confkey=array[parent_attnum]::smallint[]
  ) then
    alter table public.homework_notices
      add constraint homework_notices_exam_announcement_id_fkey
      foreign key (exam_announcement_id) references public.announcements(id)
      on delete set null not valid;
  end if;
end $$;

-- Backfill valid source IDs only. Invalid announcement IDs are set NULL in the
-- relational FK column and remain unchanged in classroom_store for review.
do $$
declare
  source_value jsonb;
  item jsonb;
  raw_id text;
  raw_exam_id text;
  mapped_exam_id uuid;
begin
  if to_regclass('public.classroom_store') is null then
    raise notice 'classroom_store absent: homework notice backfill skipped';
    return;
  end if;
  select value into source_value from public.classroom_store where key='homework';
  if jsonb_typeof(source_value->'items') is distinct from 'array' then
    raise notice 'classroom_store.homework.items is not an array; no homework notices copied';
    return;
  end if;

  for item in select value from jsonb_array_elements(source_value->'items') as x(value)
  loop
    raw_id := nullif(btrim(item->>'id'), '');
    if jsonb_typeof(item) <> 'object' or raw_id is null or char_length(raw_id) > 200 then
      raise notice 'Skipped homework notice with missing/oversized ID; source retained';
      continue;
    end if;
    raw_exam_id := nullif(btrim(item->>'exam_announcement_id'), '');
    mapped_exam_id := null;
    if raw_exam_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      mapped_exam_id := raw_exam_id::uuid;
      if not exists (select 1 from public.announcements a where a.id=mapped_exam_id) then
        raise notice 'Homework notice % references missing announcement UUID %; relationship left NULL and source retained', raw_id, raw_exam_id;
        mapped_exam_id := null;
      end if;
    elsif raw_exam_id is not null then
      raise notice 'Homework notice % has non-UUID announcement reference; relationship left NULL and source retained', raw_id;
    end if;

    insert into public.homework_notices (
      id,title,report_date,has_exam,exam_date,exam_subject,exam_content,experiment_content,homework_content,
      exam_announcement_id,announcement_short_id,exam_today_notified_at,exam_cleared_at,created_at,created_by,created_by_name
    ) values (
      raw_id, coalesce(nullif(btrim(item->>'title'), ''),'Báo bài'),
      case when pg_input_is_valid(item->>'report_date','date') then (item->>'report_date')::date else null end,
      item->>'has_exam' = 'true',
      case when pg_input_is_valid(item->>'exam_date','date') then (item->>'exam_date')::date else null end,
      coalesce(item->>'exam_subject',''), coalesce(item->>'exam_content',''),
      coalesce(item->>'experiment_content',''), coalesce(item->>'homework_content',''),
      mapped_exam_id,
      case when pg_input_is_valid(item->>'announcement_short_id','integer')
          and item->>'announcement_short_id' ~ '^[1-9][0-9]*$'
        then (item->>'announcement_short_id')::integer else null end,
      case when pg_input_is_valid(item->>'exam_today_notified_at','timestamptz') then (item->>'exam_today_notified_at')::timestamptz else null end,
      case when pg_input_is_valid(item->>'exam_cleared_at','timestamptz') then (item->>'exam_cleared_at')::timestamptz else null end,
      case when pg_input_is_valid(item->>'created_at','timestamptz') then (item->>'created_at')::timestamptz else now() end,
      nullif(item->>'created_by',''), coalesce(nullif(btrim(item->>'created_by_name'),''),'Admin')
    ) on conflict (id) do nothing;
  end loop;
end $$;

alter table public.homework_notices enable row level security;
revoke all on public.homework_notices from public, anon, authenticated;
grant all on public.homework_notices to service_role;
comment on table public.homework_notices is 'Structured homework/exam notices; legacy classroom_store.homework remains an immutable backup.';
notify pgrst, 'reload schema';
commit;
