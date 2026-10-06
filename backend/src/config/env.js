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
  AI_GRADING_JOB_TIMEOUT_MS: Math.max(30_000, Number.parseInt(process.env.AI_GRADING_JOB_TIMEOUT_MS || '180000', 10) || 180000),
  AI_GRADING_STORAGE_TIMEOUT_MS: Math.max(5_000, Number.parseInt(process.env.AI_GRADING_STORAGE_TIMEOUT_MS || '30000', 10) || 30000),
  AI_GRADING_GEMINI_TIMEOUT_MS: Math.max(5_000, Number.parseInt(process.env.AI_GRADING_GEMINI_TIMEOUT_MS || '60000', 10) || 60000),
  AI_GRADING_OCR_TIMEOUT_MS: Math.max(5_000, Number.parseInt(process.env.AI_GRADING_OCR_TIMEOUT_MS || '45000', 10) || 45000),
  AI_GRADING_GROQ_TIMEOUT_MS: Math.max(5_000, Number.parseInt(process.env.AI_GRADING_GROQ_TIMEOUT_MS || '90000', 10) || 90000),
  AI_GRADING_RETRY_BASE_MS: Math.max(250, Number.parseInt(process.env.AI_GRADING_RETRY_BASE_MS || '1000', 10) || 1000),
  AI_GRADING_RETRY_MAX_MS: Math.max(1000, Number.parseInt(process.env.AI_GRADING_RETRY_MAX_MS || '60000', 10) || 60000),
  AI_GRADING_STUCK_AFTER_MS: Math.max(60_000, Number.parseInt(process.env.AI_GRADING_STUCK_AFTER_MS || '300000', 10) || 300000),
  AI_GRADING_MAX_IMAGES: Math.max(1, Number.parseInt(process.env.AI_GRADING_MAX_IMAGES || '20', 10) || 20),
  AI_GRADING_MAX_IMAGE_BYTES: Math.max(1_048_576, Number.parseInt(process.env.AI_GRADING_MAX_IMAGE_BYTES || String(15 * 1024 * 1024), 10) || 15 * 1024 * 1024),
  AI_GRADING_MAX_TOTAL_BYTES: Math.max(1_048_576, Number.parseInt(process.env.AI_GRADING_MAX_TOTAL_BYTES || String(60 * 1024 * 1024), 10) || 60 * 1024 * 1024),
  AI_GRADING_MAX_PDF_PAGES: Math.max(1, Number.parseInt(process.env.AI_GRADING_MAX_PDF_PAGES || '30', 10) || 30),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_PRIMARY_MODEL: process.env.GEMINI_PRIMARY_MODEL || 'gemini-3.8-flash',
  GEMINI_SECONDARY_MODEL: process.env.GEMINI_SECONDARY_MODEL || 'gemini-3.6-flash',
  OCR_SPACE_API_KEY: process.env.OCR_SPACE_API_KEY || '',
  OCR_SPACE_ENDPOINT: process.env.OCR_SPACE_ENDPOINT || 'https://api.ocr.space/parse/image',
}
