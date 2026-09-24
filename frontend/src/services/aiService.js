import { apiClient } from './apiClient.js'

export function chatWithAI(message, conversation = []) {
  return apiClient.post(
    '/ai/chat',
    { message, conversation },
    { auth: true, retry: false, timeoutMs: 30_000 }
  )
}
