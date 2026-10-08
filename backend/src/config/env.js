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
  SECRET_CODE: process.env.SECRET_CODE || '',

  // AI/OCR (tuỳ chọn): key chỉ tồn tại trên Render/backend.
  AI_PROVIDER: process.env.AI_PROVIDER || 'gemini',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_MODEL: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
  OCR_SPACE_API_KEY: process.env.OCR_SPACE_API_KEY || '',
}
