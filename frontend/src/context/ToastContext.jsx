import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)
const VISIBLE_MS = 4000
const LEAVE_MS = 220
const MAX_TOASTS = 3

function ToastIcon({ type }) {
  return (
    <span className="toast-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
        {type === 'success'
          ? <path d="m6 12.5 4 4 8-9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M12 6.5v7M12 17.5v.01" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />}
      </svg>
    </span>
  )
}

/** Hệ thống thông báo DUY NHẤT của app: chỉ có 2 loại success / error. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Set())
  const nextId = useRef(0)

  useEffect(() => {
    const active = timers.current
    return () => active.forEach((timer) => clearTimeout(timer))
  }, [])

  const later = useCallback((callback, delay) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      callback()
    }, delay)
    timers.current.add(timer)
  }, [])

  const dismiss = useCallback((id) => {
    setToasts((list) => list.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)))
    later(() => setToasts((list) => list.filter((toast) => toast.id !== id)), LEAVE_MS)
  }, [later])

  const push = useCallback((type, message) => {
    const id = ++nextId.current
    setToasts((list) => [...list.slice(-(MAX_TOASTS - 1)), { id, type, message }])
    later(() => dismiss(id), VISIBLE_MS)
  }, [dismiss, later])

  const api = useMemo(() => ({
    success: (message) => push('success', message),
    error: (message) => push('error', message),
  }), [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}${toast.leaving ? ' is-leaving' : ''}`}
            role={toast.type === 'error' ? 'alert' : 'status'}
          >
            <ToastIcon type={toast.type} />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast phải được dùng bên trong <ToastProvider>')
  return context
}
