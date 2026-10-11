import seed from '../../../shared/word-chain-seed.json' with { type: 'json' }

export const WORD_CHAIN_TOPICS = Object.keys(seed.topics)
export const MAX_WORD_CHAIN_TURNS = 200
export const MAX_WORD_CHAIN_TEXT = 20_000

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
  return { ...room, teams, turns_used: turnsUsed, history: [...room.history, turn], current_turn: nextIndex < 0 ? null : nextIndex, status: nextIndex < 0 ? 'finished' : 'playing' }
}

/** Khôi phục trận 1 máy từ sessionStorage: không bao giờ ghi đè trạng thái đang chạy bằng bản lưu cũ hơn. */
export function restoreLocalRoom(current, saved) { return current || saved }
