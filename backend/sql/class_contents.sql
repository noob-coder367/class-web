-- Chạy một lần trên Supabase SQL Editor.
-- Bảng lưu nội dung khu vực lớp (TKB, sau này có thể thêm tab khác).
-- RLS bật, không có policy công khai: chỉ service role (backend) đọc/ghi.

create table if not exists public.class_contents (
  tab text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.class_contents enable row level security;
