import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations')
const answerMigration = readdirSync(root).find((name) => name.endsWith('_game_atomicity.sql'))
const sql = answerMigration ? readFileSync(resolve(root, answerMigration), 'utf8') : ''
const answerFunction = sql.slice(sql.indexOf('create or replace function public.submit_game_answer_atomic'), sql.indexOf('revoke all on function public.submit_game_answer_atomic'))

test('atomic answer RPC claims request before answer writes and rejects stale/late game state', () => {
  assert.ok(answerFunction, 'game_atomicity migration with answer RPC must exist')
  assert.match(answerFunction, /for update/i)
  assert.match(answerFunction, /insert into public\.game_action_claims[\s\S]*?on conflict \(user_id, request_id, action\) do nothing[\s\S]*?if not found then\s+return false/i)
  assert.match(answerFunction, /v_game\.status <> 'playing'[\s\S]*?v_game\.phase <> 'question'[\s\S]*?v_game\.question_index <> p_expected_question_index/i)
  assert.match(answerFunction, /v_current_team is null or v_current_team <> p_team_id/i)
  assert.match(answerFunction, /insert into public\.game_turns/i)
  assert.match(answerFunction, /update public\.game_teams set[\s\S]*?correct_count = correct_count \+ case when p_is_correct then 1 else 0 end/i)
  assert.match(answerFunction, /update public\.game_rooms set status = 'finished'/i)
})
