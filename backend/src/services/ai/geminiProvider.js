import { HttpError } from '../../lib/httpError.js'
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
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
            generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
          }),
          signal: controller.signal,
        })
      } catch (error) {
        if (error?.name === 'AbortError') throw new HttpError('AI phản hồi quá lâu. Vui lòng thử lại.', 504, 'ai_timeout')
        throw new HttpError('Không kết nối được dịch vụ AI. Vui lòng thử lại sau.', 503, 'ai_unavailable')
      } finally { clearTimeout(timer) }
      if (!response.ok) {
        console.error(`[ai:gemini] provider responded ${response.status}`)
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
