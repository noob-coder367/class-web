import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'

const COLUMNS = 'user_id, full_name, gender, province, school, parent_phone, facebook_url, updated_at'
const GENDERS = new Set(['', 'Nam', 'Nữ', 'Khác'])

function clean(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function toPublic(row) {
  return {
    fullName: row?.full_name || '',
    gender: row?.gender || '',
    province: row?.province || '',
    school: row?.school || '',
    parentPhone: row?.parent_phone || '',
    facebookUrl: row?.facebook_url || '',
    updatedAt: row?.updated_at || '',
  }
}

export async function getMemberProfile(profile) {
  const { data, error } = await supabaseAdmin
    .from('class_member_profiles').select(COLUMNS).eq('user_id', profile.id).maybeSingle()
  if (error) {
    console.error('[member-profile] read failed', error.message)
    throw new AppError('Không thể đọc thông tin cá nhân.', 503)
  }
  return toPublic(data)
}

export async function saveMemberProfile(payload, profile) {
  const fullName = clean(payload?.fullName, 80)
  const gender = clean(payload?.gender, 10)
  const province = clean(payload?.province, 80)
  const school = clean(payload?.school, 120)
  const parentPhone = clean(payload?.parentPhone, 20).replace(/[\s.-]/g, '')
  let facebookUrl = clean(payload?.facebookUrl, 300)

  if (fullName && fullName.length < 2) throw new AppError('Họ và tên phải có ít nhất 2 ký tự.', 400)
  if (!GENDERS.has(gender)) throw new AppError('Giới tính không hợp lệ.', 400)
  if (parentPhone && !/^\+?\d{8,15}$/.test(parentPhone)) {
    throw new AppError('Số điện thoại phụ huynh không hợp lệ (8-15 chữ số).', 400)
  }
  if (facebookUrl) {
    if (!/^https?:\/\//i.test(facebookUrl)) facebookUrl = `https://${facebookUrl}`
    try {
      const url = new URL(facebookUrl)
      if (!/^(www\.|m\.|web\.)?(facebook\.com|fb\.com|fb\.me)$/i.test(url.hostname)) throw new Error('host')
    } catch {
      throw new AppError('Link Facebook không hợp lệ.', 400)
    }
  }

  const { data, error } = await supabaseAdmin
    .from('class_member_profiles')
    .upsert(
      {
        user_id: profile.id,
        full_name: fullName,
        gender,
        province,
        school,
        parent_phone: parentPhone,
        facebook_url: facebookUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select(COLUMNS)
    .single()
  if (error) {
    console.error('[member-profile] write failed', error.message)
    throw new AppError('Không thể lưu thông tin cá nhân.', 503)
  }
  return toPublic(data)
}
