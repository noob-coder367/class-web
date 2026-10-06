-- MANUAL production reset for Quizly foundation.
-- Run once in Supabase Dashboard → SQL Editor on project ckcolzvopsgbwlsihjcj.
-- Does NOT reset the whole project. Preserves the admin account below.
--
-- Admin to keep:
--   email: phamtung23052011@gmail.com
--   user id: 947bb093-2ba2-4b22-954f-d02c5d7e622d
--   role: admin
--   is_member: true

begin;

-- 0) Abort if the admin identity is missing.
do $$
declare
  v_admin_id constant uuid := '947bb093-2ba2-4b22-954f-d02c5d7e622d';
  v_admin_email constant text := 'phamtung23052011@gmail.com';
  v_auth_email text;
begin
  select email into v_auth_email from auth.users where id = v_admin_id;
  if v_auth_email is null then
    raise exception 'ABORT: admin auth user % is missing', v_admin_id;
  end if;
  if lower(v_auth_email) <> v_admin_email then
    raise exception 'ABORT: admin auth email mismatch (%).', v_auth_email;
  end if;

  if not exists (select 1 from public.profiles where id = v_admin_id) then
    raise exception 'ABORT: admin profile % is missing', v_admin_id;
  end if;
end $$;

-- 1) Drop leftover class-management / AI functions and tables.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as proc
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'ai_reserve_daily_quota',
        'ai_release_daily_quota',
        'ai_get_daily_quota',
        'claim_ai_grading_job',
        'recover_stuck_ai_grading_jobs',
        'class_exam_summary',
        'class_exam_start',
        'class_exam_commit_submission',
        'homework_assignment_summary',
        'homework_commit_submission',
        'class_money_overview_totals',
        'class_money_update_member_payment',
        'allocate_announcement_short_id',
        'replace_class_space',
        'list_class_space_creators',
        'replace_utility_roster',
        'submit_class_space_result',
        'get_class_space_leaderboard',
        'rules_member_violation_totals',
        'ghost_preview_account',
        'ghost_reserve_account',
        'ghost_finalize_account',
        'ghost_release_reservation',
        'ghost_rollback_account',
        'change_display_name',
        'set_cleaning_duty_updated_at'
      )
  loop
    execute format('drop function if exists %s cascade', r.proc);
  end loop;
end $$;

drop table if exists public.ai_grading_attempt_history cascade;
drop table if exists public.ai_grading_reviews cascade;
drop table if exists public.ai_grading_jobs cascade;
drop table if exists public.ai_messages cascade;
drop table if exists public.ai_conversations cascade;
drop table if exists public.ai_daily_usage cascade;
drop table if exists public.ai_quota cascade;
drop table if exists public.class_exam_questions cascade;
drop table if exists public.class_exam_upload_intent_files cascade;
drop table if exists public.class_exam_upload_intents cascade;
drop table if exists public.class_exam_submissions cascade;
drop table if exists public.class_exam_attempts cascade;
drop table if exists public.class_exams cascade;
drop table if exists public.homework_upload_intent_files cascade;
drop table if exists public.homework_upload_intents cascade;
drop table if exists public.homework_submissions cascade;
drop table if exists public.homework_assignments cascade;
drop table if exists public.homework_notices cascade;
drop table if exists public.announcement_images cascade;
drop table if exists public.announcement_short_id_counters cascade;
drop table if exists public.announcements cascade;
drop table if exists public.timetable_entries cascade;
drop table if exists public.timetable_change_notices cascade;
drop table if exists public.timetable_breaks cascade;
drop table if exists public.timetable_periods cascade;
drop table if exists public.timetable_sessions cascade;
drop table if exists public.timetables cascade;
drop table if exists public.rule_violation_photos cascade;
drop table if exists public.rule_violations cascade;
drop table if exists public.rule_rankings cascade;
drop table if exists public.rule_items cascade;
drop table if exists public.rule_sections cascade;
drop table if exists public.rules_settings cascade;
drop table if exists public.class_roster_members cascade;
drop table if exists public.class_rosters cascade;
drop table if exists public.class_space_attempts cascade;
drop table if exists public.class_space_results cascade;
drop table if exists public.class_space_editors cascade;
drop table if exists public.class_space_questions cascade;
drop table if exists public.class_spaces cascade;
drop table if exists public.utility_roster_members cascade;
drop table if exists public.utility_rosters cascade;
drop table if exists public.cleaning_duty_upload_intent_files cascade;
drop table if exists public.cleaning_duty_upload_intents cascade;
drop table if exists public.cleaning_duty_photos cascade;
drop table if exists public.cleaning_duty_reviews cascade;
drop table if exists public.cleaning_duty_status cascade;
drop table if exists public.cleaning_duty_schedule cascade;
drop table if exists public.cleaning_duty_days cascade;
drop table if exists public.cleaning_duty_media cascade;
drop table if exists public.class_money_audit_logs cascade;
drop table if exists public.class_money_transactions cascade;
drop table if exists public.class_money_expenses cascade;
drop table if exists public.class_money_collection_members cascade;
drop table if exists public.class_money_collections cascade;
drop table if exists public.class_money_members cascade;
drop table if exists public.class_money_books cascade;
drop table if exists public.push_preferences cascade;
drop table if exists public.push_subscriptions cascade;
drop table if exists public.resource_files cascade;
drop table if exists public.resources cascade;
drop table if exists public.resource_categories cascade;
drop table if exists public.ghost_account_reservations cascade;
drop table if exists public.ghost_account_creations cascade;
drop table if exists public.ghost_account_sequence cascade;
drop table if exists public.username_changes cascade;
drop table if exists public.classroom_store cascade;
drop table if exists public.presentations cascade;
drop table if exists public.presentation_slides cascade;
drop table if exists public.events cascade;

-- 2) Delete leftover app rows except the admin profile.
delete from public.profiles
where id <> '947bb093-2ba2-4b22-954f-d02c5d7e622d';

update public.profiles
set
  role = 'admin',
  is_member = true,
  email = 'phamtung23052011@gmail.com',
  updated_at = now()
where id = '947bb093-2ba2-4b22-954f-d02c5d7e622d';

-- 3) Delete leftover Auth users except admin. SQL Editor runs as postgres.
delete from auth.users
where id <> '947bb093-2ba2-4b22-954f-d02c5d7e622d';

-- 4) Remove class-management files from Storage. Keep the bucket itself.
delete from storage.objects
where bucket_id = 'classroom-data';

-- 5) profiles RLS for the Quizly auth foundation.
alter table public.profiles enable row level security;
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
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

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

commit;

-- 6) Verify after commit.
select
  (select count(*) from auth.users) as auth_users,
  (select id from auth.users limit 1) as remaining_auth_id,
  (select email from auth.users limit 1) as remaining_auth_email,
  (select count(*) from public.profiles) as profiles,
  (select role from public.profiles where id = '947bb093-2ba2-4b22-954f-d02c5d7e622d') as admin_role,
  (select is_member from public.profiles where id = '947bb093-2ba2-4b22-954f-d02c5d7e622d') as admin_is_member,
  (select count(*) from storage.objects where bucket_id = 'classroom-data') as classroom_data_files;
