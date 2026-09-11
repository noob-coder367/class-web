import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import * as classroomService from '../services/classroomService.js'
import TimetableBoard from './TimetableBoard.jsx'
import TimetableSettings from './TimetableSettings.jsx'
import './ClassRoomView.css'

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M8 2.5v4M16 2.5v4M3 9.5h18" />
    </svg>
  )
}

function IconBook() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8M8 11h5" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

function IconBack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5 L8 12 L15 19" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

const TABS = [
  { id: 'announcements', label: 'Thông báo chung', icon: IconBell },
  { id: 'timetable', label: 'Thời khoá biểu', icon: IconCalendar },
  { id: 'homework', label: 'Bài tập về nhà', icon: IconBook },
  { id: 'rules', label: 'Nội quy lớp', icon: IconShield },
]

/**
 * Khu vực nội bộ lớp 10A4.
 * Tab mặc định: Thông báo chung.
 * Nội dung thật chỉ lấy từ backend sau khi xác thực thành viên.
 */
export default function ClassRoomView({ onClose }) {
  const { isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState('announcements')
  const [access, setAccess] = useState('ok')
  const [accessError, setAccessError] = useState('')
  const [items, setItems] = useState([])
  const [timetable, setTimetable] = useState(null)
  const [draft, setDraft] = useState(null)
  const [loadingTab, setLoadingTab] = useState(true)
  const [tabError, setTabError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (settingsOpen) setSettingsOpen(false)
        else onClose?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, settingsOpen])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false

    const verify = async () => {
      try {
        await classroomService.checkAccess()
        if (!cancelled) setAccess('ok')
      } catch (err) {
        if (cancelled) return
        const status = err.status
        if (status === 401 || status === 403) {
          setAccess('denied')
          setAccessError(err.message || 'Bạn không có quyền vào lớp.')
        }
      }
    }

    verify()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (access === 'denied') {
      setLoadingTab(false)
      setItems([])
      setTimetable(null)
      return
    }

    let cancelled = false
    setLoadingTab(true)
    setTabError('')
    setItems([])
    setTimetable(null)
    setSettingsOpen(false)

    const load = async () => {
      try {
        const data = await classroomService.getTabContent(activeTab)
        if (cancelled) return
        if (activeTab === 'timetable') {
          setTimetable(data?.timetable || null)
        } else {
          setItems(Array.isArray(data?.items) ? data.items : [])
        }
      } catch (err) {
        if (cancelled) return
        const status = err.status
        if (status === 401 || status === 403) {
          setAccess('denied')
          setAccessError(err.message || 'Bạn không có quyền vào lớp.')
          setItems([])
          setTimetable(null)
        } else {
          setItems([])
          setTimetable(null)
        }
      } finally {
        if (!cancelled) setLoadingTab(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [access, activeTab])

  const openSettings = () => {
    setDraft(structuredClone(timetable))
    setSettingsOpen(true)
  }

  const handleSave = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const data = await classroomService.saveTimetable(draft)
      setTimetable(data.timetable || draft)
      setSettingsOpen(false)
    } catch (err) {
      alert(err.message || 'Không lưu được thời khoá biểu.')
    } finally {
      setSaving(false)
    }
  }

  const renderBody = () => {
    if (access === 'denied') {
      return (
        <div className="classroom-state classroom-state--denied">
          <p>{accessError || 'Bạn không có quyền vào khu vực lớp.'}</p>
        </div>
      )
    }

    if (loadingTab) {
      return (
        <div className="classroom-state">
          <span className="classroom-spinner" aria-hidden="true" />
          <p>Đang tải...</p>
        </div>
      )
    }

    if (tabError) {
      return (
        <div className="classroom-state classroom-state--denied">
          <p>{tabError}</p>
        </div>
      )
    }

    if (activeTab === 'timetable') {
      if (!timetable) return <p className="classroom-empty">Chưa có nội dung</p>
      return <TimetableBoard timetable={timetable} now={now} />
    }

    if (!items.length) {
      return <p className="classroom-empty">Chưa có nội dung</p>
    }

    return (
      <ul className="classroom-list">
        {items.map((item) => (
          <li key={item.id} className="classroom-item">
            {item.title ? <h3>{item.title}</h3> : null}
            {item.body ? <p>{item.body}</p> : null}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="classroom-view" role="dialog" aria-modal="true" aria-label="Khu vực lớp 10A4">
      <header className="classroom-topbar">
        <button
          type="button"
          className="classroom-back"
          onClick={onClose}
          aria-label="Quay về trang chính"
          title="Quay về"
        >
          <IconBack />
        </button>

        <div className="classroom-iso">
          <span className="classroom-iso-lid" aria-hidden="true" />
          <span className="classroom-iso-cap" aria-hidden="true" />
          <nav className="classroom-iso-front" role="tablist" aria-label="Mục lớp 10A4">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const selected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`classroom-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls="classroom-panel"
                  tabIndex={selected ? 0 : -1}
                  className={`classroom-tab${selected ? ' is-active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  disabled={access === 'denied'}
                >
                  <span className="classroom-tab-inner">
                    <span className="classroom-tab-icon">
                      <Icon />
                    </span>
                    <span className="classroom-tab-label">{tab.label}</span>
                  </span>
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      <div
        className={`classroom-body${activeTab === 'timetable' ? ' is-timetable' : ''}`}
        id="classroom-panel"
        role="tabpanel"
        aria-labelledby={`classroom-tab-${activeTab}`}
      >
        {renderBody()}
      </div>

      {isAdmin && activeTab === 'timetable' && timetable && access === 'ok' ? (
        <button
          type="button"
          className="tkb-fab"
          onClick={openSettings}
          aria-label="Cài đặt thời khoá biểu"
          title="Cài đặt"
        >
          <IconSettings />
        </button>
      ) : null}

      <TimetableSettings
        open={settingsOpen}
        timetable={draft}
        onChange={setDraft}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}
