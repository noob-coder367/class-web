import { useCallback, useEffect, useState } from 'react'
import * as classroomService from '../services/classroomService.js'
import TimetableBoard from './TimetableBoard.jsx'
import RulesBoard from './RulesBoard.jsx'
import AnnouncementsBoard from './AnnouncementsBoard.jsx'
import HomeworkBoard from './HomeworkBoard.jsx'
import { markSeen, countNewer } from '../lib/unreadStore.js'
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

const TABS = [
  { id: 'announcements', label: 'Thông báo chung', icon: IconBell },
  { id: 'timetable', label: 'Thời khoá biểu', icon: IconCalendar },
  { id: 'homework', label: 'Bài tập về nhà', icon: IconBook },
  { id: 'rules', label: 'Nội quy lớp', icon: IconShield },
]

const WIDE_TABS = new Set(['timetable', 'rules', 'announcements', 'homework'])

export default function ClassRoomView({ onClose, initialTab = 'announcements' }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'announcements')
  const [access, setAccess] = useState('ok')
  const [accessError, setAccessError] = useState('')
  const [items, setItems] = useState([])
  const [timetable, setTimetable] = useState(null)
  const [tkbNotice, setTkbNotice] = useState(null)
  const [rules, setRules] = useState(null)
  const [violations, setViolations] = useState([])
  const [members, setMembers] = useState([])
  const [directory, setDirectory] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loadingTab, setLoadingTab] = useState(true)
  const [tabError, setTabError] = useState('')
  const [dismissingNotice, setDismissingNotice] = useState(false)
  const [tabBadges, setTabBadges] = useState({
    announcements: 0,
    homework: 0,
    rules: 0,
    rulesViolations: 0,
  })

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (
        document.querySelector(
          '.tkb-settings-overlay, .rules-settings-overlay, .rules-lightbox, .ann-composer-overlay, .hw-composer-overlay'
        )
      )
        return
      onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false

    const verify = async () => {
      try {
        const data = await classroomService.checkAccess()
        if (cancelled) return
        setAccess('ok')
        setIsAdmin(data?.role === 'admin')
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

  // Đếm badge từng tab (không đếm TKB)
  useEffect(() => {
    if (access !== 'ok') return
    let cancelled = false
    const loadBadges = async () => {
      try {
        const [ann, hw, viol] = await Promise.all([
          classroomService.getAnnouncements().catch(() => ({ items: [] })),
          classroomService.getHomework().catch(() => ({ items: [] })),
          classroomService.getViolations().catch(() => ({ violations: [] })),
        ])
        if (cancelled) return
        const violationsList = viol?.violations || []
        setTabBadges({
          announcements: Math.min(99, countNewer(ann?.items || [], 'announcements')),
          homework: Math.min(99, countNewer(hw?.items || [], 'homework')),
          rules: Math.min(99, countNewer(violationsList, 'rules', (item) => item.createdAt)),
          // Badge riêng cho pane "Danh sách vi phạm": dùng key riêng
          // ('rules-violations') để KHÔNG tự tắt chỉ vì người dùng mở
          // tab "Nội quy lớp" - chỉ tắt khi thật sự vào xem danh sách đó.
          rulesViolations: Math.min(
            99,
            countNewer(violationsList, 'rules-violations', (item) => item.createdAt)
          ),
        })
      } catch {
        /* ignore */
      }
    }
    loadBadges()
    const onUnread = () => loadBadges()
    window.addEventListener('classweb-unread-updated', onUnread)

    // Poll định kỳ để nhận thông báo/bài tập/vi phạm mới mà không cần
    // thoát ra vào lại lớp. Chỉ gọi khi tab trình duyệt đang hiển thị.
    const POLL_MS = 15_000
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') loadBadges()
    }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadBadges()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      window.removeEventListener('classweb-unread-updated', onUnread)
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [access])

  useEffect(() => {
    if (access === 'ok' && activeTab) markSeen(activeTab)
  }, [access, activeTab])

  useEffect(() => {
    if (access === 'denied') {
      setLoadingTab(false)
      setItems([])
      setTimetable(null)
      setTkbNotice(null)
      setRules(null)
      setViolations([])
      setMembers([])
      setDirectory([])
      return
    }

    let cancelled = false
    setLoadingTab(true)
    setTabError('')
    setItems([])

    const load = async () => {
      try {
        if (activeTab === 'timetable') {
          const data = await classroomService.getTimetable()
          if (cancelled) return
          setTimetable(data?.timetable || null)
          setTkbNotice(data?.timetable?.changeNotice || null)
          setRules(null)
          setViolations([])
          setItems([])
        } else if (activeTab === 'rules') {
          const [rulesData, violationData, membersData, directoryData] = await Promise.all([
            classroomService.getRules(),
            classroomService.getViolations(),
            classroomService.getMembers(),
            classroomService.getDirectory().catch(() => ({ members: [] })),
          ])
          if (cancelled) return
          setRules(rulesData?.rules || null)
          setViolations(Array.isArray(violationData?.violations) ? violationData.violations : [])
          setMembers(Array.isArray(membersData?.members) ? membersData.members : [])
          setDirectory(Array.isArray(directoryData?.members) ? directoryData.members : [])
          setTimetable(null)
          setItems([])
        } else if (activeTab === 'announcements') {
          const tkbData = await classroomService.getTimetable().catch(() => null)
          if (cancelled) return
          setTkbNotice(tkbData?.timetable?.changeNotice || null)
          setTimetable(null)
          setRules(null)
          setViolations([])
          setItems([])
        } else if (activeTab === 'homework') {
          setTimetable(null)
          setRules(null)
          setViolations([])
          setItems([])
        } else {
          const data = await classroomService.getTabContent(activeTab)
          if (cancelled) return
          setTimetable(null)
          setRules(null)
          setViolations([])
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
          setRules(null)
          setViolations([])
          setMembers([])
          setDirectory([])
        } else {
          setItems([])
          setTimetable(null)
          setRules(null)
          setViolations([])
          setMembers([])
          setDirectory([])
          setTabError(err.message || 'Không tải được nội dung.')
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

  const handleSaveTimetable = async (next) => {
    const data = await classroomService.saveTimetable(next)
    setTimetable(data?.timetable || next)
    setTkbNotice(data?.timetable?.changeNotice || null)
  }

  const handleDismissNotice = async () => {
    setDismissingNotice(true)
    try {
      const data = await classroomService.dismissTimetableNotice()
      if (data?.timetable) {
        setTimetable(data.timetable)
        setTkbNotice(data.timetable.changeNotice || null)
      } else {
        setTkbNotice((prev) => (prev ? { ...prev, active: false } : null))
      }
    } finally {
      setDismissingNotice(false)
    }
  }

  const handleSaveRules = async (next) => {
    const data = await classroomService.saveRules(next)
    setRules(data?.rules || next)
  }

  const handleAddViolation = async (payload) => {
    const data = await classroomService.addViolation(payload)
    if (data?.violation) {
      setViolations((prev) => [data.violation, ...prev.filter((row) => row.id !== data.violation.id)])
    }
  }

  const handleDeleteViolation = async (id) => {
    await classroomService.deleteViolation(id)
    setViolations((prev) => prev.filter((row) => row.id !== id))
  }

  const handleRefreshMembers = useCallback(async () => {
    try {
      const [data, dir] = await Promise.all([
        classroomService.getMembers(),
        classroomService.getDirectory().catch(() => ({ members: [] })),
      ])
      setMembers(Array.isArray(data?.members) ? data.members : [])
      setDirectory(Array.isArray(dir?.members) ? dir.members : [])
    } catch {
      // giữ danh sách cũ
    }
  }, [])

  const renderBody = () => {
    if (access === 'denied') {
      return (
        <div className="classroom-state classroom-state--denied">
          <p>{accessError || 'Bạn không có quyền vào khu vực lớp.'}</p>
        </div>
      )
    }

    if (loadingTab && activeTab !== 'announcements' && activeTab !== 'homework') {
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

    if (activeTab === 'announcements') {
      return (
        <AnnouncementsBoard
          isAdmin={isAdmin}
          tkbNotice={tkbNotice}
          onDismissTkbNotice={handleDismissNotice}
          dismissingTkb={dismissingNotice}
          onOpenTimetable={() => setActiveTab('timetable')}
        />
      )
    }

    if (activeTab === 'homework') {
      return <HomeworkBoard isAdmin={isAdmin} />
    }

    if (activeTab === 'timetable') {
      if (!timetable) return <p className="classroom-empty">Chưa có thời khoá biểu</p>
      return (
        <TimetableBoard
          data={timetable}
          isAdmin={isAdmin}
          onSave={handleSaveTimetable}
          onDismissNotice={handleDismissNotice}
        />
      )
    }

    if (activeTab === 'rules') {
      return (
        <RulesBoard
          rules={rules}
          violations={violations}
          members={members}
          directory={directory}
          isAdmin={isAdmin}
          violationsBadge={tabBadges.rulesViolations}
          onSaveRules={handleSaveRules}
          onAddViolation={handleAddViolation}
          onDeleteViolation={handleDeleteViolation}
          onRefreshMembers={handleRefreshMembers}
        />
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

  const bodyMod = WIDE_TABS.has(activeTab) ? ` classroom-body--${activeTab}` : ''

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
          <span className="classroom-iso-end" aria-hidden="true" />
          <div className="classroom-iso-main">
            <span className="classroom-iso-lid" aria-hidden="true" />
            <nav className="classroom-iso-front" role="tablist" aria-label="Mục lớp 10A4">
              {TABS.map((tab) => {
                const Icon = tab.icon
                const selected = activeTab === tab.id
                const badge = tab.id === 'timetable' ? 0 : tabBadges[tab.id] || 0
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
                        {badge > 0 ? (
                          <span className="classroom-tab-badge">{badge > 99 ? '99+' : badge}</span>
                        ) : null}
                      </span>
                      <span className="classroom-tab-label">{tab.label}</span>
                    </span>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
      </header>

      <div
        className={`classroom-body${bodyMod}`}
        id="classroom-panel"
        role="tabpanel"
        aria-labelledby={`classroom-tab-${activeTab}`}
      >
        {renderBody()}
      </div>
    </div>
  )
}
