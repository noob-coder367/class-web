-- Chạy MỘT LẦN trong Supabase Dashboard → SQL Editor, SAU KHI đã chạy secure-roles.sql
-- (secure-roles.sql đã mở rộng profiles_role_check để nhận 'vp_labor').
--
-- Mục đích: dữ liệu cho tính năng "Lịch trực vệ sinh" do Lớp phó Lao động
-- (LPLĐ) + Admin quản lý. Không đụng tới bất kỳ bảng nào đã có (profiles,
-- events, ...) — chỉ tạo mới, an toàn để chạy trên DB đang chạy production.
--
-- Thiết kế 2 bảng:
--  1) cleaning_duty_schedule — LỊCH TRỰC THEO TUẦN (Thứ 2 → Thứ 7),
--     mỗi hàng là 1 tuần, cột `days` là JSON chứa danh sách người trực
--     cho từng ngày (t2..t7).
--  2) cleaning_duty_status   — TRẠNG THÁI VỆ SINH THEO TỪNG NGÀY cụ thể
--     (ngày dương lịch), tham chiếu tới tuần chứa nó.

-- 1) Bảng lịch trực theo tuần ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cleaning_duty_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Ngày Thứ 2 (đầu tuần áp dụng lịch), duy nhất mỗi tuần
  week_start DATE NOT NULL UNIQUE,
  -- { "t2": { "assignees": ["Nguyễn Văn A", "..."], "note": "" }, "t3": {...}, ..., "t7": {...} }
  days JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cleaning_duty_schedule_week_start
  ON public.cleaning_duty_schedule (week_start DESC);

-- 2) Bảng trạng thái vệ sinh theo từng ngày ----------------------------------
CREATE TABLE IF NOT EXISTS public.cleaning_duty_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Ngày dương lịch cụ thể (luôn nằm trong khoảng T2–T7 của 1 tuần)
  duty_date DATE NOT NULL UNIQUE,
  -- Tuần chứa ngày này (Thứ 2 của tuần đó) — để join nhanh với schedule
  week_start DATE NOT NULL,
  -- Mã thứ trong tuần: t2, t3, t4, t5, t6, t7
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('t2', 't3', 't4', 't5', 't6', 't7')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done', 'not_done')),
  note TEXT,
  marked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  marked_by_name TEXT,
  marked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cleaning_duty_status_week_start
  ON public.cleaning_duty_status (week_start DESC);

-- 3) Trigger tự cập nhật updated_at ------------------------------------------
CREATE OR REPLACE FUNCTION public.set_cleaning_duty_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleaning_duty_schedule_updated_at ON public.cleaning_duty_schedule;
CREATE TRIGGER trg_cleaning_duty_schedule_updated_at
  BEFORE UPDATE ON public.cleaning_duty_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cleaning_duty_updated_at();

DROP TRIGGER IF EXISTS trg_cleaning_duty_status_updated_at ON public.cleaning_duty_status;
CREATE TRIGGER trg_cleaning_duty_status_updated_at
  BEFORE UPDATE ON public.cleaning_duty_status
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cleaning_duty_updated_at();

-- 4) RLS: giống bảng events — client chỉ được ĐỌC, mọi ghi đi qua backend
--    (backend dùng service_role key nên vẫn ghi được bình thường).
ALTER TABLE public.cleaning_duty_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_duty_status ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.cleaning_duty_schedule FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.cleaning_duty_status FROM anon, authenticated;
GRANT SELECT ON TABLE public.cleaning_duty_schedule TO authenticated;
GRANT SELECT ON TABLE public.cleaning_duty_status TO authenticated;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('cleaning_duty_schedule', 'cleaning_duty_status')
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Chỉ thành viên đã đăng nhập được đọc (đây là dữ liệu nội bộ lớp,
-- không public như events).
DROP POLICY IF EXISTS "cleaning_duty_schedule_select_authenticated" ON public.cleaning_duty_schedule;
CREATE POLICY "cleaning_duty_schedule_select_authenticated"
  ON public.cleaning_duty_schedule
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "cleaning_duty_status_select_authenticated" ON public.cleaning_duty_status;
CREATE POLICY "cleaning_duty_status_select_authenticated"
  ON public.cleaning_duty_status
  FOR SELECT
  TO authenticated
  USING (true);
