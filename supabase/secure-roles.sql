-- Chạy MỘT LẦN trong Supabase Dashboard → SQL Editor.
-- Bắt buộc để khóa việc tự phong Admin / lớp phó từ trình duyệt (anon key).
-- Backend dùng service_role key nên vẫn đổi được role qua /api/admin/users/:id/role.

-- 1) Cho phép 3 vai trò lớp phó trên cột profiles.role
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'user', 'vp_academic', 'vp_discipline', 'vp_events'));

-- 2) Trigger: user thường KHÔNG được tự sửa role / is_member / id.
--    service_role (backend) đi qua bình thường.
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Không được tự ý đổi vai trò';
  END IF;
  IF NEW.is_member IS DISTINCT FROM OLD.is_member THEN
    RAISE EXCEPTION 'Không được tự ý đổi trạng thái thành viên';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Không được đổi id hồ sơ';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileges();

-- 3) Bảng events: client chỉ được ĐỌC. Mọi ghi (đăng/xóa/sửa giờ) đi qua backend.
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.events FROM anon, authenticated;
GRANT SELECT ON TABLE public.events TO anon, authenticated;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'events'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.events', pol.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "events_select_public" ON public.events;
CREATE POLICY "events_select_public"
  ON public.events
  FOR SELECT
  TO anon, authenticated
  USING (true);
