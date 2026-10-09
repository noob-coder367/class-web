import { HttpError } from '../../lib/httpError.js'
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

async function readJson(response) {
  try { return await response.json() } catch { return null }
}

function safeErrorDetails(payload, fallbackStatus) {
  return {
    message: typeof payload?.error?.message === 'string' ? payload.error.message : 'Unknown Gemini error',
    status: typeof payload?.error?.status === 'string' ? payload.error.status : String(fallbackStatus),
  }
}

export async function listGeminiModels({ apiKey, fetchImpl = fetch, timeoutMs = 5000 }) {
  const response = await fetchImpl(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(timeoutMs) })
  const payload = await readJson(response)
  if (!response.ok) {
    const error = safeErrorDetails(payload, response.status)
    throw new Error(`Gemini models.list failed: ${error.status}: ${error.message}`)
  }
  return (Array.isArray(payload?.models) ? payload.models : [])
    .filter((item) => item?.supportedGenerationMethods?.includes('generateContent'))
    .map((item) => String(item.name || '').replace(/^models\//, ''))
    .filter(Boolean)
}

export function createGeminiProvider({ apiKey, model, fetchImpl = fetch }) {
  return {
    name: 'gemini',
    async generateQuestions({ systemPrompt, userPrompt, timeoutMs }) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let response
      try {
        response = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            // Gemini 3.8 rejects legacy sampling parameters; its default thinking level is medium.
            generationConfig: { responseMimeType: 'application/json' },
          }),
          signal: controller.signal,
        })
      } catch (error) {
        if (error?.name === 'AbortError') throw new HttpError('AI phản hồi quá lâu. Vui lòng thử lại.', 504, 'ai_timeout')
        throw new HttpError('Không kết nối được dịch vụ AI. Vui lòng thử lại sau.', 503, 'ai_unavailable')
      } finally { clearTimeout(timer) }
      if (!response.ok) {
        const payload = await readJson(response)
        const errorDetails = safeErrorDetails(payload, response.status)
        console.error('[ai:gemini] provider error', { model, error: errorDetails })
        if (response.status === 404) {
          try {
            const availableModels = await listGeminiModels({ apiKey, fetchImpl })
            console.error('[ai:gemini] models.list generateContent', { models: availableModels })
          } catch (error) {
            console.error('[ai:gemini] models.list failed', { message: error.message })
          }
          throw new HttpError('Model Gemini được cấu hình không tồn tại hoặc không hỗ trợ tạo nội dung.', 503, 'ai_model_not_found')
        }
        if (response.status === 401 || response.status === 403) throw new HttpError('Dịch vụ AI Gemini chưa được cấu hình đúng trên máy chủ.', 503, 'ai_not_configured')
        if (response.status === 429 || response.status >= 500) throw new HttpError('Dịch vụ AI Gemini đang tạm thời quá tải.', 503, 'ai_unavailable')
        throw new HttpError('Yêu cầu Gemini không hợp lệ.', 400, 'ai_invalid_request')
      }
      let payload
      try { payload = await response.json() } catch { throw new HttpError('Gemini trả về dữ liệu không hợp lệ.', 502, 'invalid_ai_output') }
      const content = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim()
      if (!content) throw new HttpError('Gemini trả về dữ liệu không hợp lệ.', 502, 'invalid_ai_output')
      return content
    },
  }
}
