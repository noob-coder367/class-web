import { apiClient } from './apiClient.js'

export function getAIQuota() {
  return apiClient.get('/ai/quota', { auth: true, retry: false })
}

export function listAIConversations() {
  return apiClient.get('/ai/conversations', { auth: true, retry: false })
}

export function getAIConversation(id) {
  return apiClient.get(`/ai/conversations/${encodeURIComponent(id)}`, { auth: true, retry: false })
}

export function deleteAIConversation(id) {
  return apiClient.delete(`/ai/conversations/${encodeURIComponent(id)}`, { auth: true, retry: false })
}

export function chatWithAI(message, conversation = [], conversationId = null) {
  return apiClient.post(
    '/ai/chat',
    { message, conversation, conversationId },
    { auth: true, retry: false, timeoutMs: 30_000 }
  )
}
