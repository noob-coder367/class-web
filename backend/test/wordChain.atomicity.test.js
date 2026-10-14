import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const sql = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations/20261011100100_word_chain_game.sql'), 'utf8')
const cancellationSql = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations/20261014000100_word_chain_room_cancellation.sql'), 'utf8')
const actionFunction = sql.slice(sql.indexOf('create or replace function public.apply_word_chain_turn_atomic'), sql.indexOf('revoke all on function public.create_word_chain_room_atomic'))

test('word-chain migration keeps direct client access closed and grants atomic RPC only to service_role', () => {
  assert.match(sql, /alter table public\.word_chain_rooms enable row level security/i)
  assert.match(sql, /revoke all on public\.word_chain_rooms[\s\S]*from anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.apply_word_chain_turn_atomic[\s\S]*to service_role/i)
  assert.match(sql, /unique index if not exists word_chain_turns_unique_phrase_idx/i)
  assert.match(sql, /payload_hash text not null check \(payload_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/i)
})

test('host cancellation adds a closed status while retaining the room rows and history', () => {
  assert.match(cancellationSql, /drop constraint if exists word_chain_rooms_status_check/i)
  assert.match(cancellationSql, /check \(status in \('lobby', 'playing', 'finished', 'cancelled'\)\)/i)
  assert.doesNotMatch(cancellationSql, /delete from public\.word_chain_(rooms|turns)/i)
})

test('atomic turn locks room and validates membership, active turn, source phrase, duplicate and quota', () => {
  assert.match(actionFunction, /from public\.word_chain_rooms where id = p_room_id for update/i)
  assert.match(actionFunction, /word_chain_players where room_id = p_room_id and user_id = p_user_id/i)
  assert.match(actionFunction, /v_player_team is distinct from v_room\.current_team_id/i)
  assert.match(actionFunction, /p_phrase = any\(v_room\.allowed_phrases\)/i)
  assert.match(actionFunction, /Phrase does not continue the final word/i)
  assert.match(actionFunction, /Phrase already used/i)
  assert.match(actionFunction, /v_existing_hash is distinct from p_payload_hash/i)
  assert.match(actionFunction, /turns_used = turns_used \+ 1/i)
})
