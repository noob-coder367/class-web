const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^(0|\+84)\d{9}$/

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
]

export function validateEmail(value) {
  const email = String(value || '').trim()
  if (!email) return 'Vui lòng nhập email.'
  return EMAIL_RE.test(email) ? '' : 'Email chưa hợp lệ.'
}

/** Quy tắc mật khẩu mới: tối thiểu 8 ký tự, có chữ hoa và chữ số. */
export function validateNewPassword(value) {
  const password = String(value || '')
  if (password.length < 8) return 'Mật khẩu cần có ít nhất 8 ký tự.'
  if (!/[A-Z]/.test(password)) return 'Mật khẩu cần có ít nhất 1 chữ hoa.'
  if (!/\d/.test(password)) return 'Mật khẩu cần có ít nhất 1 chữ số.'
  return ''
}

export function validateProfile(values) {
  const errors = {}
  const fullName = values.full_name.trim()
  if (fullName.length < 2 || fullName.length > 60) errors.full_name = 'Họ và tên cần từ 2 đến 60 ký tự.'
  if (values.gender && !GENDER_OPTIONS.some((option) => option.value === values.gender)) errors.gender = 'Giới tính không hợp lệ.'
  if (values.province.trim().length > 80) errors.province = 'Tối đa 80 ký tự.'
  if (values.school.trim().length > 120) errors.school = 'Tối đa 120 ký tự.'
  const phone = values.phone.replace(/\s+/g, '')
  if (phone && !PHONE_RE.test(phone)) errors.phone = 'Số điện thoại chưa hợp lệ (vd: 0912345678).'
  const facebook = values.facebook_url.trim()
  if (facebook) {
    let valid = facebook.length <= 300
    try {
      valid = valid && /^https?:$/.test(new URL(facebook).protocol)
    } catch {
      valid = false
    }
    if (!valid) errors.facebook_url = 'Link cần bắt đầu bằng http:// hoặc https://.'
  }
  return errors
}
