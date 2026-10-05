-- Atomic, multi-instance-safe announcement numbers; run after 202610040003_announcements_relational.sql.
create table if not exists public.announcement_short_id_counters (
  document_kind text primary key check (document_kind in ('thong_bao','bao_cao')),
  next_short_id integer not null check (next_short_id > 0),
  updated_at timestamptz not null default now()
);
insert into public.announcement_short_id_counters(document_kind,next_short_id)
select kinds.document_kind, coalesce(max(a.short_id),0)::integer + 1
from (values ('thong_bao'::text),('bao_cao'::text)) as kinds(document_kind)
left join public.announcements a on a.document_kind = kinds.document_kind
group by kinds.document_kind
on conflict (document_kind) do update
set next_short_id = greatest(public.announcement_short_id_counters.next_short_id, excluded.next_short_id), updated_at = now();

create or replace function public.allocate_announcement_short_id(p_document_kind text)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_result integer;
begin
  if p_document_kind not in ('thong_bao','bao_cao') then
    raise exception using errcode = '22023', message = 'INVALID_DOCUMENT_KIND';
  end if;
  insert into public.announcement_short_id_counters(document_kind,next_short_id)
  values(p_document_kind,2)
  on conflict (document_kind) do update
    set next_short_id = public.announcement_short_id_counters.next_short_id + 1, updated_at = now()
  returning next_short_id - 1 into v_result;
  return v_result;
end $$;

alter table public.announcement_short_id_counters enable row level security;
revoke all on public.announcement_short_id_counters from public, anon, authenticated;
grant all on public.announcement_short_id_counters to service_role;
revoke all on function public.allocate_announcement_short_id(text) from public, anon, authenticated;
grant execute on function public.allocate_announcement_short_id(text) to service_role;
notify pgrst, 'reload schema';
