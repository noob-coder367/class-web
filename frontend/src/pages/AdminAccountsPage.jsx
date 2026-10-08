import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { ROUTES } from '../lib/routes.js'
import { GAME_MODES } from '../lib/gameModes.js'
import * as accountService from '../services/adminAccountService.js'
import { deleteGameModeImage, listGameModeImages, saveGameModeContent, uploadGameModeImage } from '../services/gameModeImageService.js'
import AdminRoomsWorkspace from '../components/admin/AdminRoomsWorkspace.jsx'
import AdminQuestionsWorkspace from '../components/admin/AdminQuestionsWorkspace.jsx'

const providerLabels = { google: 'Google', email: 'Email', ghost: 'Tài khoản ma', unknown: 'Không rõ' }
const navItems = [
  { id: 'accounts', label: 'Tài khoản', icon: 'users' },
  { id: 'rooms', label: 'Quản lý phòng', icon: 'rooms' },
  { id: 'questions', label: 'Quản lý các câu hỏi', icon: 'questions' },
  { id: 'game-images', label: 'Quản lý các trò chơi', icon: 'images' },
  { id: 'settings', label: 'Cài đặt chung', icon: 'settings' },
]

function NavIcon({ name }) {
  if (name === 'rooms') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M7 9h10M7 13h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
  if (name === 'questions') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5h14v14H5z" stroke="currentColor" strokeWidth="1.7"/><path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
  if (name === 'settings') {
    return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" stroke="currentColor" strokeWidth="1.7"/><path d="m19 13.2 1.2 1-.9 1.6-1.5-.5a7.6 7.6 0 0 1-1.4 1l-.2 1.6h-1.9l-.5-1.5a7.4 7.4 0 0 1-1.7.1l-.8 1.3-1.7-.7.2-1.6a7.5 7.5 0 0 1-1.3-1.1l-1.5.4-.8-1.6 1.1-1.1a7.8 7.8 0 0 1-.2-1.7l-1.3-.8.7-1.7 1.5.2a7.3 7.3 0 0 1 1.2-1.3L9 5.2l1.6-.8.9 1.2a7.6 7.6 0 0 1 1.7-.2l.7-1.4 1.8.6-.1 1.6a7.4 7.4 0 0 1 1.4 1l1.5-.5.9 1.6-1.1 1.1c.2.5.3 1.1.3 1.7Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
  }
  if (name === 'images') {
    return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7"/><circle cx="8.5" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="m4 17 5-5 3.5 3.5 2.5-2.5 5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
  }
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16 19v-1.3a3.7 3.7 0 0 0-3.7-3.7H7.7A3.7 3.7 0 0 0 4 17.7V19M10 10.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM15.5 4.2a3 3 0 0 1 0 5.8M17 14.2a3.8 3.8 0 0 1 3 3.7V19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
}

function defaultContent(mode, image) {
  return {
    display_title: image?.display_title || mode.title,
    display_note: image?.display_note || '',
    overlay_content: image?.overlay_content || '',
    text_color: image?.text_color || '#FFFFFF',
  }
}

function GameImagesWorkspace({ toast }) {
  const [images, setImages] = useState({})
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    listGameModeImages(GAME_MODES.map((mode) => mode.id))
      .then((rows) => {
        if (!active) return
        const nextImages = Object.fromEntries(rows.map((row) => [row.game_key, row]))
        setImages(nextImages)
        setDrafts(Object.fromEntries(GAME_MODES.map((mode) => [mode.id, defaultContent(mode, nextImages[mode.id])])))
      })
      .catch((error) => {
        if (active) setLoadError(error?.message || 'Không thể tải thiết lập trò chơi.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadKey])

  const updateDraft = (gameKey, field, value) => {
    setDrafts((current) => ({ ...current, [gameKey]: { ...current[gameKey], [field]: value } }))
  }

  const saveContent = async (mode, event) => {
    event.preventDefault()
    setBusyId(mode.id)
    try {
      const image = await saveGameModeContent(mode.id, drafts[mode.id] || defaultContent(mode, images[mode.id]))
      setImages((current) => ({ ...current, [mode.id]: image }))
      setDrafts((current) => ({ ...current, [mode.id]: defaultContent(mode, image) }))
      toast.success(`Đã lưu thông tin cho “${image.display_title || mode.title}”.`)
    } catch (error) {
      toast.error(error?.message || 'Không thể lưu thông tin trò chơi.')
    } finally {
      setBusyId('')
    }
  }

  const upload = async (mode, event) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setBusyId(mode.id)
    try {
      const image = await uploadGameModeImage(mode.id, file)
      setImages((current) => ({ ...current, [mode.id]: image }))
      toast.success(`Đã lưu ảnh cho “${image.display_title || mode.title}”.`)
    } catch (error) {
      toast.error(error?.message || 'Không thể tải ảnh lên.')
    } finally {
      setBusyId('')
    }
  }

  const remove = async (mode) => {
    if (!images[mode.id]?.image_path || !window.confirm(`Xóa ảnh bìa của “${drafts[mode.id]?.display_title || mode.title}”? Tên, màu chữ, ghi chú và nội dung trên ảnh sẽ được giữ lại.`)) return
    setBusyId(mode.id)
    try {
      await deleteGameModeImage(mode.id)
      setImages((current) => ({ ...current, [mode.id]: { ...current[mode.id], image_path: null, image_url: null } }))
      toast.success('Đã xóa ảnh bìa; các thiết lập trò chơi vẫn được giữ lại.')
    } catch (error) {
      toast.error(error?.message || 'Không thể xóa ảnh.')
    } finally {
      setBusyId('')
    }
  }

  return <>
    <header className="browser-heading">
      <div><p className="browser-eyebrow">Nội dung Game Mode</p><h1>Quản lý các trò chơi</h1><p>Chỉnh ảnh bìa, tên hiển thị, màu chữ và ghi chú xuất hiện trên thẻ trò chơi.</p></div>
    </header>
    <section className="browser-panel">
      <div className="game-image-toolbar"><button className="button button-quiet" type="button" onClick={() => setReloadKey((value) => value + 1)} disabled={loading || Boolean(busyId)}>Làm mới</button></div>
      {loadError && <div className="game-image-error" role="alert">{loadError}</div>}
      {loading ? <div className="game-image-loading">Đang tải thiết lập trò chơi…</div> : (
        <div className="game-image-list">
          {GAME_MODES.map((mode) => {
            const image = images[mode.id]
            const draft = drafts[mode.id] || defaultContent(mode, image)
            const ModeIcon = mode.icon
            const busy = busyId === mode.id
            return <article className="game-image-row" key={mode.id}>
              <div className="game-image-preview" style={{ '--game-image-text-color': draft.text_color }}>
                {image?.image_url
                  ? <img src={image.image_url} alt="" aria-hidden="true" />
                  : <div className="game-image-placeholder"><ModeIcon size={32} aria-hidden="true" /><span>Chưa có ảnh</span></div>}
                <div className="game-image-preview-copy"><strong>{draft.display_title}</strong><small>{draft.overlay_content || draft.display_note || mode.description}</small></div>
              </div>
              <div className="game-image-details">
                <span className={`game-image-status${image?.image_path ? '' : ' game-image-status-empty'}`}>{image?.image_path ? 'Đã có ảnh' : 'Chưa có ảnh'}</span>
                <form className="game-image-settings" onSubmit={(event) => void saveContent(mode, event)}>
                  <label>Tên trò chơi
                    <input type="text" required minLength={1} maxLength={60} value={draft.display_title} onChange={(event) => updateDraft(mode.id, 'display_title', event.target.value)} />
                  </label>
                  <label>Ghi chú
                    <textarea rows={3} maxLength={300} value={draft.display_note} onChange={(event) => updateDraft(mode.id, 'display_note', event.target.value)} placeholder="Ví dụ: Chơi theo đội, trả lời câu hỏi để tiến về kho báu…" />
                    <small>Tối đa 300 ký tự; ghi chú nhỏ hiển thị trên ảnh bìa.</small>
                  </label>
                  <label>Nội dung hiển thị trên ảnh
                    <textarea rows={3} maxLength={300} value={draft.overlay_content} onChange={(event) => updateDraft(mode.id, 'overlay_content', event.target.value)} placeholder="Nhập nội dung nổi bật muốn đặt trên ảnh…" />
                    <small>Tối đa 300 ký tự; nội dung này được làm nổi bật trên ảnh.</small>
                  </label>
                  <label className="game-image-color-field">Màu chữ
                    <span><input type="color" value={draft.text_color} onChange={(event) => updateDraft(mode.id, 'text_color', event.target.value.toUpperCase())} /><code>{draft.text_color}</code></span>
                  </label>
                  <button className="button button-primary game-image-save" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thông tin trò chơi'}</button>
                </form>
                <div className="game-image-actions">
                  <label className="game-image-upload">
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={(event) => void upload(mode, event)} aria-label={`Tải ảnh lên cho ${mode.title}`} />
                    <span>{busy ? 'Đang lưu…' : image?.image_path ? 'Đổi ảnh bìa' : 'Tải ảnh bìa lên'}</span>
                  </label>
                  {image?.image_path && <button className="button button-quiet game-image-remove" type="button" onClick={() => void remove(mode)} disabled={busy}>Xóa ảnh</button>}
                </div>
                <p className="game-image-hint">JPG, PNG, WebP hoặc GIF · tối đa 5 MB · ảnh dọc 4:5 được khuyến nghị</p>
              </div>
            </article>
          })}
        </div>
      )}
    </section>
  </>
}

export default function AdminAccountsPage() {
  const { isAdmin, profile } = useAuth()
  const toast = useToast()
  const [section, setSection] = useState('accounts')
  const [background, setBackground] = useState('')
  const [accounts, setAccounts] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')

  const load = async () => { setLoading(true); try { setAccounts(await accountService.listAccounts()) } catch (error) { toast.error(error?.message || 'Không thể tải danh sách tài khoản.') } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  const filtered = useMemo(() => { const needle = query.trim().toLowerCase(); return accounts.filter((account) => !needle || [account.email, account.full_name, account.display_name, providerLabels[account.provider]].some((value) => String(value || '').toLowerCase().includes(needle))) }, [accounts, query])
  const rename = async (account) => { const next = window.prompt('Tên hiển thị mới cho tài khoản ma:', account.full_name || ''); if (next === null || !next.trim()) return; setBusyId(account.id); try { await accountService.updateGhostDisplayName(account.id, next.trim()); toast.success('Đã cập nhật tên.'); await load() } catch (error) { toast.error(error?.message || 'Không thể cập nhật tên.') } finally { setBusyId('') } }
  const remove = async (account) => { if (!window.confirm(`Xóa tài khoản ma "${account.full_name || account.email}"? Hành động này không thể hoàn tác.`)) return; setBusyId(account.id); try { await accountService.deleteGhostAccount(account.id); toast.success('Đã xóa tài khoản ma.'); await load() } catch (error) { toast.error(error?.message || 'Không thể xóa tài khoản ma.') } finally { setBusyId('') } }
  const chooseBackground = (event) => { const file = event.target.files?.[0]; if (!file) return; if (!file.type.startsWith('image/')) { toast.error('Vui lòng chọn một tệp hình ảnh.'); return } setBackground(URL.createObjectURL(file)); toast.success('Đã cập nhật ảnh nền xem trước.') }
  if (!isAdmin) return <Navigate to={ROUTES.home} replace />

  return <div className={`browser-shell${background ? ' has-background' : ''}`} style={background ? { '--admin-background': `url(${background})` } : undefined}>
    <SiteHeader />
    <main className="browser-layout container">
      <aside className="browser-sidebar">
        <div className="browser-brand"><span className="browser-brand-mark">10</span><div><strong>Dashboard</strong><small>V10 / Quản trị</small></div></div>
        <nav aria-label="Các mục quản trị"><p className="browser-nav-label">Workspace</p>{navItems.map((item) => <button className={`browser-nav-item${section === item.id ? ' active' : ''}`} type="button" key={item.id} onClick={() => setSection(item.id)}><NavIcon name={item.icon} />{item.label}</button>)}</nav>
        <div className="browser-sidebar-footer"><span className="browser-avatar">{(profile?.display_name || profile?.email || 'A').charAt(0).toUpperCase()}</span><div><strong>{profile?.display_name || 'Quản trị viên'}</strong><small>Administrator</small></div></div>
      </aside>
      <section className="browser-content">
        {section === 'rooms' ? <AdminRoomsWorkspace toast={toast} /> : section === 'questions' ? <AdminQuestionsWorkspace toast={toast} /> : section === 'game-images' ? <GameImagesWorkspace toast={toast} /> : section === 'settings' ? <>
          <header className="browser-heading"><div><p className="browser-eyebrow">Cấu hình giao diện</p><h1>Cài đặt chung</h1><p>Tùy chỉnh không gian quản trị theo phong cách của lớp.</p></div></header>
          <div className="browser-panel settings-panel"><div><h2>Ảnh nền dashboard</h2><p>Tải ảnh lên để hiển thị phía sau giao diện quản trị. Ảnh chỉ được áp dụng trong phiên xem hiện tại.</p></div><label className="upload-background"><input type="file" accept="image/*" onChange={chooseBackground} /><span>{background ? 'Đổi ảnh nền' : 'Chọn ảnh nền'}</span></label><div className="settings-preview" style={background ? { backgroundImage: `linear-gradient(90deg, rgba(5,9,12,.5), rgba(5,9,12,.12)), url(${background})` } : undefined}><strong>{background ? 'Ảnh nền đã sẵn sàng' : 'Chưa có ảnh nền'}</strong><small>Ảnh sẽ được làm tối để nội dung luôn dễ đọc.</small></div></div>
        </> : <>
          <header className="browser-heading"><div><p className="browser-eyebrow">Verification workspace</p><h1>Quản lý tài khoản</h1><p>Theo dõi thành viên, tài khoản ma và quyền truy cập của 10A4-Quizz.</p></div><span className="browser-stat"><strong>{accounts.length}</strong><small>Tài khoản</small></span></header>
          <section className="browser-panel"><div className="admin-toolbar"><input aria-label="Tìm tài khoản" placeholder="Tìm theo email hoặc tên…" value={query} onChange={(event) => setQuery(event.target.value)} /><button className="button button-quiet" type="button" onClick={() => void load()} disabled={loading}>Làm mới</button></div>{loading ? <div className="admin-loading">Đang tải danh sách…</div> : <div className="account-table-wrap"><table className="account-table"><thead><tr><th>Tài khoản</th><th>Provider</th><th>Vai trò</th><th>Trạng thái</th><th /></tr></thead><tbody>{filtered.map((account) => <tr key={account.id}><td><strong>{account.full_name || account.display_name || 'Chưa đặt tên'}</strong><span>{account.email}</span></td><td><span className={`provider-badge provider-${account.provider}`}>{providerLabels[account.provider] || account.provider}</span></td><td>{account.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</td><td>{account.confirmed ? 'Đã xác nhận' : 'Chưa xác nhận'}</td><td>{account.is_ghost && <div className="account-row-actions"><button className="button button-quiet" type="button" onClick={() => void rename(account)} disabled={busyId === account.id}>Sửa tên</button><button className="button button-danger" type="button" onClick={() => void remove(account)} disabled={busyId === account.id}>Xóa</button></div>}</td></tr>)}{!filtered.length && <tr><td colSpan="5" className="account-empty">Không có tài khoản phù hợp.</td></tr>}</tbody></table></div>}</section>
        </>}
      </section>
    </main>
  </div>
}
