import seed from '../../../shared/word-chain-seed.json' with { type: 'json' }

export const WORD_CHAIN_TOPICS = Object.keys(seed.topics)
export const MAX_WORD_CHAIN_TURNS = 200
export const MAX_WORD_CHAIN_TEXT = 20_000
/** Mỗi đội có 60 giây cho một lượt; hết giờ hệ thống hiện đáp án. */
export const WORD_CHAIN_TURN_SECONDS = 60

export function normalizeWordChainPhrase(value) {
  if (typeof value !== 'string') return ''
  return value.normalize('NFKC').toLocaleLowerCase('vi-VN')
    .replace(/[\p{P}\p{S}]+/gu, ' ').replace(/[^\p{L}\p{M}\s]/gu, ' ')
    .trim().split(/\s+/u).filter(Boolean).join(' ')
}

export function allocateWordChainTurns(teamCount, totalTurns) {
  if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > 8) throw new Error('Số đội phải từ 2 đến 8.')
  if (!Number.isInteger(totalTurns) || totalTurns < teamCount || totalTurns > MAX_WORD_CHAIN_TURNS) throw new Error(`Tổng lượt phải từ ${teamCount} đến ${MAX_WORD_CHAIN_TURNS}.`)
  const base = Math.floor(totalTurns / teamCount)
  return Array.from({ length: teamCount }, (_, index) => base + (index < totalTurns % teamCount ? 1 : 0))
}

export function extractWordChainPhrases(text, validationMode = 'strict') {
  const tokens = normalizeWordChainPhrase(text).split(' ').filter(Boolean)
  const result = new Set()
  if (validationMode === 'strict' || validationMode === 'free') {
    for (let start = 0; start + 1 < tokens.length; start += 1) result.add(tokens.slice(start, start + 2).join(' '))
  } else {
    const vocabulary = [...new Set(tokens)]
    for (const first of vocabulary) for (const second of vocabulary) result.add(first + ' ' + second)
  }
  return result
}

/** Chọn từ khởi đầu: luôn có ít nhất một cụm khác để nối tiếp (đảm bảo có đáp án). */
export function chooseLocalStartingPhrase(phrases = []) {
  const normalized = [...new Set(phrases.map(normalizeWordChainPhrase).filter(Boolean))]
  const candidates = normalized.filter((phrase) => {
    const last = phrase.split(' ').at(-1)
    return phrase.split(' ').length >= 2 && normalized.some((next) => next !== phrase && next.split(' ')[0] === last)
  })
  if (!candidates.length) throw new Error('Nguồn chưa có cụm từ khởi đầu và nước nối hợp lệ. Hãy thêm văn bản hoặc đổi nguồn.')
  return candidates[Math.floor(Math.random() * candidates.length)]
}

let activeDictionary = null
let dictionaryPromise = null

/** Cho phép test/nơi khác nạp sẵn từ điển (Set các cụm từ đã chuẩn hóa). */
export function setWordChainDictionary(dictionary) { activeDictionary = dictionary instanceof Set ? dictionary : null }

/** Tải từ điển tiếng Việt khi cần (tách chunk riêng, chỉ tải khi chơi chế độ 1 máy). */
export function loadWordChainDictionary() {
  if (activeDictionary) return Promise.resolve(activeDictionary)
  dictionaryPromise ||= import('../../../shared/vi-dictionary.txt?raw')
    .then((module) => { activeDictionary = new Set(module.default.split('\n').map((line) => line.trim()).filter(Boolean)); return activeDictionary })
    .catch((error) => { dictionaryPromise = null; throw error })
  return dictionaryPromise
}

export function validateLocalWordChainAnswer(room, answer, dictionary = activeDictionary) {
  const phrase = normalizeWordChainPhrase(answer)
  if (!phrase) throw new Error('Hãy nhập một từ hoặc cụm từ có chữ cái.')
  if (phrase.length > 80) throw new Error('Đáp án không được dài quá 80 ký tự.')
  const words = phrase.split(' ')
  const lastPhrase = [...room.history].reverse().find((turn) => turn.action === 'answer')?.phrase || ''
  const previousFinal = normalizeWordChainPhrase(lastPhrase || room.starting_phrase).split(' ').at(-1) || ''
  if (previousFinal && words[0] !== previousFinal) throw new Error(`Cụm từ phải bắt đầu bằng “${previousFinal}”.`)
  if (normalizeWordChainPhrase(room.starting_phrase) === phrase || room.history.some((turn) => turn.action === 'answer' && turn.phrase === phrase)) throw new Error('Cụm từ này đã được dùng trong trận.')
  if (!dictionary) throw new Error('Từ điển tiếng Việt đang tải. Hãy thử lại sau giây lát.')
  if (words.length < 2 || !dictionary.has(phrase)) throw new Error(`“${phrase}” không phải từ có nghĩa trong từ điển tiếng Việt (cần từ 2–4 tiếng).`)
  if (room.validation_mode !== 'free' && !room.allowed_phrases.includes(phrase)) throw new Error('Cụm từ chưa nằm trong nguồn nội dung của trận.')
  return phrase
}

// Chỉ mục từ điển theo tiếng đầu, dựng một lần cho mỗi từ điển (dùng cho luật Tự do khi tìm đáp án).
let firstWordIndex = null
let firstWordIndexSource = null
function dictionaryByFirstWord(dictionary) {
  if (firstWordIndex && firstWordIndexSource === dictionary) return firstWordIndex
  const index = new Map()
  for (const phrase of dictionary) {
    const space = phrase.indexOf(' ')
    if (space < 1) continue
    const first = phrase.slice(0, space)
    const bucket = index.get(first)
    if (bucket) bucket.push(phrase)
    else index.set(first, [phrase])
  }
  firstWordIndex = index
  firstWordIndexSource = dictionary
  return index
}

/**
 * Chế độ 1 máy — tìm một đáp án HỢP LỆ để nối tiếp cụm cuối cùng (dùng khi hết 60 giây).
 * Cùng luật với validateLocalWordChainAnswer: có trong từ điển, chưa dùng, và (nếu không phải luật Tự do) nằm trong nguồn của trận.
 * Ưu tiên cụm mà đội kế tiếp vẫn còn nước nối. Trả về null nếu không còn cụm nào nối được.
 */
export function findLocalWordChainAnswer(room, dictionary = activeDictionary, random = Math.random) {
  if (!dictionary) throw new Error('Từ điển tiếng Việt đang tải. Hãy thử lại sau giây lát.')
  const free = room.validation_mode === 'free'
  const answers = (room.history || []).filter((turn) => turn.action === 'answer').map((turn) => turn.phrase)
  const last = answers.at(-1) || room.starting_phrase || ''
  const used = new Set([room.starting_phrase, ...answers].map(normalizeWordChainPhrase).filter(Boolean))
  const allowed = free ? null : [...new Set((room.allowed_phrases || []).map(normalizeWordChainPhrase).filter(Boolean))]
  const finalWordOf = (phrase) => normalizeWordChainPhrase(phrase).split(' ').filter(Boolean).at(-1) || ''
  const continuations = (word, taken) => {
    if (!word) return []
    const pool = free ? (dictionaryByFirstWord(dictionary).get(word) || []) : allowed.filter((phrase) => phrase.split(' ')[0] === word)
    return pool.filter((phrase) => phrase.length <= 80 && phrase.split(' ').length >= 2 && !taken.has(phrase) && dictionary.has(phrase))
  }
  const candidates = continuations(finalWordOf(last), used)
  if (!candidates.length) return null
  const shuffled = [...candidates]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]
  }
  for (const phrase of shuffled.slice(0, 40)) {
    const taken = new Set(used)
    taken.add(phrase)
    if (continuations(finalWordOf(phrase), taken).length) return phrase
  }
  return shuffled[0]
}

export function advanceLocalWordChain(room, action, answer = '', dictionary = activeDictionary) {
  if (room.status !== 'playing') throw new Error('Trận đã kết thúc.')
  const teamIndex = room.current_turn
  const team = room.teams[teamIndex]
  if (!team || team.turns_used >= team.turn_quota) throw new Error('Đội hiện tại đã hết lượt.')
  const phrase = action === 'answer' ? validateLocalWordChainAnswer(room, answer, dictionary) : null
  const turn = { id: crypto.randomUUID(), turn_number: room.turns_used + 1, team_id: team.id, action, phrase, created_at: new Date().toISOString() }
  const teams = room.teams.map((entry, index) => index === teamIndex ? { ...entry, turns_used: entry.turns_used + 1 } : entry)
  const turnsUsed = room.turns_used + 1
  let nextIndex = -1
  if (turnsUsed < room.total_turns) {
    for (let offset = 1; offset <= teams.length; offset += 1) {
      const candidate = (teamIndex + offset) % teams.length
      if (teams[candidate].turns_used < teams[candidate].turn_quota) { nextIndex = candidate; break }
    }
  }
  // turn_started_at: mốc bắt đầu lượt mới => đồng hồ 60 giây của đội kế tiếp.
  return { ...room, teams, turns_used: turnsUsed, history: [...room.history, turn], current_turn: nextIndex < 0 ? null : nextIndex, status: nextIndex < 0 ? 'finished' : 'playing', turn_started_at: nextIndex < 0 ? null : new Date().toISOString() }
}

/** Khôi phục trận 1 máy từ sessionStorage: không bao giờ ghi đè trạng thái đang chạy bằng bản lưu cũ hơn. */
export function restoreLocalRoom(current, saved) { return current || saved }
