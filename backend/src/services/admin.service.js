import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError, setDisplayName, toPublicProfile } from './auth.service.js'
import { isKnownRole, normalizeRole, ROLES } from '../lib/roles.js'

/**
 * Toàn bộ thao tác quản trị chạy ở backend bằng service role key,
 * canh gác bởi middleware requireAuth + requireAdmin.
 * Role mới chỉ nhận giá trị trong allowlist — client không thể bịa 'superadmin'.
 */

function extractGoogleEmail(authUser) {
  if (!authUser) return null

  const identities = Array.isArray(authUser.identities) ? authUser.identities : []
  const google = identities.find((i) => i.provider === 'google')
  if (google) {
    const email = google.identity_data?.email || authUser.email || null
    return email ? String(email).trim() : null
  }

  const providers = authUser.app_metadata?.providers
  const usedGoogle =
    (Array.isArray(providers) && providers.includes('google')) ||
    authUser.app_metadata?.provider === 'google'
  if (!usedGoogle) return null

  return authUser.email ? String(authUser.email).trim() : null
}

async function loadGoogleEmailsByUserId() {
  const map = new Map()
  let page = 1
  const perPage = 200
  const maxPages = 20

  while (page <= maxPages) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    })
    if (error) break

    const users = data?.users || []
    for (const user of users) {
      const email = extractGoogleEmail(user)
      if (email) map.set(user.id, email)
    }

    if (users.length < perPage) break
    page += 1
  }

  return map
}

export async function listUsers() {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new AppError('Không thể tải danh sách tài khoản!', 500)

  let googleByUserId = new Map()
  try {
    googleByUserId = await loadGoogleEmailsByUserId()
  } catch {
    googleByUserId = new Map()
  }

  return (data || []).map((profile) => ({
    ...toPublicProfile(profile),
    google_email: googleByUserId.get(profile.id) || null,
  }))
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

/**
 * Phong / hạ / truyền chức. Chỉ Admin gọi được (middleware).
 * Không tin currentRole từ client — đọc role hiện tại từ DB.
 */
export async function setRole(targetUserId, requestedRole, requesterId) {
  if (!targetUserId) throw new AppError('Thiếu tài khoản đích.', 400)
  if (typeof requestedRole !== 'string' || !isKnownRole(requestedRole)) {
    throw new AppError('Vai trò không hợp lệ.')
  }

  const nextRole = normalizeRole(requestedRole)

  const { data: target, error: readError } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', targetUserId)
    .maybeSingle()

  if (readError) throw new AppError('Không đọc được tài khoản đích.', 500)
  if (!target) throw new AppError('Không tìm thấy tài khoản.', 404)

  const currentRole = normalizeRole(target.role)

  if (targetUserId === requesterId && currentRole === ROLES.ADMIN && nextRole !== ROLES.ADMIN) {
    throw new AppError('Bạn không thể tự gỡ quyền Admin của chính mình!')
  }

  if (currentRole === nextRole) return

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ role: nextRole })
    .eq('id', targetUserId)

  if (error) throw new AppError('Đổi quyền thất bại: ' + error.message, 500)
}

/** @deprecated dùng setRole — giữ để tương thích payload cũ { currentRole } */
export async function toggleRole(targetUserId, currentRole, requesterId) {
  const current = normalizeRole(currentRole)
  const next = current === ROLES.ADMIN ? ROLES.USER : ROLES.ADMIN
  return setRole(targetUserId, next, requesterId)
}

export async function deleteUser(targetUserId, requesterId) {
  if (targetUserId === requesterId) {
    throw new AppError('Bạn không thể tự xóa chính tài khoản của mình!')
  }

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
    targetUserId
  )

  if (authError) {
    throw new AppError(
      'Xóa tài khoản đăng nhập thất bại: ' + authError.message,
      500
    )
  }

  await supabaseAdmin.from('profiles').delete().eq('id', targetUserId)
}
