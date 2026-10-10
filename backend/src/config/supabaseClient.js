import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

const authOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
}

/**
 * Client Supabase phía SERVER, dùng SERVICE_ROLE_KEY.
 *
 * Key này có toàn quyền, BỎ QUA mọi Row Level Security (RLS).
 * -> Không bao giờ được gửi key này ra frontend.
 * -> Chỉ import file này trong code backend (services/controllers).
 * -> Không gọi signInWithPassword trên client này. Session user sẽ
 *    ghi đè Authorization và các query sau đó mất quyền service role.
 */
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  authOptions,
)

/** Client riêng để cấp session đăng nhập, không làm nhiễm supabaseAdmin. */
export const supabaseAuth = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  authOptions,
)
