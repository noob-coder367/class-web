-- Quizly phase 2: hệ thống tạo câu hỏi (quizzes + questions).
-- Chạy lại an toàn (idempotent). KHÔNG đụng tới profiles / RESET-LEGACY.sql.
-- Chưa có gameplay, join room, realtime, leaderboard.

-- ---------------------------------------------------------------------------
-- Helper: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- quizzes (phòng / bộ câu hỏi)
-- ---------------------------------------------------------------------------
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quizzes_title_check check (char_length(btrim(title)) between 1 and 120),
  constraint quizzes_description_check check (description is null or char_length(description) <= 500),
  constraint quizzes_status_check check (status in ('draft', 'published'))
);

create index if not exists quizzes_owner_updated_idx on public.quizzes (owner_id, updated_at desc);

drop trigger if exists trg_quizzes_updated_at on public.quizzes;
create trigger trg_quizzes_updated_at
  before update on public.quizzes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- questions (relational, mỗi câu 1 dòng; KHÔNG lưu cả quiz trong 1 JSON blob)
-- ---------------------------------------------------------------------------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  order_index integer not null,
  type text not null,
  content text not null,
  options jsonb,
  correct_option smallint,
  correct_boolean boolean,
  reference_answer text,
  explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_order_check check (order_index >= 0 and order_index < 100),
  constraint questions_type_check check (type in ('multiple_choice', 'essay', 'true_false')),
  constraint questions_content_check check (char_length(btrim(content)) between 1 and 1000),
  constraint questions_explanation_check check (explanation is null or char_length(explanation) <= 1000),
  constraint questions_reference_check check (reference_answer is null or char_length(reference_answer) <= 2000),
  -- coalesce(..., false): NULL trong CHECK được coi là "đạt", nên phải ép về false.
  constraint questions_shape_check check (coalesce(
    (type = 'multiple_choice'
      and jsonb_typeof(options) = 'array'
      and jsonb_array_length(options) between 2 and 8
      and correct_option is not null
      and correct_option >= 0
      and correct_option < jsonb_array_length(options)
      and correct_boolean is null
      and reference_answer is null)
    or (type = 'true_false'
      and options is null
      and correct_option is null
      and correct_boolean is not null
      and reference_answer is null)
    or (type = 'essay'
      and options is null
      and correct_option is null
      and correct_boolean is null),
    false)),
  constraint questions_quiz_order_unique unique (quiz_id, order_index) deferrable initially deferred
);

drop trigger if exists trg_questions_updated_at on public.questions;
create trigger trg_questions_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Provider check cho RLS (cùng luật với backend: identity google + phiên oauth)
-- ---------------------------------------------------------------------------
create or replace function public.current_user_is_google()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (select 1 from auth.identities i where i.user_id = auth.uid() and i.provider = 'google')
    and case
      when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then
        exists (select 1 from jsonb_array_elements(auth.jwt() -> 'amr') a where a ->> 'method' = 'oauth')
      else
        not exists (select 1 from auth.identities i where i.user_id = auth.uid() and i.provider = 'email')
    end;
$$;

revoke all on function public.current_user_is_google() from public, anon;
grant execute on function public.current_user_is_google() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: chỉ chủ phòng; ghi dữ liệu còn yêu cầu phiên Google (đề phòng gọi thẳng PostgREST).
-- ---------------------------------------------------------------------------
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;

revoke all on table public.quizzes from anon;
revoke all on table public.questions from anon;
grant select, insert, update, delete on table public.quizzes to authenticated;
grant select, insert, update, delete on table public.questions to authenticated;
grant all on table public.quizzes to service_role;
grant all on table public.questions to service_role;

drop policy if exists "quizzes_select_own" on public.quizzes;
create policy "quizzes_select_own" on public.quizzes
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "quizzes_insert_own_google" on public.quizzes;
create policy "quizzes_insert_own_google" on public.quizzes
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select public.current_user_is_google()));

drop policy if exists "quizzes_update_own_google" on public.quizzes;
create policy "quizzes_update_own_google" on public.quizzes
  for update to authenticated
  using (owner_id = (select auth.uid()) and (select public.current_user_is_google()))
  with check (owner_id = (select auth.uid()) and (select public.current_user_is_google()));

drop policy if exists "quizzes_delete_own_google" on public.quizzes;
create policy "quizzes_delete_own_google" on public.quizzes
  for delete to authenticated
  using (owner_id = (select auth.uid()) and (select public.current_user_is_google()));

drop policy if exists "questions_select_owner" on public.questions;
create policy "questions_select_owner" on public.questions
  for select to authenticated
  using (exists (select 1 from public.quizzes q where q.id = questions.quiz_id and q.owner_id = (select auth.uid())));

drop policy if exists "questions_insert_owner_google" on public.questions;
create policy "questions_insert_owner_google" on public.questions
  for insert to authenticated
  with check (
    (select public.current_user_is_google())
    and exists (select 1 from public.quizzes q where q.id = questions.quiz_id and q.owner_id = (select auth.uid()))
  );

drop policy if exists "questions_update_owner_google" on public.questions;
create policy "questions_update_owner_google" on public.questions
  for update to authenticated
  using (
    (select public.current_user_is_google())
    and exists (select 1 from public.quizzes q where q.id = questions.quiz_id and q.owner_id = (select auth.uid()))
  )
  with check (
    (select public.current_user_is_google())
    and exists (select 1 from public.quizzes q where q.id = questions.quiz_id and q.owner_id = (select auth.uid()))
  );

drop policy if exists "questions_delete_owner_google" on public.questions;
create policy "questions_delete_owner_google" on public.questions
  for delete to authenticated
  using (
    (select public.current_user_is_google())
    and exists (select 1 from public.quizzes q where q.id = questions.quiz_id and q.owner_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Lưu phòng + câu hỏi trong 1 transaction. Chỉ service_role (backend) được gọi.
-- Backend truyền p_owner_id lấy từ session đã xác minh; hàm tự từ chối nếu phòng thuộc người khác.
-- Idempotent theo p_quiz_id: gọi lại cùng dữ liệu không tạo bản sao.
-- ---------------------------------------------------------------------------
create or replace function public.save_quiz_with_questions(
  p_quiz_id uuid,
  p_owner_id uuid,
  p_title text,
  p_description text,
  p_questions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_question jsonb;
  v_index integer := 0;
begin
  if p_quiz_id is null or p_owner_id is null then
    raise exception 'invalid arguments' using errcode = '22023';
  end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) > 100 then
    raise exception 'invalid questions' using errcode = '22023';
  end if;

  select owner_id into v_owner from public.quizzes where id = p_quiz_id for update;
  if found and v_owner <> p_owner_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.quizzes (id, owner_id, title, description, status)
  values (p_quiz_id, p_owner_id, p_title, p_description, 'draft')
  on conflict (id) do update
    set title = excluded.title, description = excluded.description
    where public.quizzes.owner_id = p_owner_id;

  delete from public.questions where quiz_id = p_quiz_id;

  for v_question in select value from jsonb_array_elements(p_questions) loop
    insert into public.questions
      (quiz_id, order_index, type, content, options, correct_option, correct_boolean, reference_answer, explanation)
    values (
      p_quiz_id,
      v_index,
      v_question ->> 'type',
      v_question ->> 'content',
      case when jsonb_typeof(v_question -> 'options') = 'array' then v_question -> 'options' else null end,
      nullif(v_question ->> 'correct_option', '')::smallint,
      nullif(v_question ->> 'correct_boolean', '')::boolean,
      nullif(v_question ->> 'reference_answer', ''),
      nullif(v_question ->> 'explanation', '')
    );
    v_index := v_index + 1;
  end loop;

  return p_quiz_id;
end;
$$;

revoke all on function public.save_quiz_with_questions(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_quiz_with_questions(uuid, uuid, text, text, jsonb) to service_role;
