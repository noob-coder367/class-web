import { buildPhraseSet, countSyllables, extractTextPhrases, isDictionaryPhrase, normalizePhrase, sampleDictionaryPhrases, TOPICS } from './wordChainDictionary.js'

export const MAX_TURNS = 200
export const MAX_TEXT_LENGTH = 20_000
export const MAX_TOPIC_LENGTH = 80

export class WordChainRuleError extends Error {
  constructor(message, code = 'invalid_word_chain_answer') {
    super(message)
    this.name = 'WordChainRuleError'
    this.code = code
  }
}

export function allocateTurns(teamCount, totalTurns) {
  if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > 8) throw new RangeError('Số đội phải từ 2 đến 8.')
  if (!Number.isInteger(totalTurns) || totalTurns < teamCount || totalTurns > MAX_TURNS) throw new RangeError(`Tổng lượt phải từ ${teamCount} đến ${MAX_TURNS}.`)
  const base = Math.floor(totalTurns / teamCount)
  const remainder = totalTurns % teamCount
  return Array.from({ length: teamCount }, (_, index) => base + (index < remainder ? 1 : 0))
}

function hasChain(phrases) {
  return phrases.some((phrase) => phrase.split(' ').length >= 2 && phrases.some((next) => next !== phrase && next.split(' ')[0] === phrase.split(' ').at(-1)))
}

/**
 * Tạo kho cụm từ của trận. Mọi cụm từ đều là từ có nghĩa trong từ điển.
 * - topic: aiTopic ({ phrases, keywords }) do AI gợi ý (tuỳ chọn) + từ điển lọc theo chủ đề.
 * - validationMode 'free': đáp án được kiểm bằng TOÀN BỘ từ điển; kho này chỉ dùng để chọn từ khởi đầu.
 */
export function makePhraseSet({ sourceMode, topic = '', text = '', validationMode = 'strict', aiTopic = null }) {
  if (!['topic', 'text', 'combined'].includes(sourceMode)) throw new RangeError('Hãy chọn nguồn nội dung hợp lệ.')
  if (!['strict', 'expanded', 'free'].includes(validationMode)) throw new RangeError('Cách kiểm tra nội dung không hợp lệ.')
  if (String(topic).length > MAX_TOPIC_LENGTH) throw new RangeError(`Chủ đề không được dài quá ${MAX_TOPIC_LENGTH} ký tự.`)
  if (String(text).length > MAX_TEXT_LENGTH) throw new RangeError(`Văn bản không được dài quá ${MAX_TEXT_LENGTH} ký tự.`)
  const freeMode = validationMode === 'free'
  if (sourceMode !== 'text' && !normalizePhrase(topic) && !(freeMode && sourceMode === 'topic')) throw new RangeError('Hãy nhập chủ đề để tạo nguồn từ.')
  if (sourceMode !== 'topic' && !String(text).trim()) throw new RangeError('Hãy dán văn bản để tạo nguồn từ.')
  const built = buildPhraseSet({ sourceMode, topic, text, validationMode, aiTopic })
  let phrases = built.phrases.filter((phrase) => countSyllables(phrase) > 0)
  if (phrases.length > 10_000) throw new RangeError('Nguồn tạo quá nhiều cụm từ. Hãy rút ngắn văn bản dưới 20.000 ký tự.')
  let fromDictionary = false
  if (freeMode && (phrases.length < 2 || !hasChain(phrases))) {
    // Tự do: nguồn nghèo thì lấy từ khởi đầu từ chính từ điển tiếng Việt.
    phrases = [...new Set([...phrases, ...sampleDictionaryPhrases(3000)])]
    fromDictionary = true
  }
  if (phrases.length < 2) throw new RangeError('Nguồn nội dung quá ngắn hoặc chưa có đủ từ có nghĩa trong từ điển. Hãy thêm văn bản hoặc chọn chủ đề khác.')
  if (!hasChain(phrases)) throw new RangeError('Nguồn chưa có cụm từ khởi đầu và nước nối hợp lệ. Hãy thêm văn bản hoặc đổi nguồn.')
  return { ...built, phrases, fromDictionary, extractedCount: sourceMode === 'topic' ? phrases.length : extractTextPhrases(text, validationMode).size }
}

export function chooseStartingPhrase(phrases = []) {
  const normalized = [...new Set(phrases.map(normalizePhrase).filter(Boolean))]
  const candidates = normalized.filter((phrase) => phrase.split(' ').length >= 2 && isDictionaryPhrase(phrase) && normalized.some((next) => next !== phrase && next.split(' ')[0] === phrase.split(' ').at(-1)))
  if (!candidates.length) throw new RangeError('Nguồn chưa có cụm từ khởi đầu và nước nối hợp lệ. Hãy thêm văn bản hoặc đổi nguồn.')
  return candidates[Math.floor(Math.random() * candidates.length)]
}

export function validateAnswer({ answer, lastPhrase = '', allowedPhrases, usedPhrases = [], validationMode = 'strict' }) {
  const phrase = normalizePhrase(answer)
  if (!phrase) throw new WordChainRuleError('Hãy nhập một từ hoặc cụm từ có chữ cái.', 'empty_answer')
  if (phrase.length > 80) throw new WordChainRuleError('Đáp án không được dài quá 80 ký tự.', 'answer_too_long')
  const firstWord = phrase.split(' ')[0]
  const finalWord = phrase.split(' ').at(-1)
  const previousFinal = normalizePhrase(lastPhrase).split(' ').filter(Boolean).at(-1) || ''
  if (previousFinal && firstWord !== previousFinal) {
    throw new WordChainRuleError(`Cụm từ phải bắt đầu bằng “${previousFinal}”.`, 'word_chain_mismatch')
  }
  if (usedPhrases.some((used) => normalizePhrase(used) === phrase)) {
    throw new WordChainRuleError('Cụm từ này đã được dùng trong trận.', 'duplicate_answer')
  }
  const syllables = phrase.split(' ').length
  if (syllables < 2 || !isDictionaryPhrase(phrase)) {
    throw new WordChainRuleError(`“${phrase}” không phải từ có nghĩa trong từ điển tiếng Việt (cần từ 2–4 tiếng).`, 'not_in_dictionary')
  }
  if (validationMode !== 'free' && !allowedPhrases.has(phrase)) {
    throw new WordChainRuleError('Cụm từ chưa nằm trong nguồn nội dung của trận.', 'phrase_not_in_source')
  }
  return { phrase, firstWord, finalWord }
}

export function getTurnTeamIndex(turnsUsed, quotas, startingIndex = 0) {
  if (!quotas.length) return -1
  for (let offset = 0; offset < quotas.length; offset += 1) {
    const index = (startingIndex + offset) % quotas.length
    if (turnsUsed[index] < quotas[index]) return index
  }
  return -1
}

export { TOPICS, normalizePhrase, extractTextPhrases, isDictionaryPhrase }
