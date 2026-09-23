-- Chạy MỘT LẦN trong Supabase Dashboard → SQL Editor.
-- Chạy sau secure-roles.sql. Backend dùng service_role nên vẫn đọc/ghi bình thường.
-- Không đưa service_role key vào frontend.

-- 1) profiles: client chỉ đọc/cập nhật hồ sơ của chính mình.
-- Trigger protect_profile_privileges trong secure-roles.sql tiếp tục khóa
-- role, is_member và id; service_role được bypass trigger/RLS.
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.profiles FROM anon;
    REVOKE INSERT, DELETE ON TABLE public.profiles FROM authenticated;
    GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

    DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
    CREATE POLICY "profiles_select_own"
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (auth.uid() = id);

    DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
    CREATE POLICY "profiles_update_own"
      ON public.profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- 2) announcements: client chỉ được đọc; mọi ghi đi qua backend API.
DO $$
BEGIN
  IF to_regclass('public.announcements') IS NOT NULL THEN
    ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
    REVOKE INSERT, UPDATE, DELETE ON TABLE public.announcements FROM anon, authenticated;
    GRANT SELECT ON TABLE public.announcements TO anon, authenticated;

    DROP POLICY IF EXISTS "announcements_select_public" ON public.announcements;
    CREATE POLICY "announcements_select_public"
      ON public.announcements
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- 3) classroom-data phải là bucket private.
-- Backend service_role là đường đọc/ghi duy nhất của dữ liệu classroom JSON.
UPDATE storage.buckets
SET public = false
WHERE id = 'classroom-data';

-- Không tạo policy đọc public cho classroom-data. Nếu project đã từng tạo
-- policy storage.objects mở theo bucket_id = 'classroom-data', hãy xóa policy
-- đó trong Storage → Policies trước khi chạy production.
