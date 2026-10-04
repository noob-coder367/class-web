-- Relational persistence for homework notices. Legacy classroom_store.homework is read-only source.
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
  exam_announcement_id text references public.announcements(id) on delete set null,
  announcement_short_id integer check (announcement_short_id is null or announcement_short_id > 0),
  exam_today_notified_at timestamptz,
  exam_cleared_at timestamptz,
  created_at timestamptz not null default now(),
  created_by text,
  created_by_name text not null default 'Admin'
);
create index if not exists homework_notices_created_idx on public.homework_notices (created_at desc, id);
create index if not exists homework_notices_report_date_idx on public.homework_notices (report_date desc, created_at desc);
create index if not exists homework_notices_exam_date_idx on public.homework_notices (exam_date, has_exam) where has_exam;

-- Backfill the exact legacy key, insert-only and conflict-safe.
do $$
begin
  if to_regclass('public.classroom_store') is null then
    raise notice 'classroom_store absent: homework backfill skipped';
    return;
  end if;
  insert into public.homework_notices (
    id,title,report_date,has_exam,exam_date,exam_subject,exam_content,experiment_content,homework_content,
    exam_announcement_id,announcement_short_id,exam_today_notified_at,exam_cleared_at,created_at,created_by,created_by_name
  )
  select
    left(btrim(item->>'id'),200), coalesce(nullif(btrim(item->>'title'), ''),'Báo bài'),
    case when pg_input_is_valid(item->>'report_date','date') then (item->>'report_date')::date else null end,
    item->>'has_exam' = 'true',
    case when pg_input_is_valid(item->>'exam_date','date') then (item->>'exam_date')::date else null end,
    coalesce(item->>'exam_subject',''), coalesce(item->>'exam_content',''),
    coalesce(item->>'experiment_content',''), coalesce(item->>'homework_content',''),
    case when exists (select 1 from public.announcements a where a.id=item->>'exam_announcement_id') then item->>'exam_announcement_id' else null end,
    case when item->>'announcement_short_id' ~ '^[1-9][0-9]{0,8}$' then (item->>'announcement_short_id')::integer else null end,
    case when pg_input_is_valid(item->>'exam_today_notified_at','timestamptz') then (item->>'exam_today_notified_at')::timestamptz else null end,
    case when pg_input_is_valid(item->>'exam_cleared_at','timestamptz') then (item->>'exam_cleared_at')::timestamptz else null end,
    case when pg_input_is_valid(item->>'created_at','timestamptz') then (item->>'created_at')::timestamptz else now() end,
    nullif(item->>'created_by',''), coalesce(nullif(btrim(item->>'created_by_name'),''),'Admin')
  from public.classroom_store store
  cross join lateral jsonb_array_elements(case when jsonb_typeof(store.value->'items')='array' then store.value->'items' else '[]'::jsonb end) item
  where store.key='homework' and nullif(btrim(item->>'id'),'') is not null
  on conflict (id) do nothing;
end $$;

alter table public.homework_notices enable row level security;
revoke all on public.homework_notices from public, anon, authenticated;
grant all on public.homework_notices to service_role;
drop policy if exists homework_notices_no_client_access on public.homework_notices;
comment on table public.homework_notices is 'Structured homework/exam notices; legacy classroom_store.homework remains a backup.';
notify pgrst, 'reload schema';
