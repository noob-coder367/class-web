-- Quizly foundation: keep profiles + privilege protection, drop class VP roles.
-- Does not create quiz/game schema. Safe to re-run.

alter table if exists public.profiles enable row level security;

do $$
begin
  if to_regclass('public.profiles') is null then
    raise notice 'public.profiles is missing; auth foundation schema must already exist';
    return;
  end if;

  revoke all on table public.profiles from anon;
  revoke insert, delete on table public.profiles from authenticated;
  grant select, update on table public.profiles to authenticated;
  grant all on table public.profiles to service_role;

  drop policy if exists "profiles_select_public" on public.profiles;
  drop policy if exists "profiles_insert_public" on public.profiles;
  drop policy if exists "profiles_update_public" on public.profiles;
  drop policy if exists "Enable read access for all users" on public.profiles;
  drop policy if exists "Enable insert for authenticated users only" on public.profiles;
  drop policy if exists "Enable update for users based on email" on public.profiles;

  drop policy if exists "profiles_select_own" on public.profiles;
  create policy "profiles_select_own"
    on public.profiles
    for select
    to authenticated
    using (auth.uid() = id);

  drop policy if exists "profiles_update_own" on public.profiles;
  create policy "profiles_update_own"
    on public.profiles
    for update
    to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);

  -- Keep constraint applyable if leftover VP roles still exist.
  update public.profiles
  set role = 'user'
  where coalesce(role, '') not in ('admin', 'user');
end $$;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Không được tự ý đổi vai trò';
  end if;
  if new.is_member is distinct from old.is_member then
    raise exception 'Không được tự ý đổi trạng thái thành viên';
  end if;
  if new.id is distinct from old.id then
    raise exception 'Không được đổi id hồ sơ';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_privileges on public.profiles;
create trigger trg_protect_profile_privileges
  before update on public.profiles
  for each row
  execute function public.protect_profile_privileges();

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'user'));
