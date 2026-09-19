import { useCallback, useEffect, useRef, useState } from 'react'
import * as classroomService from '../services/classroomService.js'
import TimetableBoard from './TimetableBoard.jsx'
import RulesBoard from './RulesBoard.jsx'
import AnnouncementsBoard from './AnnouncementsBoard.jsx'
import HomeworkBoard from './HomeworkBoard.jsx'
import CleaningBoard from './CleaningBoard.jsx'
import { markSeen, countNewer, countUnseenPosts } from '../lib/unreadStore.js'
import { capabilitiesFor, isAdminRole } from '../lib/roles.js'
import { useAuth } from '../context/AuthContext.jsx'
import CreateClassPage from './CreateClassPage.jsx'
import ClassPlayView from './ClassPlayView.jsx'
import { isRoomCompletedLocked } from '../lib/classPlayScore.js'
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

function IconBroom() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 3 9.5 12.5" />
      <path d="M13 8l-8.5 8.5a2 2 0 0 0 0 2.8l.2.2a2 2 0 0 0 2.8 0L16 11" />
      <path d="M6.5 15 4 21l6-2.5" />
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

function IconDoor() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 21h16" />
      <path d="M6.5 21V4.5A1.5 1.5 0 0 1 8 3h5a1.5 1.5 0 0 1 1.5 1.5V21" />
      <path d="M14.5 10.5H17a1.5 1.5 0 0 1 1.5 1.5v9" />
      <circle cx="10.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconPencil() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5Z" />
      <path d="M14.5 5.5 18 9" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

function IconArrowRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 12h14.5" />
      <path d="M13 6.5 19 12l-6 5.5" />
    </svg>
  )
}

function IconAI() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5l1.35 4.15L17.5 9l-4.15 1.35L12 14.5l-1.35-4.15L6.5 9l4.15-1.35Z" />
      <path d="M18.5 14.5l.65 1.85L21 17l-1.85.65L18.5 19.5l-.65-1.85L16 17l1.85-.65Z" />
      <path d="M5.5 14.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5Z" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 5 L8 12 L14.5 19" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 5 L16 12 L9.5 19" />
    </svg>
  )
}

const TABS = [
  { id: 'announcements', label: 'Thông báo chung', icon: IconBell },
  { id: 'timetable', label: 'Thời khoá biểu', icon: IconCalendar },
  { id: 'homework', label: 'Bài tập về nhà', icon: IconBook },
  { id: 'rules', label: 'Nội quy lớp', icon: IconShield },
  { id: 'cleaning-duty', label: 'Vệ sinh lớp', icon: IconBroom },
  { id: 'class-space', label: 'Lớp học', icon: IconDoor },
  { id: 'ai', label: 'AI', icon: IconAI },
]

const WIDE_TABS = new Set(['timetable', 'rules', 'announcements', 'homework', 'cleaning-duty'])
const EMPTY_CAPS = capabilitiesFor('user')

export default function ClassRoomView({ onClose, initialTab = 'announcements' }) {
  const { profile } = useAuth()
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
  const [caps, setCaps] = useState(EMPTY_CAPS)
  const [role, setRole] = useState(profile?.role || 'user')
  const [loadingTab, setLoadingTab] = useState(true)
  const [tabError, setTabError] = useState('')
  const [dismissingNotice, setDismissingNotice] = useState(false)
  const [tabBadges, setTabBadges] = useState({ announcements: 0, homework: 0, rules: 0, rulesViolations: 0 })
  const navRef = useRef(null)
  const [navScroll, setNavScroll] = useState({ atStart: true, atEnd: false })
  const [showCreateClass, setShowCreateClass] = useState(false)
  const [editingClass, setEditingClass] = useState(null)
  const [playingClass, setPlayingClass] = useState(null)
  const [classSpaceItems, setClassSpaceItems] = useState([])
  const [classSpaceLoading, setClassSpaceLoading] = useState(true)
  const [classSpaceError, setClassSpaceError] = useState('')
  const [passwordPromptClass, setPasswordPromptClass] = useState(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [coverFailed, setCoverFailed] = useState({})
  const [resultClass, setResultClass] = useState(null)

  const updateNavScroll = useCallback(() => {
    const el = navRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setNavScroll({
      atStart: el.scrollLeft <= 2,
      atEnd: el.scrollLeft >= max - 2,
    })
  }, [])

  useEffect(() => {
    const el = navRef.current
    if (!el) return
    updateNavScroll()
    const onScroll = () => updateNavScroll()
    const onResize = () => updateNavScroll()
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      el.removeEventListener('wheel', onWheel)
    }
  }, [updateNavScroll])

  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const btn = el.querySelector(`#classroom-tab-${activeTab}`)
    if (btn && typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    }
  }, [activeTab])

  const scrollNavToStart = useCallback(() => {
    navRef.current?.scrollTo({ left: 0, behavior: 'smooth' })
  }, [])

  const scrollNavForward = useCallback(() => {
    const el = navRef.current
    if (!el) return
    el.scrollBy({ left: el.clientWidth, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('.tkb-settings-overlay, .rules-settings-overlay, .rules-lightbox, .ann-composer-overlay, .hw-composer-overlay, .create-class-page, .class-play-view, .class-password-overlay')) return
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
        if (data?.role) setRole(data.role)
        if (data?.capabilities) setCaps({ ...EMPTY_CAPS, ...data.capabilities })
        else setCaps(capabilitiesFor(data?.role))
      } catch (err) {
        if (cancelled) return
        if (err.status === 401 || err.status === 403) {
          setAccess('denied')
          setAccessError(err.message || 'Bạn không có quyền vào lớp.')
        }
      }
    }
    verify()
    return () => { cancelled = true }
  }, [])

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
          announcements: Math.min(99, countUnseenPosts(ann?.items || [], profile?.id)),
          homework: Math.min(99, countNewer(hw?.items || [], 'homework')),
          rules: Math.min(99, countNewer(violationsList, 'rules', (item) => item.createdAt)),
          rulesViolations: Math.min(99, countNewer(violationsList, 'rules-violations', (item) => item.createdAt)),
        })
      } catch {}
    }
    loadBadges()
    const onUnread = () => loadBadges()
    window.addEventListener('classweb-unread-updated', onUnread)
    const timer = setInterval(() => { if (document.visibilityState === 'visible') loadBadges() }, 15000)
    const onVisible = () => { if (document.visibilityState === 'visible') loadBadges() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.removeEventListener('classweb-unread-updated', onUnread)
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [access, profile?.id])

  useEffect(() => {
    if (access === 'ok' && activeTab && activeTab !== 'announcements') markSeen(activeTab)
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
          const [rulesData, violationData, classListData] = await Promise.all([
            classroomService.getRules(),
            classroomService.getViolations(),
            classroomService.getClassList().catch(() => ({ items: [] })),
          ])
          if (cancelled) return
          setRules(rulesData?.rules || null)
          setViolations(Array.isArray(violationData?.violations) ? violationData.violations : [])
          const classItems = Array.isArray(classListData?.items) ? classListData.items : []
          setMembers(classItems)
          setDirectory(classItems)
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
        } else if (activeTab === 'cleaning-duty') {
          setTimetable(null)
          setRules(null)
          setViolations([])
          setItems([])
        } else if (activeTab === 'class-space') {
          setTimetable(null)
          setRules(null)
          setViolations([])
          setItems([])
        } else if (activeTab === 'ai') {
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
        if (err.status === 401 || err.status === 403) {
          setAccess('denied')
          setAccessError(err.message || 'Bạn không có quyền vào lớp.')
        } else {
          setTabError(err.message || 'Không tải được nội dung.')
        }
        setItems([])
        setTimetable(null)
        setRules(null)
        setViolations([])
        setMembers([])
        setDirectory([])
      } finally {
        if (!cancelled) setLoadingTab(false)
      }
    }
    load()
    return () => { cancelled = true }
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
      const data = await classroomService.getClassList()
      const classItems = Array.isArray(data?.items) ? data.items : []
      setMembers(classItems)
      setDirectory(classItems)
    } catch {}
  }, [])

  const refreshClassSpace = useCallback(async () => {
    setClassSpaceLoading(true)
    setClassSpaceError('')
    try {
      const data = await classroomService.listClassSpace()
      setClassSpaceItems(Array.isArray(data?.items) ? data.items : [])
    } catch (err) {
      setClassSpaceError(err?.message || 'Không tải được danh sách phòng.')
    } finally {
      setClassSpaceLoading(false)
    }
  }, [])

  useEffect(() => {
    if (access !== 'ok') return
    refreshClassSpace()
  }, [access, refreshClassSpace])

  const closeClassEditor = () => {
    setShowCreateClass(false)
    setEditingClass(null)
  }

  const handleClassSaved = () => {
    closeClassEditor()
    refreshClassSpace()
  }

  const enterClass = async (cls, passwordAttempt) => {
    if (isRoomCompletedLocked(cls)) {
      setResultClass(cls)
      return
    }
    const isOwner = !!profile?.id && cls.ownerId === profile.id
    if (!cls.isPublic && !isOwner && !passwordAttempt) {
      setPasswordPromptClass(cls)
      setPasswordInput('')
      setPasswordError('')
      return
    }
    try {
      const { item } = await classroomService.getClassSpace(cls.id, passwordAttempt)
      setPlayingClass(item)
      setPasswordPromptClass(null)
      setPasswordInput('')
    } catch (err) {
      if (passwordAttempt) {
        setPasswordError(err?.message || 'Mật khẩu không đúng.')
      } else {
        setClassSpaceError(err?.message || 'Không mở được phòng.')
      }
    }
  }

  const submitClassPassword = async () => {
    if (!passwordPromptClass) return
    if (passwordInput.length !== 6) {
      setPasswordError('Vui lòng nhập đủ 6 chữ số.')
      return
    }
    setPasswordSubmitting(true)
    setPasswordError('')
    try {
      await enterClass(passwordPromptClass, passwordInput)
    } finally {
      setPasswordSubmitting(false)
    }
  }

  const startEditClass = async (cls) => {
    try {
      const { item } = await classroomService.getClassSpace(cls.id)
      setEditingClass(item)
    } catch (err) {
      setClassSpaceError(err?.message || 'Không mở được phòng để chỉnh sửa.')
    }
  }

  const handleDeleteClass = async (cls) => {
    if (!cls?.id) return
    const ok = window.confirm(`Xoá phòng "${cls.title}"? Hành động này không thể hoàn tác.`)
    if (!ok) return
    try {
      await classroomService.deleteClassSpace(cls.id)
      setClassSpaceItems((prev) => prev.filter((row) => row.id !== cls.id))
    } catch (err) {
      setClassSpaceError(err?.message || 'Không xoá được phòng.')
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

    if (
      loadingTab &&
      activeTab !== 'announcements' &&
      activeTab !== 'homework' &&
      activeTab !== 'cleaning-duty' &&
      activeTab !== 'class-space' &&
      activeTab !== 'ai'
    ) {
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
          role={role}
          caps={caps}
          canDismissTkb={!!caps.timetable}
          tkbNotice={tkbNotice}
          onDismissTkbNotice={handleDismissNotice}
          dismissingTkb={dismissingNotice}
          onOpenTimetable={() => setActiveTab('timetable')}
        />
      )
    }

    if (activeTab === 'homework') return <HomeworkBoard isAdmin={!!caps.homework} />
    if (activeTab === 'cleaning-duty') return <CleaningBoard isAdmin={!!caps.cleaningDuty} />

    if (activeTab === 'class-space') {
      if (classSpaceLoading && !classSpaceItems.length) {
        return <p className="classroom-empty">Đang tải danh sách phòng...</p>
      }

      return (
        <>
          {classSpaceError ? <p className="classroom-state classroom-state--denied">{classSpaceError}</p> : null}
          {!classSpaceItems.length ? (
            <div className="classroom-state classroom-state--soon">
              <IconDoor />
              <p>Chưa có phòng nào được tạo.</p>
              <p className="classroom-state-sub">Bấm nút + ở góc dưới để tạo phòng đầu tiên.</p>
            </div>
          ) : (
            <div className="class-space-grid">
              {classSpaceItems.map((cls) => {
                const isOwner = !!profile?.id && cls.ownerId === profile.id
                const completedLocked = isRoomCompletedLocked(cls)

                return (
                  <div key={cls.id} className="class-space-card">
                    <div
                      role="button"
                      tabIndex={0}
                      className="class-space-box"
                      onClick={() => (completedLocked ? setResultClass(cls) : enterClass(cls))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          if (completedLocked) setResultClass(cls)
                          else enterClass(cls)
                        }
                      }}
                      aria-label={
                        completedLocked ? `Đã hoàn thành phòng ${cls.title}` : `Vào phòng ${cls.title}`
                      }
                    >
                      <div className="class-space-cover">
                        {cls.cover && !coverFailed[cls.id] ? (
                          <img
                            className="class-space-cover-img"
                            src={cls.cover}
                            alt=""
                            decoding="async"
                            onError={() => setCoverFailed((prev) => ({ ...prev, [cls.id]: true }))}
                          />
                        ) : (
                          <IconDoor />
                        )}
                        {!cls.isPublic ? <span className="class-space-badge">Riêng tư</span> : null}
                      </div>

                      <div className="class-space-info">
                        <h3 className="class-space-title">{cls.title}</h3>
                        <span className="class-space-code">{cls.questionCount} câu hỏi</span>
                        <p className="class-space-owner">Chủ phòng: {cls.ownerName || 'Ẩn danh'}</p>
                      </div>
                    </div>

                    <div className="class-space-footer">
                      {completedLocked ? (
                        <div className="class-space-done-wrap">
                          <span className="class-space-done-label">Đã hoàn thành</span>
                          <button
                            type="button"
                            className="class-space-result-btn"
                            onClick={() => setResultClass(cls)}
                          >
                            xem kết quả
                          </button>
                        </div>
                      ) : (
                        <button type="button" className="class-space-link-btn" onClick={() => enterClass(cls)}>
                          Vào phòng
                          <IconArrowRight />
                        </button>
                      )}

                      <div className="class-space-footer-actions">
                        {isOwner ? (
                          <button
                            type="button"
                            className="class-space-edit-icon-btn"
                            onClick={() => startEditClass(cls)}
                            aria-label={`Chỉnh sửa phòng ${cls.title}`}
                            title="Chỉnh sửa"
                          >
                            <IconPencil />
                          </button>
                        ) : null}

                        {isOwner || isAdminRole(role) ? (
                          <button
                            type="button"
                            className="class-space-delete-icon-btn"
                            onClick={() => handleDeleteClass(cls)}
                            aria-label={`Xoá phòng ${cls.title}`}
                            title="Xoá phòng"
                          >
                            <IconTrash />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )
    }

    if (activeTab === 'ai') {
      return (
        <div className="classroom-state classroom-state--soon">
          <h2>Đang được xây dựng</h2>
          <p className="classroom-state-sub">
            Tính năng AI đang được phát triển. Vui lòng quay lại sau!
          </p>
        </div>
      )
    }

    if (activeTab === 'timetable') {
      if (!timetable) return <p className="classroom-empty">Chưa có thời khoá biểu</p>

      return (
        <TimetableBoard
          data={timetable}
          isAdmin={!!caps.timetable}
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
          isAdmin={!!caps.rules}
          violationsBadge={tabBadges.rulesViolations}
          onSaveRules={handleSaveRules}
          onAddViolation={handleAddViolation}
          onDeleteViolation={handleDeleteViolation}
          onRefreshMembers={handleRefreshMembers}
        />
      )
    }

    if (!items.length) return <p className="classroom-empty">Chưa có nội dung</p>

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
        <button type="button" className="classroom-back" onClick={onClose} aria-label="Quay về trang chính" title="Quay về">
          <IconBack />
        </button>

        <div className="classroom-iso">
          <span className="classroom-iso-end" aria-hidden="true" />

          <div className="classroom-iso-main">
            <span className="classroom-iso-lid" aria-hidden="true" />

            <nav className="classroom-iso-front" role="tablist" aria-label="Mục lớp 10A4" ref={navRef}>
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
                        {badge > 0 ? <span className="classroom-tab-badge">{badge > 99 ? '99+' : badge}</span> : null}
                      </span>
                      <span className="classroom-tab-label">{tab.label}</span>
                    </span>
                  </button>
                )
              })}
            </nav>

            {!navScroll.atStart ? (
              <button
                type="button"
                className="classroom-nav-btn classroom-nav-btn--prev"
                onClick={scrollNavToStart}
                aria-label="Về các mục đầu"
                title="Về các mục đầu"
              >
                <IconChevronLeft />
              </button>
            ) : null}

            {!navScroll.atEnd ? (
              <button
                type="button"
                className="classroom-nav-btn classroom-nav-btn--next"
                onClick={scrollNavForward}
                aria-label="Xem thêm mục"
                title="Xem thêm mục"
              >
                <IconChevronRight />
              </button>
            ) : null}
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

      {access === 'ok' && activeTab === 'class-space' && !showCreateClass && !editingClass ? (
        <button
          type="button"
          className="classroom-fab"
          onClick={() => setShowCreateClass(true)}
          aria-label="Tạo phòng"
          title="Tạo phòng"
        >
          <IconPlus />
        </button>
      ) : null}

      {showCreateClass || editingClass ? (
        <CreateClassPage
          key={editingClass?.id || 'new-class'}
          editingClass={editingClass}
          onBack={closeClassEditor}
          onSaved={handleClassSaved}
        />
      ) : null}

      {playingClass ? (
        <ClassPlayView
          classData={playingClass}
          onClose={() => {
            setPlayingClass(null)
            refreshClassSpace()
          }}
        />
      ) : null}

      {resultClass ? (
        <div className="class-password-overlay" onClick={() => setResultClass(null)}>
          <div
            className="class-password-modal class-result-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-result-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="class-result-title">Kết quả</h3>
            <p>
              Phòng <strong>{resultClass.title}</strong>
            </p>
            <p className="class-result-score">
              {resultClass.myResult
                ? `${resultClass.myResult.correct}/${resultClass.myResult.total} câu đúng`
                : 'Chưa có kết quả.'}
            </p>
            <div className="class-password-actions">
              <button type="button" className="quiz-primary-btn" onClick={() => setResultClass(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {passwordPromptClass ? (
        <div className="class-password-overlay" onClick={() => setPasswordPromptClass(null)}>
          <div
            className="class-password-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-password-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="class-password-title">Phòng riêng tư</h3>
            <p>Nhập mật khẩu 6 chữ số để vào "{passwordPromptClass.title}".</p>

            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={passwordInput}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                setPasswordInput(v)
                setPasswordError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitClassPassword()
              }}
              placeholder="••••••"
            />

            {passwordError ? <p className="class-password-error">{passwordError}</p> : null}

            <div className="class-password-actions">
              <button type="button" className="quiz-ghost-btn" onClick={() => setPasswordPromptClass(null)}>
                Hủy
              </button>

              <button
                type="button"
                className="quiz-primary-btn"
                onClick={submitClassPassword}
                disabled={passwordSubmitting}
              >
                {passwordSubmitting ? 'Đang kiểm tra...' : 'Ok'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
