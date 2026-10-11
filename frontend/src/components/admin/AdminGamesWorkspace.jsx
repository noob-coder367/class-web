import { useEffect, useState } from 'react'
import { GAME_CATALOG } from '../../lib/gameModes.js'
import {
  MAX_GALLERY_IMAGES,
  deleteGameGalleryImage,
  deleteGameModeImage,
  listGameModeImages,
  saveGameModeContent,
  uploadGameGalleryImage,
  uploadGameModeImage,
} from '../../services/gameModeImageService.js'
import '../../game-catalog.css'

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

function defaultContent(game, image) {
  return {
    display_title: image?.display_title || game.title,
    display_note: image?.display_note || '',
    overlay_content: image?.overlay_content || '',
    detail_description: image?.detail_description || '',
    text_color: image?.text_color || '#FFFFFF',
  }
}

/**
 * Admin → "Quản lý các trò chơi". Danh sách game lấy từ GAME_CATALOG, chính là danh sách
 * mà trang người chơi hiển thị, nên hai bên luôn đồng bộ.
 */
export default function AdminGamesWorkspace({ toast }) {
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
    listGameModeImages(GAME_CATALOG.map((game) => game.id))
      .then((rows) => {
        if (!active) return
        const nextImages = Object.fromEntries(rows.map((row) => [row.game_key, row]))
        setImages(nextImages)
        setDrafts(Object.fromEntries(GAME_CATALOG.map((game) => [game.id, defaultContent(game, nextImages[game.id])])))
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

  const saveContent = async (game, event) => {
    event.preventDefault()
    setBusyId(game.id)
    try {
      const image = await saveGameModeContent(game.id, drafts[game.id] || defaultContent(game, images[game.id]))
      setImages((current) => ({ ...current, [game.id]: image }))
      setDrafts((current) => ({ ...current, [game.id]: defaultContent(game, image) }))
      toast.success(`Đã lưu thông tin cho “${image.display_title || game.title}”.`)
    } catch (error) {
      toast.error(error?.message || 'Không thể lưu thông tin trò chơi.')
    } finally {
      setBusyId('')
    }
  }

  const upload = async (game, event) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setBusyId(game.id)
    try {
      const image = await uploadGameModeImage(game.id, file)
      setImages((current) => ({ ...current, [game.id]: image }))
      toast.success(`Đã lưu ảnh cho “${image.display_title || game.title}”.`)
    } catch (error) {
      toast.error(error?.message || 'Không thể tải ảnh lên.')
    } finally {
      setBusyId('')
    }
  }

  const remove = async (game) => {
    if (!images[game.id]?.image_path || !window.confirm(`Xóa ảnh bìa của “${drafts[game.id]?.display_title || game.title}”? Tên, màu chữ, ghi chú và nội dung trên ảnh sẽ được giữ lại.`)) return
    setBusyId(game.id)
    try {
      await deleteGameModeImage(game.id)
      setImages((current) => ({ ...current, [game.id]: { ...current[game.id], image_path: null, image_url: null } }))
      toast.success('Đã xóa ảnh bìa; các thiết lập trò chơi vẫn được giữ lại.')
    } catch (error) {
      toast.error(error?.message || 'Không thể xóa ảnh.')
    } finally {
      setBusyId('')
    }
  }

  const uploadGallery = async (game, event) => {
    const files = Array.from(event.currentTarget.files || [])
    event.currentTarget.value = ''
    if (!files.length) return
    const used = images[game.id]?.gallery?.length || 0
    const room = MAX_GALLERY_IMAGES - used
    if (room <= 0) { toast.error(`Mỗi trò chơi chỉ có tối đa ${MAX_GALLERY_IMAGES} ảnh giới thiệu.`); return }
    const selected = files.slice(0, room)
    if (files.length > room) toast.error(`Chỉ thêm ${room} ảnh đầu tiên (giới hạn ${MAX_GALLERY_IMAGES} ảnh).`)
    setBusyId(game.id)
    try {
      let latest = null
      for (const file of selected) {
        latest = await uploadGameGalleryImage(game.id, file)
        setImages((current) => ({ ...current, [game.id]: latest }))
      }
      if (latest) toast.success(`Đã thêm ${selected.length} ảnh giới thiệu.`)
    } catch (error) {
      toast.error(error?.message || 'Không thể tải ảnh giới thiệu lên.')
      setReloadKey((value) => value + 1)
    } finally {
      setBusyId('')
    }
  }

  const removeGallery = async (game, item) => {
    if (!window.confirm('Xóa ảnh giới thiệu này?')) return
    setBusyId(game.id)
    try {
      const image = await deleteGameGalleryImage(game.id, item.path)
      setImages((current) => ({ ...current, [game.id]: image }))
      toast.success('Đã xóa ảnh giới thiệu.')
    } catch (error) {
      toast.error(error?.message || 'Không thể xóa ảnh giới thiệu.')
    } finally {
      setBusyId('')
    }
  }

  return <>
    <header className="browser-heading">
      <div><p className="browser-eyebrow">Nội dung Game Mode</p><h1>Quản lý các trò chơi</h1><p>Chỉnh ảnh bìa, ảnh giới thiệu, tên, mô tả và màu chữ hiển thị trên thẻ và trang chi tiết của từng trò chơi ({GAME_CATALOG.length} trò chơi).</p></div>
    </header>
    <section className="browser-panel">
      <div className="game-image-toolbar"><button className="button button-quiet" type="button" onClick={() => setReloadKey((value) => value + 1)} disabled={loading || Boolean(busyId)}>Làm mới</button></div>
      {loadError && <div className="game-image-error" role="alert">{loadError}</div>}
      {loading ? <div className="game-image-loading">Đang tải thiết lập trò chơi…</div> : (
        <div className="game-image-list">
          {GAME_CATALOG.map((game) => {
            const image = images[game.id]
            const draft = drafts[game.id] || defaultContent(game, image)
            const GameIcon = game.icon
            const busy = busyId === game.id
            const gallery = image?.gallery || []
            return <article className="game-image-row" key={game.id}>
              <div className="game-image-preview" style={{ '--game-image-text-color': draft.text_color }}>
                {image?.image_url
                  ? <img src={image.image_url} alt="" aria-hidden="true" />
                  : <div className="game-image-placeholder"><GameIcon size={32} aria-hidden="true" /><span>Chưa có ảnh</span></div>}
                <div className="game-image-preview-copy"><strong>{draft.display_title}</strong>{(draft.overlay_content || game.description) && <small>{draft.overlay_content || game.description}</small>}</div>
              </div>
              <div className="game-image-details">
                <span className={`game-image-status${image?.image_path ? '' : ' game-image-status-empty'}`}>{image?.image_path ? 'Đã có ảnh' : 'Chưa có ảnh'} · {game.kindLabel}</span>
                <form className="game-image-settings" onSubmit={(event) => void saveContent(game, event)}>
                  <label>Tên trò chơi
                    <input type="text" required minLength={1} maxLength={60} value={draft.display_title} onChange={(event) => updateDraft(game.id, 'display_title', event.target.value)} />
                  </label>
                  <label>Nội dung hiển thị trên ảnh
                    <textarea rows={3} maxLength={300} value={draft.overlay_content} onChange={(event) => updateDraft(game.id, 'overlay_content', event.target.value)} placeholder="Nhập nội dung nổi bật muốn đặt trên ảnh…" />
                    <small>Tối đa 300 ký tự; hiện khi rê chuột lên thẻ trò chơi.</small>
                  </label>
                  <label>Mô tả chi tiết (trang chi tiết)
                    <textarea rows={5} maxLength={2000} value={draft.detail_description} onChange={(event) => updateDraft(game.id, 'detail_description', event.target.value)} placeholder="Giới thiệu cách chơi, luật chơi, mẹo… Để trống sẽ dùng mô tả mặc định." />
                    <small>Tối đa 2000 ký tự; xuống dòng được giữ nguyên.</small>
                  </label>
                  <label>Ghi chú
                    <textarea rows={3} maxLength={300} value={draft.display_note} onChange={(event) => updateDraft(game.id, 'display_note', event.target.value)} placeholder="Ví dụ: Chơi theo đội, trả lời câu hỏi để tiến về kho báu…" />
                    <small>Tối đa 300 ký tự; ghi chú chỉ dùng trong ô quản lý này.</small>
                  </label>
                  <label className="game-image-color-field">Màu chữ
                    <span><input type="color" value={draft.text_color} onChange={(event) => updateDraft(game.id, 'text_color', event.target.value.toUpperCase())} /><code>{draft.text_color}</code></span>
                  </label>
                  <button className="button button-primary game-image-save" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thông tin trò chơi'}</button>
                </form>
                <div className="game-image-actions">
                  <label className="game-image-upload">
                    <input type="file" accept={IMAGE_ACCEPT} disabled={busy} onChange={(event) => void upload(game, event)} aria-label={`Tải ảnh bìa lên cho ${game.title}`} />
                    <span>{busy ? 'Đang lưu…' : image?.image_path ? 'Đổi ảnh bìa' : 'Tải ảnh bìa lên'}</span>
                  </label>
                  {image?.image_path && <button className="button button-quiet game-image-remove" type="button" onClick={() => void remove(game)} disabled={busy}>Xóa ảnh</button>}
                </div>
                <p className="game-image-hint">JPG, PNG, WebP hoặc GIF · tối đa 5 MB · khuyến nghị ảnh ngang 16:9</p>

                <div className="gc-admin-gallery">
                  <div className="gc-admin-gallery-head">
                    <strong>Ảnh giới thiệu ({gallery.length}/{MAX_GALLERY_IMAGES})</strong>
                    <label className="game-image-upload">
                      <input type="file" multiple accept={IMAGE_ACCEPT} disabled={busy || gallery.length >= MAX_GALLERY_IMAGES} onChange={(event) => void uploadGallery(game, event)} aria-label={`Thêm ảnh giới thiệu cho ${game.title}`} />
                      <span>{busy ? 'Đang lưu…' : 'Thêm ảnh giới thiệu'}</span>
                    </label>
                  </div>
                  {gallery.length
                    ? <ul className="gc-admin-gallery-list">{gallery.map((item) => <li key={item.path}><img src={item.url} alt="" aria-hidden="true" loading="lazy" /><button type="button" onClick={() => void removeGallery(game, item)} disabled={busy}>Xóa</button></li>)}</ul>
                    : <p className="gc-admin-gallery-empty">Chưa có ảnh giới thiệu. Ảnh sẽ hiện ở thư viện ảnh trên trang chi tiết.</p>}
                </div>
              </div>
            </article>
          })}
        </div>
      )}
    </section>
  </>
}
