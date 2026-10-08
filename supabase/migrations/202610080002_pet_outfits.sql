-- Persist one pet outfit per authenticated user and keep all rows private.
create table if not exists public.pet_outfits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  hat text,
  acc text,
  shirt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pet_outfits enable row level security;

revoke all on table public.pet_outfits from anon;
revoke all on table public.pet_outfits from authenticated;
grant select, insert, update on table public.pet_outfits to authenticated;
grant all on table public.pet_outfits to service_role;

drop policy if exists "pet_outfits_select_own" on public.pet_outfits;
create policy "pet_outfits_select_own"
  on public.pet_outfits
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "pet_outfits_insert_own" on public.pet_outfits;
create policy "pet_outfits_insert_own"
  on public.pet_outfits
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "pet_outfits_update_own" on public.pet_outfits;
create policy "pet_outfits_update_own"
  on public.pet_outfits
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_pet_outfits_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pet_outfits_updated_at on public.pet_outfits;
create trigger trg_pet_outfits_updated_at
  before update on public.pet_outfits
  for each row
  execute function public.set_pet_outfits_updated_at();
