export const PROFILE_ERROR_MESSAGES = {
  missing: 'Hồ sơ tài khoản chưa được khởi tạo. Vui lòng thử lại để đồng bộ tài khoản.',
  permission: 'Phiên đăng nhập không có quyền đọc hồ sơ. Vui lòng đăng nhập lại.',
  schema: 'Hồ sơ chưa sẵn sàng trên máy chủ. Vui lòng thử lại sau.',
  network: 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.',
  session: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
  unknown: 'Không thể tải hồ sơ. Vui lòng thử lại.',
}

export function classifySupabaseError(error) {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  if (code === 'PGRST116') return 'missing'
  if (code === '42501' || /permission|not authorized|row-level security|rls/.test(message)) return 'permission'
  if (code === '42703' || code === '42P01' || /column .* does not exist|relation .* does not exist/.test(message)) return 'schema'
  if (!error?.code && /fetch|network|timeout|failed to|load failed/.test(message)) return 'network'
  return 'unknown'
}
