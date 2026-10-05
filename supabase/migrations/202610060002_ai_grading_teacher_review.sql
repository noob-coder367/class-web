-- Additive teacher review layer for AI grading.
-- Keeps ai_grading_jobs.result unchanged and preserves original AI scores/comments.

create table if not exists public.ai_grading_reviews (
  id uuid primary key default gen_random_uuid(),
  grading_job_id uuid not null references public.ai_grading_jobs(id) on delete cascade,
  submission_id uuid not null,
  submission_type text not null check (submission_type in ('homework', 'exam')),
  question_id text not null,
  question_number integer not null check (question_number > 0),
  ai_score numeric,
  ai_max_score numeric not null check (ai_max_score > 0),
  ai_comment text,
  ai_confidence numeric check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  ai_status text not null check (ai_status in ('graded', 'needs_review')),
  teacher_score numeric not null check (teacher_score >= 0),
  teacher_comment text not null default '',
  reviewed_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grading_job_id, question_id),
  check (teacher_score <= ai_max_score)
);

create index if not exists ai_grading_reviews_submission_idx
  on public.ai_grading_reviews(submission_type, submission_id, question_number);
create index if not exists ai_grading_reviews_job_idx
  on public.ai_grading_reviews(grading_job_id, updated_at desc);

alter table public.ai_grading_reviews enable row level security;
revoke all on public.ai_grading_reviews from anon, authenticated;
grant all on public.ai_grading_reviews to service_role;

notify pgrst, 'reload schema';
