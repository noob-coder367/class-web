import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ban, Check, ChevronLeft, Crown, Glasses, Shirt } from 'lucide-react'
import PetMascot, { PET_CATEGORIES } from '../components/pet/PetMascot.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { loadOutfit, saveOutfit } from '../lib/petOutfit.js'
import { ROUTES } from '../lib/routes.js'
import '../pet.css'

const TAB_ICONS = { hat: Crown, acc: Glasses, shirt: Shirt }

export default function PetPage() {
  const { session } = useAuth()
  const toast = useToast()
  const uid = session?.user?.id || 'guest'
  const [saved, setSaved] = useState(() => loadOutfit(uid))
  const [draft, setDraft] = useState(saved)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState('hat')

  useEffect(() => { const next = loadOutfit(uid); setSaved(next); setDraft(next) }, [uid])

  const category = PET_CATEGORIES.find((item) => item.key === tab)
  const pick = (id) => setDraft((current) => ({ ...current, [tab]: id }))
  const save = () => { saveOutfit(uid, draft); setSaved(draft); setEditing(false); toast?.success?.('Đã lưu trang phục') }
  const cancel = () => { setDraft(saved); setEditing(false) }

  if (!editing) {
    return <div className="pet-page">
      <header className="pet-topbar"><Link className="pet-round-btn" to={ROUTES.home} aria-label="Về trang chủ"><ChevronLeft size={22} aria-hidden="true" /></Link><span className="pet-title-pill">Linh vật của bạn</span><span className="pet-round-spacer" /></header>
      <p className="pet-overline">Giao diện của bạn</p>
      <div className="pet-stage"><PetMascot outfit={saved} size={300} /></div>
      <button type="button" className="pet-outfit-btn" onClick={() => setEditing(true)}><span className="pet-outfit-icons"><Crown size={20} aria-hidden="true" /><Shirt size={20} aria-hidden="true" /></span>Trang phục</button>
      <p className="pet-hint">Bấm “Trang phục” để mặc mũ, phụ kiện và áo cho linh vật.</p>
    </div>
  }

  return <div className="pet-page pet-page-editing">
    <header className="pet-topbar"><button type="button" className="pet-round-btn" onClick={cancel} aria-label="Quay lại"><ChevronLeft size={22} aria-hidden="true" /></button><button type="button" className="pet-save" onClick={save}>Lưu</button></header>
    <div className="pet-stage"><PetMascot outfit={draft} size={230} /></div>
    <section className="pet-editor" aria-label="Chọn trang phục">
      <div className="pet-tabs" role="tablist">{PET_CATEGORIES.map((item) => { const Icon = TAB_ICONS[item.key]; return <button type="button" role="tab" aria-selected={tab === item.key} className={tab === item.key ? 'pet-tab active' : 'pet-tab'} key={item.key} onClick={() => setTab(item.key)}><Icon size={26} aria-hidden="true" /><small>{item.label}</small></button> })}</div>
      <div className="pet-grid">
        <button type="button" className={!draft[tab] ? 'pet-item selected' : 'pet-item'} onClick={() => pick(null)} aria-label="Không mặc"><Ban size={28} aria-hidden="true" />{!draft[tab] && <span className="pet-check"><Check size={14} aria-hidden="true" /></span>}</button>
        {category.items.map((item) => <button type="button" key={item.id} title={item.name} aria-label={item.name} className={draft[tab] === item.id ? 'pet-item selected' : 'pet-item'} onClick={() => pick(item.id)}><PetMascot ghost size="100%" viewBox={category.crop} outfit={{ [tab]: item.id }} label={item.name} />{draft[tab] === item.id && <span className="pet-check"><Check size={14} aria-hidden="true" /></span>}</button>)}
      </div>
    </section>
  </div>
}
