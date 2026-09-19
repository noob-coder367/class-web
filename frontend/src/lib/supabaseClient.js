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
 * Mọi thao tác NHẠY CẢM (đăng ký, đăng nhập, quên mật khẩu, admin) phải đi qua
 * backend (xem services/authService.js, services/adminService.js).
 * Ngoại lệ: đổi mật khẩu sau khi bấm link khôi phục (PASSWORD_RECOVERY) gọi
 * supabase.auth.updateUser() trực tiếp bằng session khôi phục của chính user.
 */

/**
 * Khi user bấm link trong email (xác nhận đăng ký / đặt lại mật khẩu),
 * Supabase đưa về website kèm thông tin trên URL (#...type=recovery hoặc
 * #error=...) rồi TỰ XÓA khỏi URL sau khi xử lý. Đọc nó NGAY khi module
 * được nạp (trước createClient) để React còn biết user vừa đến từ link nào,
 * kể cả khi sự kiện PASSWORD_RECOVERY phát ra trước lúc React đăng ký listener.
 */
function readAuthRedirect() {
  const empty = { type: null, error: null }
  if (typeof window === 'undefined') return empty
  try {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)
    const get = (key) => hash.get(key) || query.get(key)
    const errorCode = get('error_code') || get('error')
    return {
      type: get('type'),
      error: errorCode
        ? { code: errorCode, expired: /expired/i.test(errorCode + ' ' + (get('error_description') || '')) }
        : null,
    }
  } catch {
    return empty
  }
}

export const initialAuthRedirect = readAuthRedirect()

/** Xóa phần #... / ?error... còn sót trên URL sau khi đã xử lý link email. */
export function clearAuthRedirectFromUrl() {
  try {
    window.history.replaceState(null, '', window.location.pathname)
  } catch {
    /* ignore */
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
