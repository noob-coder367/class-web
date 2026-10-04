-- Atomic collection-member payment update, ledger transaction and audit row.
-- Run after class-money-schema.sql and 202610040011_class_money_overview.sql.
create or replace function public.class_money_update_member_payment(
  p_member_id uuid,
  p_expected_updated_at timestamptz,
  p_amount_paid bigint,
  p_note text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.class_money_collection_members%rowtype;
  v_updated public.class_money_collection_members%rowtype;
  v_collection public.class_money_collections%rowtype;
  v_owed bigint;
  v_change bigint;
  v_status text;
  v_delta bigint;
begin
  if p_amount_paid is null or p_amount_paid < 0 then
    raise exception using errcode = '22023', message = 'INVALID_AMOUNT';
  end if;
  select * into v_old from public.class_money_collection_members where id = p_member_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'MEMBER_NOT_FOUND'; end if;
  if v_old.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'STALE_CLASS_MONEY_DATA';
  end if;
  select * into v_collection from public.class_money_collections where id = v_old.collection_id;
  if not found then raise exception using errcode = 'P0002', message = 'COLLECTION_NOT_FOUND'; end if;

  v_owed := greatest(v_old.amount_due - p_amount_paid, 0);
  v_change := greatest(p_amount_paid - v_old.amount_due, 0);
  v_status := case when p_amount_paid = 0 then 'unpaid'
    when v_owed > 0 then 'debt' when v_change > 0 then 'change' else 'paid' end;
  update public.class_money_collection_members set
    amount_paid = p_amount_paid, amount_owed = v_owed, amount_change = v_change,
    status = v_status, note = coalesce(p_note, ''),
    paid_at = case when p_amount_paid > 0 then coalesce(v_old.paid_at, now()) else null end,
    paid_by = case when p_amount_paid > 0 then p_actor_id else null end,
    updated_at = now()
  where id = p_member_id returning * into v_updated;

  v_delta := p_amount_paid - v_old.amount_paid;
  if v_delta > 0 then
    insert into public.class_money_transactions(book_id,type,amount,profile_id,collection_id,description,created_by)
    values(v_collection.book_id,'income',v_delta,v_old.profile_id,v_old.collection_id,
      'Thu tiền ' || v_old.display_name_snapshot || ' · ' || v_collection.name,p_actor_id);
  elsif v_delta < 0 then
    insert into public.class_money_transactions(book_id,type,amount,profile_id,collection_id,description,created_by)
    values(v_collection.book_id,'refund',abs(v_delta),v_old.profile_id,v_old.collection_id,
      'Điều chỉnh tiền ' || v_old.display_name_snapshot || ' · ' || v_collection.name,p_actor_id);
  end if;
  insert into public.class_money_audit_logs(book_id,actor_id,action,entity_type,entity_id,old_data,new_data)
  values(v_collection.book_id,p_actor_id,'update','collection_member',v_old.id,to_jsonb(v_old),to_jsonb(v_updated));
  return to_jsonb(v_updated);
end $$;
revoke all on function public.class_money_update_member_payment(uuid,timestamptz,bigint,text,uuid) from public, anon, authenticated;
grant execute on function public.class_money_update_member_payment(uuid,timestamptz,bigint,text,uuid) to service_role;
notify pgrst, 'reload schema';
