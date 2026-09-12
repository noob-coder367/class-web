import 'dotenv/config'

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `[ENV] Thiếu biến môi trường bắt buộc: ${name}. Kiểm tra file .env (xem .env.example).`
    )
  }
  return value
}

export const env = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',

  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),

  // Mã bí mật để đăng ký làm "Thành viên 10A4".
  // KHÔNG BAO GIỜ đặt giá trị này ở phía frontend.
  SECRET_CODE: required('SECRET_CODE'),

  // Token GitHub (fine-grained hoặc classic) với quyền contents:write
  // trên repo class-web. Chỉ cần khi admin thêm/xóa ảnh website.
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  GITHUB_OWNER: process.env.GITHUB_OWNER || 'noob-coder367',
  GITHUB_REPO: process.env.GITHUB_REPO || 'class-web',
  GITHUB_BRANCH: process.env.GITHUB_BRANCH || 'main',

  // Web Push (VAPID). Tạo bằng: npx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || '',
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || '',
  VAPID_SUBJECT: process.env.VAPID_SUBJECT || 'mailto:admin@10a4.local',
}
