-- Additive, backend-only queue for asynchronous AI grading. Do not run automatically.
create table if not exists public.ai_grading_jobs (
  id uuid primary key default gen_random_uuid(),
  submission_type text not null check (submission_type in ('homework', 'exam')),
  submission_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assignment_id uuid references public.homework_assignments(id) on delete cascade,
  exam_id uuid references public.class_exams(id) on delete cascade,
  files jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','rate_limited','needs_review')),
  model_used text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  error_message text,
  result jsonb,
  locked_at timestamptz,
  locked_by text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint ai_grading_jobs_submission_once unique (submission_type, submission_id),
  constraint ai_grading_jobs_owner_check check ((submission_type = 'homework' and assignment_id is not null and exam_id is null) or (submission_type = 'exam' and exam_id is not null and assignment_id is null))
);
create index if not exists ai_grading_jobs_poll_idx on public.ai_grading_jobs(status, next_attempt_at, created_at) where status in ('pending', 'rate_limited');
create index if not exists ai_grading_jobs_user_idx on public.ai_grading_jobs(user_id, created_at desc);

alter table public.ai_grading_jobs enable row level security;
revoke all on public.ai_grading_jobs from anon, authenticated;
grant all on public.ai_grading_jobs to service_role;

create or replace function public.claim_ai_grading_job(p_max_attempts integer default 3)
returns setof public.ai_grading_jobs
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_job public.ai_grading_jobs%rowtype;
begin
  select * into v_job from public.ai_grading_jobs
  where status in ('pending', 'rate_limited') and next_attempt_at <= now() and attempt_count < greatest(1, p_max_attempts)
  order by next_attempt_at, created_at for update skip locked limit 1;
  if not found then return; end if;
  update public.ai_grading_jobs set status = 'processing', attempt_count = attempt_count + 1,
    locked_at = now(), locked_by = current_setting('application_name', true), updated_at = now()
  where id = v_job.id returning * into v_job;
  return next v_job;
end;
$$;
revoke all on function public.claim_ai_grading_job(integer) from public, anon, authenticated;
grant execute on function public.claim_ai_grading_job(integer) to service_role;

notify pgrst, 'reload schema';
