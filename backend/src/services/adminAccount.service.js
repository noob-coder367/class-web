import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError, toPublicProfile } from './auth.service.js'

function isGhostUser(user, profile) {
  return Boolean(user?.user_metadata?.is_ghost) || String(profile?.email || '').toLowerCase().endsWith('@ghost.com')
}

function providerFor(user) {
  const providers = (user?.identities || []).map((identity) => identity?.provider).filter(Boolean)
  if (providers.includes('google')) return 'google'
  if (providers.includes('email')) return 'email'
  return providers[0] || 'unknown'
}

async function listAuthUsers() {
  const users = []
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new AppError('Không thể tải danh sách tài khoản.', 503)
    users.push(...(data?.users || []))
    if ((data?.users || []).length < 200) break
  }
  return users
}

export async function listAccounts() {
  const [{ data: profiles, error }, users] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, email, username, role, full_name, is_member, created_at, updated_at').order('created_at', { ascending: false }),
    listAuthUsers(),
  ])
  if (error) throw new AppError('Không thể tải danh sách tài khoản.', 503)
  const byId = new Map(users.map((user) => [user.id, user]))
  const merged = new Map((profiles || []).map((profile) => [profile.id, profile]))
  for (const user of users) {
    if (!merged.has(user.id)) merged.set(user.id, {
      id: user.id,
      email: user.email || '',
      username: null,
      role: 'user',
      full_name: null,
      is_member: false,
      created_at: user.created_at,
      updated_at: user.updated_at,
    })
  }
  return [...merged.values()].map((profile) => {
    const user = byId.get(profile.id)
    const ghost = isGhostUser(user, profile)
    return {
      ...toPublicProfile(profile, user),
      full_name: profile.full_name || null,
      provider: ghost ? 'ghost' : providerFor(user),
      is_ghost: ghost,
      confirmed: Boolean(user?.email_confirmed_at),
    }
  })
}

export async function getAccountDetails(targetId) {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, username, role, full_name, is_member, gender, province, school, phone, facebook_url, created_at, updated_at')
    .eq('id', targetId)
    .maybeSingle()
  if (profileError) throw new AppError('Không thể đọc thông tin tài khoản.', 503)
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(targetId)
  if (userError || !userData?.user) throw new AppError('Không tìm thấy tài khoản.', 404)
  const user = userData.user
  const account = profile || {
    id: user.id,
    email: user.email || '',
    username: null,
    role: 'user',
    full_name: null,
    is_member: false,
    created_at: user.created_at,
    updated_at: user.updated_at,
  }
  const ghost = isGhostUser(user, account)
  return {
    ...account,
    display_name: account.full_name || user.user_metadata?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '',
    provider: ghost ? 'ghost' : providerFor(user),
    is_ghost: ghost,
    confirmed: Boolean(user.email_confirmed_at),
    email_confirmed_at: user.email_confirmed_at || null,
    last_sign_in_at: user.last_sign_in_at || null,
    auth_created_at: user.created_at || null,
    identities: (user.identities || []).map((identity) => ({ provider: identity.provider, identity_id: identity.identity_id || null, created_at: identity.created_at || null, last_sign_in_at: identity.last_sign_in_at || null })),
  }
}
export async function updateGhostDisplayName(targetId, rawName) {
  const { data: profile, error } = await supabaseAdmin.from('profiles').select('id, email, full_name').eq('id', targetId).maybeSingle()
  if (error) throw new AppError('Không thể đọc tài khoản.', 503)
  if (!profile) throw new AppError('Không tìm thấy tài khoản.', 404)
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(targetId)
  if (!isGhostUser(userData?.user, profile)) throw new AppError('Chỉ được sửa tên tài khoản ma.', 400)
  const name = String(rawName || '').trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 60) throw new AppError('Tên hiển thị cần từ 2 đến 60 ký tự.')
  const { data, error: updateError } = await supabaseAdmin.from('profiles').update({ full_name: name }).eq('id', targetId).select('id, email, role, full_name, created_at').single()
  if (updateError) throw new AppError('Không thể cập nhật tên tài khoản.', 503)
  return data
}

const editableProfileFields = new Set(['full_name', 'gender', 'province', 'school', 'phone', 'facebook_url'])
const genderValues = new Set(['male', 'female', 'other'])

export async function updateAccount(targetId, values) {
  const entries = Object.entries(values || {})
  if (!entries.length) throw new AppError('Chọn ít nhất một mục hồ sơ để cập nhật.', 400)
  if (entries.some(([key]) => !editableProfileFields.has(key))) throw new AppError('Có mục hồ sơ không được phép chỉnh sửa.', 400)

  const updates = Object.fromEntries(entries.map(([key, value]) => [key, String(value ?? '').trim() || null]))
  if ('full_name' in updates && (!updates.full_name || updates.full_name.length < 2 || updates.full_name.length > 60)) throw new AppError('Họ và tên cần từ 2 đến 60 ký tự.', 400)
  if (updates.gender && !genderValues.has(updates.gender)) throw new AppError('Giới tính không hợp lệ.', 400)
  if (updates.province?.length > 80) throw new AppError('Tỉnh / thành tối đa 80 ký tự.', 400)
  if (updates.school?.length > 120) throw new AppError('Trường học tối đa 120 ký tự.', 400)
  if (updates.phone) {
    updates.phone = updates.phone.replace(/\s+/g, '')
    if (!/^(0|\+84)\d{9}$/.test(updates.phone)) throw new AppError('Số điện thoại chưa hợp lệ (vd: 0912345678).', 400)
  }
  if (updates.facebook_url) {
    try {
      const url = new URL(updates.facebook_url)
      if (!['http:', 'https:'].includes(url.protocol) || updates.facebook_url.length > 300) throw new Error('invalid URL')
    } catch {
      throw new AppError('Link Facebook cần bắt đầu bằng http:// hoặc https:// và tối đa 300 ký tự.', 400)
    }
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(targetId)
  if (userError || !userData?.user) throw new AppError('Không tìm thấy tài khoản.', 404)
  const { data, error } = await supabaseAdmin.from('profiles')
    .upsert({ id: targetId, email: userData.user.email || '', ...updates }, { onConflict: 'id' })
    .select('id, email, username, role, full_name, is_member, gender, province, school, phone, facebook_url, created_at, updated_at')
    .single()
  if (error) throw new AppError('Không thể cập nhật hồ sơ tài khoản.', 503)
  return { ...data, display_name: data.full_name || userData.user.user_metadata?.display_name || userData.user.email?.split('@')[0] || '' }
}

export async function deleteAccount(targetId, requesterId) {
  if (targetId === requesterId) throw new AppError('Không thể tự xóa tài khoản đang dùng.', 400)
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(targetId)
  if (userError || !userData?.user) throw new AppError('Không tìm thấy tài khoản.', 404)
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetId)
  if (deleteError) throw new AppError('Không thể xóa tài khoản.', 503)
  const { error: profileDeleteError } = await supabaseAdmin.from('profiles').delete().eq('id', targetId)
  if (profileDeleteError) throw new AppError('Tài khoản đã bị xóa nhưng không thể dọn hồ sơ.', 503)
}
