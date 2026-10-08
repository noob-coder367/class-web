import { HttpError } from '../../lib/httpError.js'
import { createGroqProvider } from './groqProvider.js'
import { createGeminiProvider } from './geminiProvider.js'
const RECOVERABLE = new Set(['ai_unavailable', 'ai_timeout'])

/**
 * Factory chọn provider theo env. Thêm provider mới = thêm 1 file + 1 nhánh ở đây;
 * route/service không phải sửa. Interface: { name, generateQuestions({systemPrompt,userPrompt,timeoutMs}) -> string JSON }.
 */
export function getAIProvider(config) {
  if (config.AI_PROVIDER && !['gemini', 'groq'].includes(String(config.AI_PROVIDER).toLowerCase())) {
    throw new HttpError('Chức năng AI chưa được cấu hình trên máy chủ.', 503, 'ai_not_configured')
  }
  const groq = config.GROQ_API_KEY ? createGroqProvider({ apiKey: config.GROQ_API_KEY, model: config.GROQ_MODEL || 'openai/gpt-oss-20b', fetchImpl: config.fetchImpl || fetch }) : null
  if (config.GEMINI_API_KEY) {
    const gemini = createGeminiProvider({ apiKey: config.GEMINI_API_KEY, model: config.GEMINI_MODEL || 'gemini-2.5-flash', fetchImpl: config.fetchImpl || fetch })
    return {
      name: 'gemini',
      async generateQuestions(args) {
        try { return await gemini.generateQuestions(args) } catch (error) {
          if (!groq || !RECOVERABLE.has(error?.code)) throw error
          console.warn('[ai] provider gemini -> groq fallback')
          const result = await groq.generateQuestions(args)
          this.name = 'gemini -> groq'
          return result
        }
      },
    }
  }
  if (groq) return groq
  throw new HttpError('Chức năng AI chưa được cấu hình trên máy chủ.', 503, 'ai_not_configured')
}
