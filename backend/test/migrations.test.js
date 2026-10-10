import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
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
