-- Bounded-memory Class Money overview aggregates (run after class-money-schema.sql).
create or replace function public.class_money_overview_totals(p_book_id uuid)
returns table(total_collected numeric, total_owed numeric, total_change numeric, total_expense numeric)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce((select sum(m.amount_paid) from public.class_money_collections c
      join public.class_money_collection_members m on m.collection_id = c.id
      where c.book_id = p_book_id), 0),
    coalesce((select sum(m.amount_owed) from public.class_money_collections c
      join public.class_money_collection_members m on m.collection_id = c.id
      where c.book_id = p_book_id), 0),
    coalesce((select sum(m.amount_change) from public.class_money_collections c
      join public.class_money_collection_members m on m.collection_id = c.id
      where c.book_id = p_book_id), 0),
    coalesce((select sum(e.amount) from public.class_money_expenses e
      where e.book_id = p_book_id and e.deleted_at is null), 0)
$$;
revoke all on function public.class_money_overview_totals(uuid) from public, anon, authenticated;
grant execute on function public.class_money_overview_totals(uuid) to service_role;

notify pgrst, 'reload schema';
