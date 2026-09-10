import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import './ProfileMenu.css'

const AVATAR_KEY = (uid) => `classweb_avatar_${uid}`

function DefaultAvatar() {
  return (
    <svg viewBox="0 0 40 40" className="profile-avatar-svg" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#1a6b8a" />
      <circle cx="20" cy="15" r="7" fill="#e8f4f8" />
      <ellipse cx="20" cy="32" rx="11" ry="9" fill="#e8f4f8" />
    </svg>
  )
}

export function getStoredAvatar(userId) {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(AVATAR_KEY(userId))
    if (!raw) return null
    const data = JSON.parse(raw)
    return data?.url || null
  } catch {
    return null
  }
}

export function getAvatarMeta(userId) {
  if (!userId) return { url: null, changes: [] }
  try {
    const raw = localStorage.getItem(AVATAR_KEY(userId))
    if (!raw) return { url: null, changes: [] }
    return JSON.parse(raw)
  } catch {
    return { url: null, changes: [] }
  }
}

export function saveAvatar(userId, dataUrl) {
  const meta = getAvatarMeta(userId)
  const now = Date.now()
  const dayAgo = now - 24 * 60 * 60 * 1000
  const recent = (meta.changes || []).filter((t) => t > dayAgo)
  if (recent.length >= 3) {
    throw new Error('Bạn chỉ được đổi ảnh đại diện tối đa 3 lần trong 24 giờ.')
  }
  const next = {
    url: dataUrl,
    changes: [...recent, now],
  }
  localStorage.setItem(AVATAR_KEY(userId), JSON.stringify(next))
  return next
}

export default function ProfileMenu({ onLogout }) {
  const { session, profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const wrapRef = useRef(null)

  const userId = session?.user?.id
  const googleAvatar =
    session?.user?.user_metadata?.avatar_url ||
    session?.user?.user_metadata?.picture ||
    null

  useEffect(() => {
    if (!userId) {
      setAvatarUrl(null)
      return
    }
    const stored = getStoredAvatar(userId)
    setAvatarUrl(stored || googleAvatar || null)
  }, [userId, googleAvatar])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const handleLogout = async () => {
    setOpen(false)
    await onLogout?.()
  }

  const handleOpenSettings = () => {
    setOpen(false)
    setShowSettings(true)
  }

  const displayName =
    profile?.username ||
    session?.user?.email?.split('@')[0] ||
    'Profile'

  return (
    <>
      <div className="profile-menu-wrap" ref={wrapRef}>
        <button
          type="button"
          className="profile-trigger"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <span className="profile-trigger-label">Profile</span>
          <span className="profile-trigger-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" />
            ) : (
              <DefaultAvatar />
            )}
          </span>
        </button>

        {open && (
          <div className="profile-dropdown" role="menu">
            <div className="profile-dropdown-email">
              {session?.user?.email || displayName}
            </div>
            <button
              type="button"
              className="profile-dropdown-item"
              role="menuitem"
              onClick={handleOpenSettings}
            >
              <span className="profile-dropdown-icon">⚙</span>
              Cài đặt
            </button>
            <button
              type="button"
              className="profile-dropdown-item profile-dropdown-item--danger"
              role="menuitem"
              onClick={handleLogout}
            >
              <span className="profile-dropdown-icon">↩</span>
              Đăng xuất
            </button>
          </div>
        )}
      </div>

      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          avatarUrl={avatarUrl}
          onAvatarChange={(url) => setAvatarUrl(url)}
        />
      )}
    </>
  )
}
