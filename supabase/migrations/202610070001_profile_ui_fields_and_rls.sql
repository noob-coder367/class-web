-- Hồ sơ cho trang "Thông tin cá nhân" + siết RLS.
-- Lưu ý: migration này ĐÃ được chạy trên project Supabase hiện tại (chạy lại an toàn, idempotent).

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists gender text,
  add column if not exists province text,
  add column if not exists school text,
  add column if not exists phone text,
  add column if not exists facebook_url text;

alter table public.profiles drop constraint if exists profiles_profile_fields_check;
alter table public.profiles add constraint profiles_profile_fields_check check (
  (full_name is null or char_length(full_name) between 2 and 60)
  and (gender is null or gender in ('male', 'female', 'other'))
  and (province is null or char_length(province) <= 80)
  and (school is null or char_length(school) <= 120)
  and (phone is null or phone ~ '^(0|\+84)[0-9]{9}$')
  and (facebook_url is null or (char_length(facebook_url) <= 300 and facebook_url ~* '^https?://'))
);

update public.profiles
set full_name = username
where full_name is null
  and username is not null
  and username not like 'account-%'
  and char_length(username) between 2 and 60;

alter table public.profiles enable row level security;

-- Policy cũ cho phép ai cũng đọc được toàn bộ profiles -> bỏ.
drop policy if exists "Cho phap moi nguoi xem profiles" on public.profiles;
drop policy if exists "Cho phap user tao profile" on public.profiles;
drop policy if exists "Cho phap user cap nhat profile" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- User chỉ được sửa 6 cột hồ sơ (không sửa được role, email, is_member...).
revoke all on table public.profiles from anon;
revoke insert, update, delete on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, gender, province, school, phone, facebook_url) on table public.profiles to authenticated;
grant all on table public.profiles to service_role;
