import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

/**
 * Client Supabase phía SERVER, dùng SERVICE_ROLE_KEY.
 *
 * Key này có toàn quyền, BỎ QUA mọi Row Level Security (RLS).
 * -> Không bao giờ được gửi key này ra frontend.
 * -> Chỉ import file này trong code backend (services/controllers).
 */
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
