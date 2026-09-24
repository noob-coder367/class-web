import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { classTabPath } from '../lib/routes.js'
import {
  chatWithAI,
  deleteAIConversation,
  getAIConversation,
  getAIQuota,
  listAIConversations,
} from '../services/aiService.js'
import './AIAssistantPage.css'

const SUGGESTIONS = [
  '📅 Mai học gì?',
  '📝 Mai có bài gì?',
  '📚 Tuần này có kiểm tra gì?',
  '🔔 Thông báo mới nhất?',
]

function IconMenu() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
}
function IconDoor() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 20h14M7 20V5.5a1 1 0 0 1 .8-1l7-1.5a1 1 0 0 1 1.2 1V20M11 12h.01M16 20h3" /><path d="m13 12 3-2v4l-3-2Z" /></svg>
}
function IconArrowUp() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" /></svg>
}
function IconSparkles() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3.5 13.5 8l4.5 1.5-4.5 1.5L12 15.5l-1.5-4.5L6 9.5 10.5 8Z" /><path d="m18.5 14.5.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6Z" /><path d="m5.5 14 .45 1.55 1.55.45-1.55.45L5.5 18l-.45-1.55-1.55-.45 1.55-.45Z" /></svg>
}
function IconPlus() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
}
function IconTrash() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg>
}
function IconClose() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
}

function renderInline(text) {
  return String(text || '').split(/(\*\*[^*]+\*\*)/g).map((part, index) => /^\*\*[^*]+\*\*$/.test(part)
    ? <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
    : <span key={`${part}-${index}`}>{part}</span>)
}
function SafeMessage({ content }) {
  return <div className="ai-message-copy">{String(content || '').split(/\r?\n/).map((line, index) => {
    const bullet = /^\s*[-*•]\s+/.test(line)
    const value = bullet ? line.replace(/^\s*[-*•]\s+/, '') : line
    return <span className={bullet ? 'ai-message-line ai-message-line--bullet' : 'ai-message-line'} key={`${index}-${line}`}>
      {bullet ? <span aria-hidden="true">•</span> : null}{renderInline(value)}
    </span>
  })}</div>
}
function QuotaCircle({ quota }) {
  const used = Math.min(Math.max(Number(quota?.used) || 0, 0), Number(quota?.limit) || 20)
  const limit = Number(quota?.limit) || 20
  const percent = Math.round((used / limit) * 100)
  return <div className="ai-quota-wrap" title={`${used}/${limit} lượt chat hôm nay`} aria-label={`Đã dùng ${percent}% quota AI hôm nay`}>
    <div className="ai-quota-circle" style={{ '--ai-quota-percent': `${percent}%` }}><span>{percent}%</span></div>
  </div>
}
function formatConversationDate(value) {
  if (!value) return ''
  try { return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(new Date(value)) } catch { return '' }
}

export default function AIAssistantPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [quota, setQuota] = useState({ used: 0, limit: 20, remaining: 20 })
  const [conversations, setConversations] = useState([])
  const [conversationId, setConversationId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [quotaModal, setQuotaModal] = useState(false)
  const textareaRef = useRef(null)
  const messagesRef = useRef(null)

  const conversation = useMemo(() => messages.filter((item) => item.role === 'user' || item.role === 'assistant').map(({ role, content }) => ({ role, content })), [messages])

  const refreshConversations = async () => {
    const result = await listAIConversations()
    setConversations(result?.conversations || [])
  }
  const refreshQuota = async () => {
    const result = await getAIQuota()
    setQuota({ used: result?.used || 0, limit: result?.limit || 20, remaining: result?.remaining ?? 20 })
  }

  useEffect(() => {
    Promise.all([refreshQuota(), refreshConversations()]).catch((err) => setError(err?.message || 'Không tải được dữ liệu AI.'))
    textareaRef.current?.focus()
  }, [])
  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const openConversation = async (id) => {
    if (loading) return
    setError('')
    try {
      const result = await getAIConversation(id)
      setConversationId(result?.conversation?.id || id)
      setMessages((result?.messages || []).map(({ role, content }) => ({ role, content })))
      setSidebarOpen(false)
    } catch (err) { setError(err?.message || 'Không tải được cuộc trò chuyện.') }
  }
  const newConversation = () => {
    if (loading) return
    setConversationId(null)
    setMessages([])
    setError('')
    setSidebarOpen(false)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }
  const removeConversation = async (event, id) => {
    event.stopPropagation()
    if (!window.confirm('Xóa cuộc trò chuyện này?')) return
    try {
      await deleteAIConversation(id)
      setConversations((prev) => prev.filter((item) => item.id !== id))
      if (conversationId === id) newConversation()
    } catch (err) { setError(err?.message || 'Không xóa được cuộc trò chuyện.') }
  }

  const isConversationNotFound = (err) => err?.status === 404 && /Không tìm thấy cuộc trò chuyện/.test(String(err?.message || ''))

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
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit() }
  }
  const handleBack = () => navigate(classTabPath('ai'))
  const hasConversation = messages.length > 0 || loading

  return <main className="ai-page" aria-label="AI Assistant Class-Web">
    {sidebarOpen ? <button type="button" className="ai-sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Đóng lịch sử chat" /> : null}
    <aside className={`ai-sidebar${sidebarOpen ? ' is-open' : ''}`} aria-label="Lịch sử chat">
      <div className="ai-sidebar-head"><div><p>Lịch sử</p><h2>Cuộc trò chuyện</h2></div><button type="button" className="ai-icon-button" onClick={() => setSidebarOpen(false)} aria-label="Đóng sidebar"><IconClose /></button></div>
      <button type="button" className="ai-new-chat-button" onClick={newConversation}><IconPlus /> Cuộc trò chuyện mới</button>
      <div className="ai-conversation-list">
        {conversations.length ? conversations.map((item) => <button type="button" className={`ai-conversation-item${conversationId === item.id ? ' is-active' : ''}`} key={item.id} onClick={() => openConversation(item.id)}>
          <span className="ai-conversation-title">{item.title || 'Cuộc trò chuyện'}</span><span className="ai-conversation-meta">{formatConversationDate(item.updated_at)}<span role="button" tabIndex={0} className="ai-delete-conversation" onClick={(event) => removeConversation(event, item.id)} onKeyDown={(event) => { if (event.key === 'Enter') removeConversation(event, item.id) }} aria-label={`Xóa ${item.title}`}><IconTrash /></span></span>
        </button>) : <p className="ai-history-empty">Chưa có cuộc trò chuyện nào.</p>}
      </div>
    </aside>
    <header className="ai-page-header">
      <div className="ai-header-actions"><button type="button" className="ai-back-button" onClick={() => setSidebarOpen(true)} aria-label="Mở lịch sử chat" title="Lịch sử chat"><IconMenu /></button><button type="button" className="ai-exit-button" onClick={handleBack} aria-label="Quay về lớp" title="Quay về lớp"><IconDoor /></button><span className="ai-online-dot" aria-label="AI Assistant sẵn sàng" title="Sẵn sàng" /><QuotaCircle quota={quota} /></div>
      <div className="ai-page-brand"><span className="ai-page-brand-mark"><IconSparkles /></span><div><p>Class-Web</p><h1>AI Assistant</h1></div></div>
    </header>
    <section className="ai-chat-shell">
      <div className="ai-messages" ref={messagesRef} aria-live="polite">
        {!hasConversation ? <div className="ai-welcome"><div className="ai-welcome-icon"><IconSparkles /></div><p className="ai-eyebrow">Trợ lý lớp học 10A4</p><h2>Xin chào! Tôi có thể giúp gì cho bạn?</h2><p className="ai-welcome-subtitle">Hỏi mình về thời khóa biểu, bài tập, kiểm tra hoặc thông báo của lớp.</p><div className="ai-suggestions" aria-label="Câu hỏi gợi ý">{SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion} onClick={() => submit(suggestion)} disabled={loading}>{suggestion}</button>)}</div></div> : <div className="ai-message-list">{messages.map((item, index) => <div className={`ai-message-row ai-message-row--${item.role}`} key={`${item.role}-${index}`}><div className={`ai-message-bubble ai-message-bubble--${item.role}`}>{item.role === 'assistant' ? <div className="ai-avatar" aria-hidden="true"><IconSparkles /></div> : null}<SafeMessage content={item.content} /></div></div>)}{loading ? <div className="ai-message-row ai-message-row--assistant"><div className="ai-message-bubble ai-message-bubble--assistant ai-thinking"><span /><span /><span /><em>Đang suy nghĩ...</em></div></div> : null}{error ? <div className="ai-error-state" role="alert"><span>{error}</span><button type="button" onClick={() => submit(messages.findLast((item) => item.role === 'user')?.content, isConversationNotFound({ status: 404, message: error }) ? null : conversationId)} disabled={loading}>Thử lại</button></div> : null}</div>}
      </div>
      <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); submit() }}><label className="sr-only" htmlFor="ai-message-input">Hỏi AI về lớp học</label><textarea id="ai-message-input" ref={textareaRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} placeholder="Hỏi AI về lớp học..." rows={1} maxLength={2000} disabled={loading} /><button type="submit" className="ai-send-button" aria-label="Gửi tin nhắn" title="Gửi tin nhắn" disabled={!draft.trim() || loading}><IconArrowUp /></button></form>
      <p className="ai-composer-hint">Enter để gửi · Shift + Enter để xuống dòng</p>
    </section>
    {quotaModal ? <div className="ai-modal-backdrop" role="presentation"><div className="ai-quota-modal" role="dialog" aria-modal="true" aria-labelledby="ai-quota-title"><div className="ai-quota-modal-icon"><IconSparkles /></div><h2 id="ai-quota-title">Bạn đã sử dụng hết lượt chat hôm nay.</h2><p>Vui lòng quay lại vào ngày mai để tiếp tục trò chuyện với AI.</p><button type="button" onClick={() => setQuotaModal(false)}>Đóng</button></div></div> : null}
  </main>
}
