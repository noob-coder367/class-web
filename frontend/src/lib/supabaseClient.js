import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabaseClient] Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong .env'
  )
}

/**
 * Client này CHỈ dùng anon key (public, an toàn để lộ).
 * Dùng cho:
 *  - Lưu/khôi phục session sau khi backend trả về access/refresh token
 *  - Đọc dữ liệu công khai được bảo vệ bởi RLS (announcements, events)
 *  - Realtime subscriptions
 *
 * Mọi thao tác NHẠY CẢM (đăng ký, đăng nhập, OTP, admin) phải đi qua
 * backend (xem services/authService.js, services/adminService.js).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
