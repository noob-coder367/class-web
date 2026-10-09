import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { ROUTES } from '../lib/routes.js'

export function Brand() {
  return (
    <Link className="brand" to={ROUTES.home} aria-label="10A4-Quizz, về trang chủ">
      <span className="brand-mark" aria-hidden="true"><img src="/favicon.png" alt="" /></span>

      <span>10A4-Quizz</span>
    </Link>
  )
}

export function getDisplayName(profile, email = '') {
  return profile?.display_name || profile?.email?.split('@')[0] || email.split('@')[0] || 'Tài khoản'
}

export function getRoleLabel(role) {
  return role === 'admin' ? 'Quản trị viên' : 'Thành viên'
}

function AccountMenu() {
  const { profile, session, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)

  const email = profile?.email || session?.user?.email || ''
  const name = getDisplayName(profile, email)
  const initial = (name.trim().charAt(0) || '?').toUpperCase()

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleLogout = async () => {
    setOpen(false)
    navigate(ROUTES.home)
    await logout()
  }

  return (
    <div className="account" ref={rootRef}>
      <button
        ref={triggerRef}
        className="account-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="avatar" aria-hidden="true">{initial}</span>
        <span className="account-text">
          <span className="account-name">{email || name}</span>
          <span className="account-role">{getRoleLabel(profile?.role)}</span>
        </span>
        <svg className={`account-chevron${open ? ' is-open' : ''}`} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      {open && (
        <div className="account-menu" role="menu">
          <div className="account-menu-head">
            <strong title={email}>{email || name}</strong>
            <span>{getRoleLabel(profile?.role)}</span>
          </div>
          <Link className="account-item" role="menuitem" to={ROUTES.profile} onClick={() => setOpen(false)}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.7" /><path d="M5 19.5c.8-3.6 3.6-5.2 7-5.2s6.2 1.6 7 5.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
            Thông tin cá nhân
          </Link>
          {isAdmin && <Link className="account-item" role="menuitem" to={ROUTES.adminAccounts} onClick={() => setOpen(false)}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5h16v13H4zM8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Quản lý trình duyệt
          </Link>}
          <button className="account-item account-item-danger" role="menuitem" type="button" onClick={() => void handleLogout()}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10M14 8l4 4-4 4M18 12H9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  )
}

export default function SiteHeader() {
  const { authReady, isLoggedIn } = useAuth()
  return (
    <header className="site-nav">
      <div className="container nav-inner">
        <Brand />
        <nav className="nav-actions" aria-label="Điều hướng tài khoản">
          {!authReady ? null : isLoggedIn ? (
            <AccountMenu />
          ) : (
            <>
              <Link className="button button-quiet" to={ROUTES.login}>Đăng nhập</Link>
              <Link className="button button-primary" to={ROUTES.register}>Đăng ký</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
