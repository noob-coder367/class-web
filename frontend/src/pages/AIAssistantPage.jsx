const isConversationNotFound = (err) =>
  err?.status === 404 && /Không tìm thấy cuộc trò chuyện/.test(String(err?.message || ''))

const submit = async (rawMessage = draft, forcedConversationId = conversationId) => {
  const message = String(rawMessage || '').trim()
  if (!message || loading) return
  if (Number(quota.remaining) <= 0) { setQuotaModal(true); return }
  setDraft('')
  setError('')
  setMessages((prev) => [...prev, { role: 'user', content: message }])
  setLoading(true)
  try {
    const result = await chatWithAI(message, conversation, forcedConversationId)
    setMessages((prev) => [...prev, { role: 'assistant', content: result?.reply || 'AI hiện không thể trả lời. Vui lòng thử lại sau.' }])
    if (result?.conversationId) setConversationId(result.conversationId)
    if (result?.quota) setQuota(result.quota)
    await refreshConversations()
  } catch (err) {
    let finalError = err
    if (isConversationNotFound(err) && forcedConversationId) {
      setConversationId(null)
      try {
        const result = await chatWithAI(message, conversation, null)
        setMessages((prev) => [...prev, { role: 'assistant', content: result?.reply || 'AI hiện không thể trả lời. Vui lòng thử lại sau.' }])
        if (result?.conversationId) setConversationId(result.conversationId)
        if (result?.quota) setQuota(result.quota)
        await refreshConversations()
        return
      } catch (retryError) {
        finalError = retryError
      }
    }
    if (finalError?.status === 429) {
      setQuotaModal(true)
      await refreshQuota().catch(() => {})
    }
    setError(finalError?.message || 'AI hiện không thể trả lời. Vui lòng thử lại sau.')
  } finally {
    setLoading(false)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }
}