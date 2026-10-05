-- Classroom JSON -> PostgreSQL hybrid store
-- Chạy một lần trong Supabase Dashboard > SQL Editor.
-- Backend dùng service_role; client không có quyền đọc/ghi trực tiếp.

CREATE TABLE IF NOT EXISTS public.classroom_store (
  key text PRIMARY KEY CHECK (char_length(trim(key)) BETWEEN 1 AND 200),
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS classroom_store_updated_at_idx
  ON public.classroom_store (updated_at DESC);

ALTER TABLE public.classroom_store ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.classroom_store FROM anon, authenticated;
DROP POLICY IF EXISTS "classroom_store_no_client_access" ON public.classroom_store;

-- Không tạo policy client nào. service_role bypass RLS và backend API là lớp duy nhất.
COMMENT ON TABLE public.classroom_store IS
  'Server-only JSON compatibility store. Legacy Storage files are read once for lazy migration and retained as backup.';
