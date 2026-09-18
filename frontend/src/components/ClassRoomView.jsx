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
]

const TABS_PER_VIEW = 3

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

  // CONTINUED IN NEXT - THIS IS INCOMPLETE PLACEHOLDER TO AVOID BREAKING - DO NOT USE
  return null
}
