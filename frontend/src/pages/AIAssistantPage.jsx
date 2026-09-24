import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { classTabPath } from '../lib/routes.js'
import { chatWithAI } from '../services/aiService.js'
import './AIAssistantPage.css'

const SUGGESTIONS = [
  '📅 Mai học gì?',
  '📝 Mai có bài gì?',
  '📚 Tuần này có kiểm tra gì?',
  '🔔 Thông báo mới nhất?',
]

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

function IconArrowUp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" />
    </svg>
  )
}

function IconSparkles() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5 13.5 8l4.5 1.5-4.5 1.5L12 15.5l-1.5-4.5L6 9.5 10.5 8Z" />
      <path d="m18.5 14.5.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6Z" />
      <path d="m5.5 14 .45 1.55 1.55.45-1.55.45L5.5 18l-.45-1.55-1.55-.45 1.55-.45Z" />
    </svg>
  )
}

function renderInline(text) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
    }
    return <span key={`${part}-${index}`}>{part}</span>
  })
}

function SafeMessage({ content }) {
  const lines = String(content || '').split(/\r?\n/)
  return (
    <div className="ai-message-copy">
      {lines.map((line, index) => {
        const trimmed = line.trim()
        const isBullet = /^[-*•]\s+/.test(trimmed)
        const value = isBullet ? trimmed.replace(/^[-*•]\s+/, '') : line
        return (
          <span className={isBullet ? 'ai-message-line ai-message-line--bullet' : 'ai-message-line'} key={`${index}-${line}`}>
            {isBullet ? <span aria-hidden="true">•</span> : null}
            {renderInline(value)}
          </span>
        )
      })}
    </div>
  )
}

export default function AIAssistantPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef(null)
  const messagesRef = useRef(null)

  const conversation = useMemo(
    () => messages
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .map(({ role, content }) => ({ role, content })),
    [messages]
  )

  useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const submit = async (rawMessage = draft) => {
    const message = String(rawMessage || '').trim()
    if (!message || loading) return
    setDraft('')
    setError('')
    setMessages((prev) => [...prev, { role: 'user', content: message }])
    setLoading(true)
    try {
      const result = await chatWithAI(message, conversation)
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: result?.reply || 'AI hiện không thể trả lời. Vui lòng thử lại sau.',
      }])
    } catch (err) {
      setError(err?.message || 'AI hiện không thể trả lời. Vui lòng thử lại sau.')
    } finally {
      setLoading(false)
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  const handleBack = () => navigate(classTabPath('ai'))
  const hasConversation = messages.length > 0 || loading

  return (
    <main className="ai-page" aria-label="AI Assistant Class-Web">
      <header className="ai-page-header">
        <button type="button" className="ai-back-button" onClick={handleBack} aria-label="Quay về lớp" title="Quay về lớp">
          <IconMenu />
        </button>
        <div className="ai-page-brand">
          <span className="ai-page-brand-mark"><IconSparkles /></span>
          <div>
            <p>Class-Web</p>
            <h1>AI Assistant</h1>
          </div>
        </div>
        <span className="ai-online-dot" aria-label="AI Assistant sẵn sàng" title="Sẵn sàng" />
      </header>

      <section className="ai-chat-shell">
        <div className="ai-messages" ref={messagesRef} aria-live="polite">
          {!hasConversation ? (
            <div className="ai-welcome">
              <div className="ai-welcome-icon"><IconSparkles /></div>
              <p className="ai-eyebrow">Trợ lý lớp học 10A4</p>
              <h2>Xin chào! Tôi có thể giúp gì cho bạn?</h2>
              <p className="ai-welcome-subtitle">Hỏi mình về thời khóa biểu, bài tập, kiểm tra hoặc thông báo của lớp.</p>
              <div className="ai-suggestions" aria-label="Câu hỏi gợi ý">
                {SUGGESTIONS.map((suggestion) => (
                  <button type="button" key={suggestion} onClick={() => submit(suggestion)} disabled={loading}>
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="ai-message-list">
              {messages.map((item, index) => (
                <div className={`ai-message-row ai-message-row--${item.role}`} key={`${item.role}-${index}`}>
                  {item.role === 'assistant' ? <div className="ai-avatar" aria-hidden="true"><IconSparkles /></div> : null}
                  <div className={`ai-message-bubble ai-message-bubble--${item.role}`}>
                    <SafeMessage content={item.content} />
                  </div>
                </div>
              ))}
              {loading ? (
                <div className="ai-message-row ai-message-row--assistant">
                  <div className="ai-avatar" aria-hidden="true"><IconSparkles /></div>
                  <div className="ai-message-bubble ai-message-bubble--assistant ai-thinking" aria-label="AI đang suy nghĩ">
                    <span /> <span /> <span />
                    <em>Đang suy nghĩ...</em>
                  </div>
                </div>
              ) : null}
              {error ? (
                <div className="ai-error-state" role="alert">
                  <span>{error}</span>
                  <button type="button" onClick={() => submit(messages[messages.length - 1]?.content)} disabled={loading}>
                    Thử lại
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); submit() }}>
          <label className="sr-only" htmlFor="ai-message-input">Hỏi AI về lớp học</label>
          <textarea
            id="ai-message-input"
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi AI về lớp học..."
            rows={1}
            maxLength={2000}
            disabled={loading}
          />
          <button type="submit" className="ai-send-button" aria-label="Gửi tin nhắn" title="Gửi tin nhắn" disabled={!draft.trim() || loading}>
            <IconArrowUp />
          </button>
        </form>
        <p className="ai-composer-hint">Enter để gửi · Shift + Enter để xuống dòng</p>
      </section>
    </main>
  )
}
