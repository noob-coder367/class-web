import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ban, Check, ChevronLeft, Crown, Glasses, Shirt } from 'lucide-react'
import PetMascot, { PET_CATEGORIES } from '../components/pet/PetMascot.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { EMPTY_OUTFIT, loadOutfit, saveOutfit } from '../lib/petOutfit.js'
import { ROUTES } from '../lib/routes.js'
import '../pet.css'

const TAB_ICONS = { hat: Crown, acc: Glasses, shirt: Shirt }

export default function PetPage() {
  const { session, authReady } = useAuth()
  const toast = useToast()
  const userId = session?.user?.id ?? null
  const latestUserId = useRef(userId)
  latestUserId.current = userId
  const requestId = useRef(0)
  const [loadedUserId, setLoadedUserId] = useState(null)
  const [saved, setSaved] = useState({ ...EMPTY_OUTFIT })
  const [draft, setDraft] = useState({ ...EMPTY_OUTFIT })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState('hat')
  const visibleSaved = loadedUserId === userId ? saved : EMPTY_OUTFIT
  const visibleDraft = loadedUserId === userId ? draft : EMPTY_OUTFIT

  useEffect(() => {
    if (!authReady) return undefined

    const currentRequest = ++requestId.current
    let active = true
    setEditing(false)
    setLoadError('')

    if (!userId) {
      setLoadedUserId(null)
      setSaved({ ...EMPTY_OUTFIT })
      setDraft({ ...EMPTY_OUTFIT })
      setLoading(false)
      return () => { active = false }
    }

    setLoading(true)
    void loadOutfit(userId).then((outfit) => {
      if (!active || requestId.current !== currentRequest) return
      setLoadedUserId(userId)
      setSaved(outfit)
      setDraft(outfit)
    }).catch((error) => {
      if (!active || requestId.current !== currentRequest) return
      console.error('[pet] Không tải được trang phục:', error)
      setLoadedUserId(userId)
      setSaved({ ...EMPTY_OUTFIT })
      setDraft({ ...EMPTY_OUTFIT })
      setLoadError('Không thể tải trang phục đã lưu. Vui lòng thử tải lại trang.')
    }).finally(() => {
      if (active && requestId.current === currentRequest) setLoading(false)
    })

    return () => { active = false }
  }, [authReady, userId])

  const category = PET_CATEGORIES.find((item) => item.key === tab)
  const pick = (id) => setDraft((current) => ({ ...current, [tab]: id }))

  const save = async () => {
    if (saving) return
    const savingUserId = userId
    const outfitToSave = { ...visibleDraft }
    try {
      setSaving(true)
      await saveOutfit(savingUserId, outfitToSave)
      if (latestUserId.current !== savingUserId) return
      setSaved(outfitToSave)
      setLoadedUserId(savingUserId)
      setEditing(false)
      setLoadError('')
      toast?.success?.('Đã lưu trang phục')
    } catch (error) {
      if (latestUserId.current !== savingUserId) return
      console.error('[pet] Không lưu được trang phục:', error)
      const message = !savingUserId
        ? 'Vui lòng đăng nhập để lưu trang phục.'
        : 'Không thể lưu trang phục. Vui lòng thử lại.'
      setLoadError(message)
      toast?.error?.(message)
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => { setDraft(visibleSaved); setEditing(false) }

  if (!editing) {
    return <div className="pet-page">
      <header className="pet-topbar"><Link className="pet-round-btn" to={ROUTES.home} aria-label="Về trang chủ"><ChevronLeft size={22} aria-hidden="true" /></Link><span className="pet-title-pill">Linh vật của bạn</span><span className="pet-round-spacer" /></header>
      <p className="pet-overline">Giao diện của bạn</p>
      <div className="pet-stage"><PetMascot outfit={visibleSaved} size={300} /></div>
      {loading && <p role="status" aria-live="polite">Đang tải trang phục…</p>}
      {loadError && <p role="alert">{loadError}</p>}
      <button type="button" className="pet-outfit-btn" disabled={!authReady || loading} onClick={() => setEditing(true)}><span className="pet-outfit-icons"><Crown size={20} aria-hidden="true" /><Shirt size={20} aria-hidden="true" /></span>Trang phục</button>
      <p className="pet-hint">Bấm “Trang phục” để mặc mũ, phụ kiện và áo cho linh vật.</p>
    </div>
  }

  return <div className="pet-page pet-page-editing">
    <header className="pet-topbar"><button type="button" className="pet-round-btn" onClick={cancel} aria-label="Quay lại"><ChevronLeft size={22} aria-hidden="true" /></button><button type="button" className="pet-save" onClick={save} disabled={saving || loading || loadedUserId !== userId}>{saving ? 'Đang lưu…' : 'Lưu'}</button></header>
    <div className="pet-stage"><PetMascot outfit={visibleDraft} size={230} /></div>
    {loadError && <p role="alert">{loadError}</p>}
    <section className="pet-editor" aria-label="Chọn trang phục">
      <div className="pet-tabs" role="tablist">{PET_CATEGORIES.map((item) => { const Icon = TAB_ICONS[item.key]; return <button type="button" role="tab" aria-selected={tab === item.key} className={tab === item.key ? 'pet-tab active' : 'pet-tab'} key={item.key} onClick={() => setTab(item.key)}><Icon size={26} aria-hidden="true" /><small>{item.label}</small></button> })}</div>
      <div className="pet-grid">
        <button type="button" className={!visibleDraft[tab] ? 'pet-item selected' : 'pet-item'} onClick={() => pick(null)} aria-label="Không mặc"><Ban size={28} aria-hidden="true" />{!visibleDraft[tab] && <span className="pet-check"><Check size={14} aria-hidden="true" /></span>}</button>
        {category.items.map((item) => <button type="button" key={item.id} title={item.name} aria-label={item.name} className={visibleDraft[tab] === item.id ? 'pet-item selected' : 'pet-item'} onClick={() => pick(item.id)}><PetMascot ghost size="100%" viewBox={category.crop} outfit={{ [tab]: item.id }} label={item.name} />{visibleDraft[tab] === item.id && <span className="pet-check"><Check size={14} aria-hidden="true" /></span>}</button>)}
      </div>
    </section>
  </div>
}
