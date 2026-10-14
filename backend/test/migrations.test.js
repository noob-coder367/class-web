import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations')

test('Supabase migrations have unique version prefixes', () => {
  const files = readdirSync(root).filter((name) => name.endsWith('.sql'))
  const byVersion = new Map()
  for (const file of files) {
    const version = file.split('_', 1)[0]
    const matches = byVersion.get(version) || []
    matches.push(file)
    byVersion.set(version, matches)
  }
  const duplicates = [...byVersion.entries()].filter(([, matches]) => matches.length > 1)
  assert.deepEqual(duplicates, [], `Duplicate migration versions: ${JSON.stringify(duplicates)}`)
})

test('public quiz migration keeps quizzes private by default and gates room use on owner/public status', () => {
  const sql = readFileSync(resolve(root, '20261011150750_public_quizzes.sql'), 'utf8')
  assert.match(sql, /add column if not exists is_public boolean not null default false/i)
  assert.match(sql, /save_quiz_with_questions_v2/i)
  assert.match(sql, /q\.owner_id = p_host_id or q\.is_public = true/i)
  assert.match(sql, /grant execute on function public\.save_quiz_with_questions_v2[\s\S]*to service_role/i)
})

test('guest room migration removes auth.users foreign keys only from room identity tables', () => {
  const sql = readFileSync(resolve(root, '20261015000100_guest_room_identities.sql'), 'utf8')
  for (const table of ['game_rooms', 'game_room_players', 'game_action_claims', 'word_chain_rooms', 'word_chain_players', 'word_chain_turns', 'word_chain_action_claims']) {
    assert.match(sql, new RegExp(`'public', '${table}'`))
  }
  assert.match(sql, /confrelid = 'auth\.users'::regclass/i)
  assert.doesNotMatch(sql, /grant\s+all\s+on\s+table/i)
})
