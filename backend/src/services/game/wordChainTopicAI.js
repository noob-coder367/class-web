import { env } from '../../config/env.js'
import { getAIProvider } from '../ai/aiProvider.js'
import { normalizePhrase } from './wordChainDictionary.js'

const TIMEOUT_MS = 12_000
const MAX_ITEMS = 200

const SYSTEM_PROMPT = `Bạn là trợ lý cho trò chơi nối từ tiếng Việt. Người dùng đưa một chủ đề bất kỳ (có thể là một từ, một cụm từ hoặc một câu mô tả).
Hãy phân tích chủ đề và trả về DUY NHẤT một đối tượng JSON dạng:
{"keywords": ["..."], "phrases": ["..."]}
- "keywords": tối đa 40 TIẾNG (một âm tiết) tiếng Việt gắn chặt với chủ đề (ví dụ chủ đề "trường học": "trường", "lớp", "học", "bài", "thầy", "cô", "sách").
- "phrases": tối đa 150 từ ghép HAI tiếng, là từ có nghĩa trong từ điển tiếng Việt và liên quan trực tiếp tới chủ đề (ví dụ "học sinh", "giáo viên", "bài tập").
- Chỉ dùng tiếng Việt có dấu chuẩn, chữ thường, không số, không dấu câu, không giải thích.`

function parseJson(raw) {
  const cleaned = String(raw || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim()
  try { return JSON.parse(cleaned) } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null
    try { return JSON.parse(match[0]) } catch { return null }
  }
}

const cleanList = (value, { syllables }) => (Array.isArray(value) ? value : [])
  .map((item) => normalizePhrase(String(item)))
  .filter((item) => item && item.length <= 40 && item.split(' ').length === syllables)
  .slice(0, MAX_ITEMS)

/**
 * Nhờ AI phân tích chủ đề. Không bao giờ ném lỗi: nếu AI chưa cấu hình/lỗi/trả sai định dạng thì
 * trả null và trò chơi tự dùng bộ lọc từ điển theo chính các tiếng của chủ đề.
 */
export async function analyzeTopicWithAI(topic, { provider } = {}) {
  const wanted = String(topic || '').trim()
  if (!normalizePhrase(wanted)) return null
  try {
    const ai = provider || getAIProvider(env)
    const raw = await ai.generateQuestions({ systemPrompt: SYSTEM_PROMPT, userPrompt: `Chủ đề: ${wanted.slice(0, 80)}`, timeoutMs: TIMEOUT_MS })
    const data = parseJson(raw)
    if (!data || typeof data !== 'object') return null
    const keywords = cleanList(data.keywords, { syllables: 1 })
    const phrases = cleanList(data.phrases, { syllables: 2 })
    return keywords.length || phrases.length ? { keywords, phrases } : null
  } catch (error) {
    console.warn('[word-chain] topic AI unavailable, using dictionary filter:', error?.code || error?.message)
    return null
  }
}
