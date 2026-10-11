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
