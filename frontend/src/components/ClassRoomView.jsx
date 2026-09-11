import { useEffect, useState } from 'react'
import * as classroomService from '../services/classroomService.js'
import './ClassRoomView.css'

const TABS = [
  {
    id: 'announcements',
    label: 'Thông báo chung',
    icon: IconBell,
  },
  {
    id: 'timetable',
    label: 'Thời khoá biểu',
    icon: IconCalendar,
  },
  {
    id: 'homework',
    label: 'Bài tập về nhà',
    icon: IconBook,
  },
  {
    id: 'rules',
    label: 'Nội quy lớp',
    icon: IconShield,
  },
]

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

/**
 * Khu vực nội bộ lớp 10A4.
 * Tab mặc định: Thông báo chung.
 * Nội dung thật chỉ lấy từ backend sau khi xác thực thành viên —
 * không nhúng sẵn trong JS để tránh lộ khi mở F12.
 */
export default function ClassRoomView({ onClose }) {
  const [activeTab, setActiveTab] = useState('announcements')
  const [access, setAccess] = useState('ok')
  const [accessError, setAccessError] = useState('')
  const [items, setItems] = useState([])
  const [loadingTab, setLoadingTab] = useState(true)
  const [tabError, setTabError] = useState('')

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
        // 404/mạng: backend chưa kịp deploy — vẫn cho xem khung tab trống.
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
      return
    }

    let cancelled = false
    setLoadingTab(true)
    setTabError('')
    setItems([])

    const load = async () => {
      try {
        const data = await classroomService.getTabContent(activeTab)
        if (cancelled) return
        setItems(Array.isArray(data?.items) ? data.items : [])
      } catch (err) {
        if (cancelled) return
        const status = err.status
        if (status === 401 || status === 403) {
          setAccess('denied')
          setAccessError(err.message || 'Bạn không có quyền vào lớp.')
          setItems([])
        } else {
          setItems([])
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
          <
        </button>

        <nav className="classroom-tabs" role="tablist" aria-label="Mục lớp 10A4">
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
                <span className="classroom-tab-icon">
                  <Icon />
                </span>
                <span className="classroom-tab-label">{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </header>

      <div
        className="classroom-body"
        id="classroom-panel"
        role="tabpanel"
        aria-labelledby={`classroom-tab-${activeTab}`}
      >
        {renderBody()}
      </div>
    </div>
  )
}
