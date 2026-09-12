import { useState, useRef, useMemo, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useWeather } from '../context/WeatherContext.jsx'
import { supabase } from '../lib/supabaseClient.js'
import * as authService from '../services/authService.js'
import {
  isPushEnabledPref,
  requestPermissionAndSubscribe,
  unsubscribePush,
  getNotificationPermission,
} from '../services/pushService.js'
import { saveAvatar, getAvatarMeta } from './ProfileMenu.jsx'
import './SettingsPanel.css'

function DefaultAvatarLarge() {
  return (
    <svg viewBox="0 0 80 80" className="settings-avatar-svg" aria-hidden="true">
      <circle cx="40" cy="40" r="40" fill="#1a6b8a" />
      <circle cx="40" cy="30" r="14" fill="#e8f4f8" />
      <ellipse cx="40" cy="64" rx="22" ry="18" fill="#e8f4f8" />
    </svg>
  )
}

export default function SettingsPanel({ onClose, avatarUrl, onAvatarChange }) {
  const { session, profile, reloadProfile } = useAuth()
  const { permission, setLocationEnabled } = useWeather()
  const [tab, setTab] = useState('info')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [avatarMsg, setAvatarMsg] = useState('')
  const fileRef = useRef(null)

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameMsg, setNameMsg] = useState('')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameStatus, setNameStatus] = useState({ remaining: 2, max: 2 })

  const [pushOn, setPushOn] = useState(isPushEnabledPref() && getNotificationPermission() === 'granted')
  const [pushMsg, setPushMsg] = useState('')
  const [pushLoading, setPushLoading] = useState(false)

  const user = session?.user
  const userId = user?.id

  const hasPasswordProvider = useMemo(() => {
    const identities = user?.identities || []
    if (identities.length === 0) return true
    const providers = identities.map((i) => i.provider)
    if (providers.includes('google') && !providers.includes('email')) return false
    return identities.some((i) => i.provider === 'email')
  }, [user])

  const email = profile?.email || user?.email || ''
  const username = profile?.username || ''

  useEffect(() => {
    setNameInput(username || '')
  }, [username])

  useEffect(() => {
    let cancelled = false
    authService
      .getUsernameChangeStatus()
      .then((s) => {
        if (!cancelled) setNameStatus(s)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const remainingAvatarChanges = useMemo(() => {
    if (!userId) return 0
    const meta = getAvatarMeta(userId)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    const recent = (meta.changes || []).filter((t) => t > dayAgo)
    return Math.max(0, 3 - recent.length)
  }, [userId, avatarUrl])

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPwMsg('')
    if (!hasPasswordProvider) return
    if (newPassword.length < 8) {
      setPwMsg('Mật khẩu mới phải có ít nhất 8 ký tự.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMsg('Xác nhận mật khẩu không khớp.')
      return
    }
    setPwLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPwMsg('Đổi mật khẩu thành công.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPwMsg(err.message || 'Không thể đổi mật khẩu.')
    } finally {
      setPwLoading(false)
    }
  }

  const handleAvatarPick = () => {
    setAvatarMsg('')
    fileRef.current?.click()
  }

  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !userId) return
    if (!file.type.startsWith('image/')) {
      setAvatarMsg('Vui lòng chọn file ảnh.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarMsg('Ảnh tối đa 2MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const url = String(reader.result)
        saveAvatar(userId, url)
        onAvatarChange?.(url)
        setAvatarMsg('Đã cập nhật ảnh đại diện.')
      } catch (err) {
        setAvatarMsg(err.message || 'Không thể đổi ảnh.')
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSaveName = async () => {
    setNameMsg('')
    const next = nameInput.trim()
    if (!next || next === username) {
      setEditingName(false)
      return
    }
    setNameLoading(true)
    try {
      const data = await authService.changeUsername({ username: next })
      if (data?.usernameChange) setNameStatus(data.usernameChange)
      await reloadProfile?.()
      setNameMsg('Đã đổi tên thành công.')
      setEditingName(false)
    } catch (err) {
      setNameMsg(err.message || 'Không thể đổi tên.')
    } finally {
      setNameLoading(false)
    }
  }

  const locationOn = permission === 'granted'

  const handleToggleLocation = () => {
    if (locationOn) setLocationEnabled(false)
    else setLocationEnabled(true)
  }

  const handleTogglePush = async () => {
    setPushMsg('')
    setPushLoading(true)
    try {
      if (pushOn) {
        await unsubscribePush()
        setPushOn(false)
        setPushMsg('Đã tắt thông báo đẩy.')
      } else {
        await requestPermissionAndSubscribe()
        setPushOn(true)
        setPushMsg('Đã bật thông báo đẩy.')
      }
    } catch (err) {
      setPushMsg(err.message || 'Không thể thay đổi quyền thông báo.')
    } finally {
      setPushLoading(false)
    }
  }

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true">
      <div className="settings-panel">
        <button type="button" className="settings-back" onClick={onClose} aria-label="Đóng">
          {'<'}
        </button>

        <div className="settings-body">
          <aside className="settings-sidebar">
            <button
              type="button"
              className={`settings-nav-item ${tab === 'info' ? 'active' : ''}`}
              onClick={() => setTab('info')}
            >
              Thông tin cá nhân
            </button>
            <button
              type="button"
              className={`settings-nav-item ${tab === 'privacy' ? 'active' : ''}`}
              onClick={() => setTab('privacy')}
            >
              Quyền riêng tư
            </button>
          </aside>

          <div className="settings-divider" aria-hidden="true" />

          <main className="settings-content">
            {tab === 'info' && (
              <div className="settings-section">
                <h2>Thông tin cá nhân</h2>

                <div className="settings-avatar-block">
                  <div className="settings-avatar-preview">
                    {avatarUrl ? <img src={avatarUrl} alt="Avatar" /> : <DefaultAvatarLarge />}
                  </div>
                  <div className="settings-avatar-actions">
                    <button type="button" className="settings-btn" onClick={handleAvatarPick}>
                      Đổi ảnh đại diện
                    </button>
                    <p className="settings-hint">
                      Còn {remainingAvatarChanges}/3 lần đổi trong 24 giờ.
                    </p>
                    {avatarMsg && <p className="settings-msg">{avatarMsg}</p>}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleAvatarFile}
                    />
                  </div>
                </div>

                <div className="settings-field">
                  <label>Tên hiển thị</label>
                  {editingName ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        disabled={nameLoading}
                        style={{ flex: 1, minWidth: 140 }}
                      />
                      <button
                        type="button"
                        className="settings-btn settings-btn--primary"
                        onClick={handleSaveName}
                        disabled={nameLoading}
                      >
                        {nameLoading ? '…' : 'Lưu'}
                      </button>
                      <button
                        type="button"
                        className="settings-btn"
                        onClick={() => {
                          setEditingName(false)
                          setNameInput(username || '')
                          setNameMsg('')
                        }}
                        disabled={nameLoading}
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="text" value={username || '—'} readOnly style={{ flex: 1 }} />
                      <button
                        type="button"
                        className="settings-btn"
                        onClick={() => setEditingName(true)}
                        disabled={nameStatus.remaining <= 0}
                        title={
                          nameStatus.remaining <= 0
                            ? 'Đã hết lượt đổi tên trong tuần'
                            : 'Đổi tên'
                        }
                      >
                        Đổi tên
                      </button>
                    </div>
                  )}
                  <p className="settings-hint">
                    Còn {nameStatus.remaining}/{nameStatus.max} lần đổi trong 7 ngày.
                  </p>
                  {nameMsg && <p className="settings-msg">{nameMsg}</p>}
                </div>

                <div className="settings-field">
                  <label>Email</label>
                  <input type="text" value={email || '—'} readOnly />
                </div>

                <form
                  className={`settings-password ${hasPasswordProvider ? '' : 'is-disabled'}`}
                  onSubmit={handlePasswordChange}
                >
                  <h3>Đổi mật khẩu</h3>
                  {!hasPasswordProvider && (
                    <p className="settings-hint">
                      Tài khoản đăng nhập bằng Google không đổi mật khẩu tại đây.
                    </p>
                  )}
                  <div className="settings-field">
                    <label>Mật khẩu mới</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={!hasPasswordProvider || pwLoading}
                      autoComplete="new-password"
                      placeholder="Ít nhất 8 ký tự"
                    />
                  </div>
                  <div className="settings-field">
                    <label>Xác nhận mật khẩu mới</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={!hasPasswordProvider || pwLoading}
                      autoComplete="new-password"
                    />
                  </div>
                  <button
                    type="submit"
                    className="settings-btn settings-btn--primary"
                    disabled={!hasPasswordProvider || pwLoading}
                  >
                    {pwLoading ? 'Đang lưu…' : 'Lưu mật khẩu mới'}
                  </button>
                  {pwMsg && <p className="settings-msg">{pwMsg}</p>}
                </form>
              </div>
            )}

            {tab === 'privacy' && (
              <div className="settings-section">
                <h2>Quyền riêng tư</h2>
                <div className="settings-toggle-row">
                  <div>
                    <p className="settings-toggle-title">Cho phép chia sẻ vị trí</p>
                    <p className="settings-hint">
                      Dùng để nền đại dương phản ánh thời tiết nơi bạn đang ở.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`settings-switch ${locationOn ? 'is-on' : ''}`}
                    role="switch"
                    aria-checked={locationOn}
                    onClick={handleToggleLocation}
                  >
                    <span className="settings-switch-knob" />
                  </button>
                </div>

                <div className="settings-toggle-row" style={{ marginTop: 16 }}>
                  <div>
                    <p className="settings-toggle-title">Thông báo đẩy (Web Push)</p>
                    <p className="settings-hint">
                      Nhận thông báo khi có tin mới trong lớp. Chỉ hỏi quyền trình duyệt một lần.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`settings-switch ${pushOn ? 'is-on' : ''}`}
                    role="switch"
                    aria-checked={pushOn}
                    onClick={handleTogglePush}
                    disabled={pushLoading}
                  >
                    <span className="settings-switch-knob" />
                  </button>
                </div>
                {pushMsg && <p className="settings-msg">{pushMsg}</p>}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
