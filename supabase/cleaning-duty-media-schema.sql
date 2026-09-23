-- Chạy sau cleaning-duty-schema.sql trong Supabase SQL Editor.
-- Metadata ảnh/đánh giá theo tuần + ngày; file thật nằm trong bucket classroom-data.

ALTER TABLE public.cleaning_duty_status
  DROP CONSTRAINT IF EXISTS cleaning_duty_status_status_check;
ALTER TABLE public.cleaning_duty_status
  ADD CONSTRAINT cleaning_duty_status_status_check
  CHECK (status IN ('preparing', 'doing', 'done', 'not_clean', 'pending', 'not_done'));

CREATE TABLE IF NOT EXISTS public.cleaning_duty_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  duty_date DATE NOT NULL,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('t2', 't3', 't4', 't5', 't6', 't7')),
  storage_path TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 26214400),
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nâng giới hạn ảnh hiện có từ 15MB lên 25MB, không đổi bảng/bucket/cột.
ALTER TABLE public.cleaning_duty_photos
  DROP CONSTRAINT IF EXISTS cleaning_duty_photos_size_bytes_check;
ALTER TABLE public.cleaning_duty_photos
  ADD CONSTRAINT cleaning_duty_photos_size_bytes_check
  CHECK (size_bytes > 0 AND size_bytes <= 26214400);

CREATE INDEX IF NOT EXISTS idx_cleaning_duty_photos_week_day
  ON public.cleaning_duty_photos (week_start, duty_date, created_at DESC);

CREATE TABLE IF NOT EXISTS public.cleaning_duty_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  duty_date DATE NOT NULL,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('t2', 't3', 't4', 't5', 't6', 't7')),
  rating SMALLINT NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_start, duty_date, updated_by)
);

CREATE INDEX IF NOT EXISTS idx_cleaning_duty_reviews_week_day
  ON public.cleaning_duty_reviews (week_start, duty_date, updated_at DESC);

ALTER TABLE public.cleaning_duty_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_duty_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cleaning_duty_photos FROM anon, authenticated;
REVOKE ALL ON TABLE public.cleaning_duty_reviews FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cleaning_duty_photos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cleaning_duty_reviews TO service_role;

-- Backend service_role thực hiện toàn bộ đọc/ghi; không mở quyền ghi trực tiếp cho client.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('cleaning_duty_photos', 'cleaning_duty_reviews')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
