import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const DATA_PATH = new URL('../../../../shared/word-chain-seed.json', import.meta.url)
const DICTIONARY_PATH = new URL('../../../../shared/vi-dictionary.txt', import.meta.url)
const DICTIONARY_VERSION = 'viet74k-seed-2026-10-11.2'
const seed = JSON.parse(readFileSync(fileURLToPath(DATA_PATH), 'utf8'))

export const TOPICS = Object.freeze(Object.keys(seed.topics))

/** Canonical comparison form. Punctuation and hyphens split syllables; combining
 * marks are preserved after NFKC so Vietnamese tone marks remain significant. */
export function normalizePhrase(value) {
  if (typeof value !== 'string') return ''
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('vi-VN')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/[^\p{L}\p{M}\s]/gu, ' ')
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .join(' ')
}

/** Từ điển tiếng Việt (2–4 tiếng, đã chuẩn hóa). Mọi đáp án và từ khởi đầu phải nằm trong tập này. */
const DICTIONARY = new Set(readFileSync(fileURLToPath(DICTIONARY_PATH), 'utf8').split('\n').map((line) => line.trim()).filter(Boolean))
const TWO_SYLLABLE = [...DICTIONARY].filter((phrase) => phrase.split(' ').length === 2)
const BY_SYLLABLE = new Map()
for (const phrase of TWO_SYLLABLE) for (const syllable of phrase.split(' ')) {
  if (!BY_SYLLABLE.has(syllable)) BY_SYLLABLE.set(syllable, [])
  BY_SYLLABLE.get(syllable).push(phrase)
}
// Chỉ mục theo TIẾNG ĐẦU (mọi cụm 2–4 tiếng): dùng để tìm đáp án gợi ý khi hết giờ và để đảm bảo luôn có nước nối.
const BY_FIRST_SYLLABLE = new Map()
for (const phrase of DICTIONARY) {
  const first = phrase.split(' ')[0]
  if (!first) continue
  if (!BY_FIRST_SYLLABLE.has(first)) BY_FIRST_SYLLABLE.set(first, [])
  BY_FIRST_SYLLABLE.get(first).push(phrase)
}

export const DICTIONARY_SIZE = DICTIONARY.size
export const isDictionaryPhrase = (value) => DICTIONARY.has(normalizePhrase(value))
export const dictionaryTwoSyllablePhrases = () => TWO_SYLLABLE
export const dictionaryPhrasesWithSyllable = (syllable) => BY_SYLLABLE.get(normalizePhrase(syllable)) || []
/** Các cụm từ trong từ điển bắt đầu bằng đúng tiếng `syllable`. */
export const dictionaryPhrasesStartingWith = (syllable) => BY_FIRST_SYLLABLE.get(normalizePhrase(syllable)) || []

export function countSyllables(phrase) {
  const normalized = normalizePhrase(phrase)
  return normalized ? normalized.split(' ').length : 0
}

export function phraseFromText(value, { maxLength = 80 } = {}) {
  if (typeof value !== 'string' || value.length > maxLength) return ''
  return normalizePhrase(value)
}

export function topicPhrases(topic) {
  const wanted = normalizePhrase(topic)
  const matching = seed.topics[wanted] || []
  return { phrases: [...new Set(matching.map(normalizePhrase).filter((phrase) => phrase && DICTIONARY.has(phrase)))], version: DICTIONARY_VERSION }
}

export const MAX_TOPIC_PHRASES = 8000

/** Mở rộng chủ đề: từ gợi ý của AI (nếu có) + các từ trong từ điển chứa tiếng khóa. Chỉ trả từ có nghĩa. */
export function expandTopicPhrases(topic, aiSuggestions = null) {
  const ai = aiSuggestions || {}
  const wanted = normalizePhrase(topic)
  const result = new Set()
  const add = (phrase) => { if (result.size < MAX_TOPIC_PHRASES && DICTIONARY.has(phrase) && phrase.split(' ').length === 2) result.add(phrase) }
  for (const phrase of (ai.phrases || []).map(normalizePhrase)) add(phrase)
  for (const phrase of topicPhrases(wanted).phrases) add(phrase)
  const topicSyllables = wanted.split(' ').filter(Boolean)
  const keywords = [...new Set([...topicSyllables, ...(ai.keywords || []).map(normalizePhrase).filter((word) => word && !word.includes(' '))])]
  for (const syllable of topicSyllables) for (const phrase of dictionaryPhrasesWithSyllable(syllable)) add(phrase)
  for (const syllable of keywords) for (const phrase of dictionaryPhrasesWithSyllable(syllable)) add(phrase)
  return { phrases: [...result], version: DICTIONARY_VERSION }
}

/** Vietnamese word-chain phrases are two syllables. Strict mode permits only
 * adjacent pairs from the source text; expanded mode permits pairs formed from
 * the source text's vocabulary only. This remains a transparent syllable heuristic. */
export function extractTextPhrases(text, validationMode = 'strict') {
  const mode = validationMode === 'free' ? 'strict' : validationMode
  const tokens = normalizePhrase(text).split(' ').filter(Boolean)
  const phrases = new Set()
  if (mode === 'strict') {
    for (let start = 0; start + 1 < tokens.length; start += 1) phrases.add(tokens.slice(start, start + 2).join(' '))
  } else {
    const vocabulary = new Set(tokens)
    // Mở rộng chỉ ghép các từ CÓ NGHĨA: duyệt từ điển thay vì ghép mọi cặp tiếng.
    for (const phrase of TWO_SYLLABLE) {
      const [first, second] = phrase.split(' ')
      if (vocabulary.has(first) && vocabulary.has(second)) phrases.add(phrase)
    }
  }
  return phrases
}

export function buildPhraseSet({ sourceMode, topic, text, validationMode, aiTopic }) {
  const base = new Set()
  if (sourceMode === 'topic' || sourceMode === 'combined') {
    for (const phrase of expandTopicPhrases(topic, aiTopic).phrases) base.add(phrase)
  }
  if (sourceMode === 'text' || sourceMode === 'combined') {
    for (const phrase of extractTextPhrases(text, validationMode)) base.add(phrase)
  }
  // Mọi cụm từ trong nguồn phải là từ có nghĩa trong từ điển (chặn "ksshdjs", "nại ra"...).
  return { phrases: [...base].filter((phrase) => phrase && DICTIONARY.has(phrase)), version: DICTIONARY_VERSION }
}

/** Mẫu ngẫu nhiên từ điển 2 tiếng, dùng làm kho từ khởi đầu cho luật Tự do khi nguồn quá nghèo. */
export function sampleDictionaryPhrases(limit = 3000) {
  const pool = [...TWO_SYLLABLE]
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]]
  }
  return pool.slice(0, limit)
}
