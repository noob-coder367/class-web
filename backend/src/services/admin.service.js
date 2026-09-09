import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError, setDisplayName, toPublicProfile } from './auth.service.js'

/**
 * Toàn bộ thao tác quản trị (trước đây gọi thẳng từ AdminPanel.jsx
 * bằng anon key + RLS) nay chạy ở backend bằng service role key,
 * và được canh gác bởi middleware requireAuth + requireAdmin.
 */

export async function listUsers() {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new AppError('Không thể tải danh sách tài khoản!', 500)
  return (data || []).map(toPublicProfile)
}

export async function updateUsername(targetUserId, rawName) {
  return setDisplayName(targetUserId, rawName)
}

export async function toggleMember(targetUserId, currentStatus) {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ is_member: !currentStatus })
    .eq('id', targetUserId)

  if (error) throw new AppError('Cập nhật thất bại: ' + error.message, 500)
}

export async function toggleRole(targetUserId, currentRole, requesterId) {
  if (targetUserId === requesterId && currentRole === 'admin') {
    throw new AppError('Bạn không thể tự gỡ quyền Admin của chính mình!')
  }

  const newRole = currentRole === 'admin' ? 'user' : 'admin'
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ role: newRole })
    .eq('id', targetUserId)

  if (error) throw new AppError('Đổi quyền thất bại: ' + error.message, 500)
}

export async function deleteUser(targetUserId, requesterId) {
  if (targetUserId === requesterId) {
    throw new AppError('Bạn không thể tự xóa chính tài khoản của mình!')
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', targetUserId)

  if (profileError) {
    throw new AppError('Xóa tài khoản thất bại: ' + profileError.message, 500)
  }

  // Xóa luôn user bên Supabase Auth (yêu cầu service role key).
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
    targetUserId
  )

  if (authError) {
    throw new AppError(
      'Đã xóa hồ sơ nhưng xóa tài khoản đăng nhập thất bại: ' +
        authError.message,
      500
    )
  }
}
