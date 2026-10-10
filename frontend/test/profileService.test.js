import test from 'node:test'
import assert from 'node:assert/strict'
import { classifySupabaseError } from '../src/lib/profileErrors.js'

test('profile service phân biệt profile bị thiếu từ PGRST116', () => {
  assert.equal(classifySupabaseError({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }), 'missing')
})

test('profile service phân biệt lỗi RLS/quyền và schema', () => {
  assert.equal(classifySupabaseError({ code: '42501', message: 'new row violates row-level security policy' }), 'permission')
  assert.equal(classifySupabaseError({ code: '42703', message: 'column profiles.school does not exist' }), 'schema')
})

test('profile service phân biệt lỗi mạng và giữ thông báo thân thiện', () => {
  assert.equal(classifySupabaseError({ message: 'Failed to fetch' }), 'network')
  assert.equal('accessToken' in { kind: 'missing', code: 'PGRST116' }, false)
})
