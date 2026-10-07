import { HttpError } from '../../lib/httpError.js'
import { createGroqProvider } from './groqProvider.js'

/**
 * Factory chọn provider theo env. Thêm provider mới = thêm 1 file + 1 nhánh ở đây;
 * route/service không phải sửa. Interface: { name, generateQuestions({systemPrompt,userPrompt,timeoutMs}) -> string JSON }.
 */
export function getAIProvider(config) {
  const name = String(config.AI_PROVIDER || 'groq').toLowerCase()
  if (name === 'groq') {
    if (!config.GROQ_API_KEY) {
      throw new HttpError('Chức năng AI chưa được cấu hình trên máy chủ.', 503, 'ai_not_configured')
    }
    return createGroqProvider({ apiKey: config.GROQ_API_KEY, model: config.GROQ_MODEL || 'openai/gpt-oss-20b' })
  }
  throw new HttpError('Chức năng AI chưa được cấu hình trên máy chủ.', 503, 'ai_not_configured')
}
