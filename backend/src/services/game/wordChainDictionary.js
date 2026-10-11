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

/** Vietnamese word-chain phrases are two syllables. Strict mode permits only
 * adjacent pairs from the source text; expanded mode permits pairs formed from
 * the source text's vocabulary only. This remains a transparent syllable heuristic. */
export function extractTextPhrases(text, validationMode = 'strict') {
  const tokens = normalizePhrase(text).split(' ').filter(Boolean)
  const phrases = new Set()
  if (validationMode === 'strict') {
    for (let start = 0; start + 1 < tokens.length; start += 1) phrases.add(tokens.slice(start, start + 2).join(' '))
  } else {
    const vocabulary = [...new Set(tokens)]
    for (const first of vocabulary) for (const second of vocabulary) phrases.add(first + ' ' + second)
  }
  return phrases
}

export function buildPhraseSet({ sourceMode, topic, text, validationMode }) {
  const base = new Set()
  if (sourceMode === 'topic' || sourceMode === 'combined') {
    for (const phrase of topicPhrases(topic).phrases) base.add(phrase)
  }
  if (sourceMode === 'text' || sourceMode === 'combined') {
    for (const phrase of extractTextPhrases(text, validationMode)) base.add(phrase)
  }
  return { phrases: [...base].filter(Boolean), version: DICTIONARY_VERSION }
}
