-- Additive hardening for the existing AI grading queue.
-- Safe to run after 202610050002_ai_grading_jobs.sql; no data is deleted.

alter table public.ai_grading_jobs add column if not exists provider text;
alter table public.ai_grading_jobs add column if not exists started_at timestamptz;
alter table public.ai_grading_jobs add column if not exists duration_ms integer;
alter table public.ai_grading_jobs add column if not exists error_code text;
alter table public.ai_grading_jobs add column if not exists evidence_confidence numeric;
alter table public.ai_grading_jobs add column if not exists usage jsonb;

create or replace function public.recover_stuck_ai_grading_jobs(p_stuck_after_seconds integer default 300)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  update public.ai_grading_jobs
  set status = 'pending', locked_at = null, locked_by = null,
      next_attempt_at = now(), updated_at = now(),
      error_code = 'WORKER_RECOVERY', error_message = 'Worker recovered a stale processing job.'
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - make_interval(secs => greatest(60, p_stuck_after_seconds));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.recover_stuck_ai_grading_jobs(integer) from public, anon, authenticated;
grant execute on function public.recover_stuck_ai_grading_jobs(integer) to service_role;

notify pgrst, 'reload schema';
