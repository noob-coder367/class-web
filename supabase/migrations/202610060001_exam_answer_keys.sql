-- Additive answer key/rubric storage for per-question AI grading.
-- No existing exam, submission, or file data is removed or rewritten.
create table if not exists public.class_exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.class_exams(id) on delete cascade,
  question_number integer not null check (question_number > 0),
  question_text text not null,
  max_score numeric not null check (max_score > 0),
  expected_answer text not null,
  rubric jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (exam_id, question_number),
  check (jsonb_typeof(rubric) = 'array')
);
create index if not exists class_exam_questions_exam_idx on public.class_exam_questions(exam_id, question_number);

alter table public.class_exam_questions enable row level security;
revoke all on public.class_exam_questions from anon, authenticated;
grant all on public.class_exam_questions to service_role;

notify pgrst, 'reload schema';
