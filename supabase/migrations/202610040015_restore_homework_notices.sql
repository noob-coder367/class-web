-- Restore structured homework notices from the immutable legacy store.
-- Insert-only: existing rows and announcements are preserved; reruns are safe.
insert into public.homework_notices (
  id,
  title,
  report_date,
  has_exam,
  exam_date,
  exam_subject,
  exam_content,
  experiment_content,
  homework_content,
  exam_announcement_id,
  announcement_short_id,
  exam_today_notified_at,
  exam_cleared_at,
  created_at,
  created_by,
  created_by_name
)
select
  (item->>'id')::uuid,
  coalesce(nullif(item->>'title', ''), 'Báo bài'),
  nullif(item->>'report_date', '')::date,
  coalesce((item->>'has_exam')::boolean, false),
  nullif(item->>'exam_date', '')::date,
  coalesce(item->>'exam_subject', ''),
  coalesce(item->>'exam_content', ''),
  coalesce(item->>'experiment_content', ''),
  coalesce(item->>'homework_content', ''),
  case
    when item->>'exam_announcement_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (item->>'exam_announcement_id')::uuid
    else null
  end,
  case when nullif(item->>'announcement_short_id', '') is null then null else (item->>'announcement_short_id')::integer end,
  nullif(item->>'exam_today_notified_at', '')::timestamptz,
  nullif(item->>'exam_cleared_at', '')::timestamptz,
  coalesce(nullif(item->>'created_at', '')::timestamptz, now()),
  nullif(item->>'created_by', ''),
  coalesce(nullif(item->>'created_by_name', ''), 'Admin')
from public.classroom_store store
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(store.value->'items') = 'array' then store.value->'items' else '[]'::jsonb end
) as items(item)
where store.key = 'homework'
  and nullif(item->>'id', '') is not null
on conflict (id) do nothing;
