-- Chạy MỘT LẦN trong Supabase Dashboard → SQL Editor.
-- Bảng lưu Web Push subscription theo THIẾT BỊ (không phải theo user).
-- Một tài khoản có thể có nhiều hàng (điện thoại, máy tính, PWA, trình duyệt).
-- Backend dùng service_role nên ghi được dù RLS đang bật.
--
-- Endpoint là khóa duy nhất. last_received_at CHỈ được cập nhật khi
-- Service Worker gửi receipt (đã nhận payload + showNotification thành công),
-- KHÔNG phải lúc server gọi webpush.sendNotification().

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  receipt_token TEXT NOT NULL UNIQUE,
  receipt_url TEXT,
  last_received_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_last_received_at
  ON public.push_subscriptions (last_received_at DESC NULLS LAST);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.push_subscriptions FROM anon, authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'push_subscriptions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.push_subscriptions', pol.policyname);
  END LOOP;
END $$;
