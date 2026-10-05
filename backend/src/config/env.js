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

  // Public origin của /api (vd https://xxx.onrender.com/api). Dùng cho push receipt URL.
  API_PUBLIC_URL: String(process.env.API_PUBLIC_URL || '').replace(/\/$/, ''),

  // Groq chỉ được gọi từ backend; tuyệt đối không đưa khóa này sang frontend.
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_MODEL: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',

  // AI grading is deliberately independent from the classroom chatbot.
  AI_GRADING_ENABLED: process.env.AI_GRADING_ENABLED === 'true',
  AI_GRADING_CONCURRENCY: Math.max(1, Number.parseInt(process.env.AI_GRADING_CONCURRENCY || '2', 10) || 2),
  AI_GRADING_POLL_MS: Math.max(1000, Number.parseInt(process.env.AI_GRADING_POLL_MS || '5000', 10) || 5000),
  AI_GRADING_MAX_ATTEMPTS: Math.max(1, Number.parseInt(process.env.AI_GRADING_MAX_ATTEMPTS || '3', 10) || 3),
  AI_GRADING_OCR_CONFIDENCE_THRESHOLD: Number(process.env.AI_GRADING_OCR_CONFIDENCE_THRESHOLD || '0.72'),
  AI_GRADING_REVIEW_CONFIDENCE_THRESHOLD: Number(process.env.AI_GRADING_REVIEW_CONFIDENCE_THRESHOLD || '0.65'),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_PRIMARY_MODEL: process.env.GEMINI_PRIMARY_MODEL || 'gemini-3.8-flash',
  GEMINI_SECONDARY_MODEL: process.env.GEMINI_SECONDARY_MODEL || 'gemini-3.6-flash',
  OCR_SPACE_API_KEY: process.env.OCR_SPACE_API_KEY || '',
  OCR_SPACE_ENDPOINT: process.env.OCR_SPACE_ENDPOINT || 'https://api.ocr.space/parse/image',
}
