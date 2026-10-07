import { HttpError } from '../../lib/httpError.js'

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

/** Provider Groq (API tương thích OpenAI). Key chỉ nằm ở server (env). */
export function createGroqProvider({ apiKey, model, fetchImpl = fetch }) {
  return {
    name: 'groq',
    async generateQuestions({ systemPrompt, userPrompt, timeoutMs }) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let response
      try {
        response = await fetchImpl(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            temperature: 0.3,
            max_tokens: 8000,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          }),
          signal: controller.signal,
        })
      } catch (error) {
        if (error?.name === 'AbortError') throw new HttpError('AI phản hồi quá lâu. Vui lòng thử lại.', 504, 'ai_timeout')
        throw new HttpError('Không kết nối được dịch vụ AI. Vui lòng thử lại sau.', 503, 'ai_unavailable')
      } finally {
        clearTimeout(timer)
      }

      if (!response.ok) {
        // Chỉ log mã trạng thái, không log nội dung tài liệu hay body lỗi.
        console.error(`[ai:groq] provider responded ${response.status}`)
        if (response.status === 429) throw new HttpError('Dịch vụ AI đang quá tải. Vui lòng thử lại sau ít phút.', 503, 'ai_unavailable')
        if (response.status === 401 || response.status === 403) {
          throw new HttpError('Dịch vụ AI chưa được cấu hình đúng trên máy chủ.', 503, 'ai_not_configured')
        }
        throw new HttpError('Dịch vụ AI tạm thời không khả dụng.', 503, 'ai_unavailable')
      }

      let payload
      try {
        payload = await response.json()
      } catch {
        throw new HttpError('AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.', 502, 'invalid_ai_output')
      }
      const content = payload?.choices?.[0]?.message?.content
      if (typeof content !== 'string' || !content.trim()) {
        throw new HttpError('AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.', 502, 'invalid_ai_output')
      }
      return content
    },
  }
}
