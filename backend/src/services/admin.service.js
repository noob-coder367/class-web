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

  // Xóa Auth user trước (nếu bảng profiles có ON DELETE CASCADE thì profile cũng mất luôn).
  // Cách này tránh trạng thái "đã xóa profile nhưng còn Auth" và thường nhanh hơn.
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
    targetUserId
  )

  if (authError) {
    throw new AppError(
      'Xóa tài khoản đăng nhập thất bại: ' + authError.message,
      500
    )
  }

  // Dọn profile nếu còn sót (trường hợp không có cascade).
  // Không ném lỗi nếu đã bị cascade xóa rồi.
  await supabaseAdmin.from('profiles').delete().eq('id', targetUserId)
}
