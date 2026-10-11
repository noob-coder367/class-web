import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const DATA_PATH = new URL('../../../../shared/word-chain-seed.json', import.meta.url)
const DICTIONARY_VERSION = 'project-seed-2026-10-11.1'
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
  return { phrases: [...new Set(matching.map(normalizePhrase).filter(Boolean))], version: DICTIONARY_VERSION }
}

/** A transparent heuristic: produce contiguous one-to-four-syllable n-grams.
 * This is not a Vietnamese morphological parser. */
export function extractTextPhrases(text) {
  const tokens = normalizePhrase(text).split(' ').filter(Boolean)
  const phrases = new Set()
  for (let start = 0; start < tokens.length; start += 1) {
    for (let length = 1; length <= 4 && start + length <= tokens.length; length += 1) {
      phrases.add(tokens.slice(start, start + length).join(' '))
    }
  }
  return phrases
}

export function buildPhraseSet({ sourceMode, topic, text, validationMode }) {
  const base = new Set()
  if (sourceMode === 'topic' || sourceMode === 'combined') {
    for (const phrase of topicPhrases(topic).phrases) base.add(phrase)
  }
  if (sourceMode === 'text' || sourceMode === 'combined') {
    for (const phrase of extractTextPhrases(text)) base.add(phrase)
  }
  if ((sourceMode === 'text' || sourceMode === 'combined') && validationMode === 'expanded') {
    // Expanded mode adds the curated open seed, while strict mode stays bounded to text n-grams.
    for (const phrases of Object.values(seed.topics)) {
      for (const phrase of phrases) base.add(normalizePhrase(phrase))
    }
  }
  return { phrases: [...base].filter(Boolean), version: DICTIONARY_VERSION }
}
