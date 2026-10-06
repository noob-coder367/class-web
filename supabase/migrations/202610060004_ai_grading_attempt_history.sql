-- Additive audit history for explicit teacher/admin re-grade requests.
-- Do not run automatically; preserves the original AI result before a job is reset.
create table if not exists public.ai_grading_attempt_history (
  id uuid primary key default gen_random_uuid(),
  grading_job_id uuid not null references public.ai_grading_jobs(id) on delete cascade,
  submission_type text not null check (submission_type in ('homework', 'exam')),
  submission_id uuid not null,
  attempt_count integer not null check (attempt_count >= 0),
  status text not null check (status in ('pending', 'processing', 'completed', 'failed', 'rate_limited', 'needs_review')),
  provider text,
  model_used text,
  error_code text,
  error_message text,
  result jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  evidence_confidence numeric,
  usage jsonb,
  archived_at timestamptz not null default now(),
  unique (grading_job_id, attempt_count)
);
create index if not exists ai_grading_attempt_history_submission_idx
  on public.ai_grading_attempt_history(submission_type, submission_id, archived_at desc);
create index if not exists ai_grading_attempt_history_job_idx
  on public.ai_grading_attempt_history(grading_job_id, attempt_count desc);
alter table public.ai_grading_attempt_history enable row level security;
revoke all on public.ai_grading_attempt_history from anon, authenticated;
grant all on public.ai_grading_attempt_history to service_role;
notify pgrst, 'reload schema';
