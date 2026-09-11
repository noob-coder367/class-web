import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import RulesSettings from './RulesSettings.jsx'
import ReputationBoard from './ReputationBoard.jsx'
import './RulesBoard.css'

const PERIOD_OPTIONS = [
  '',
  'Sáng T1',
  'Sáng T2',
  'Sáng T3',
  'Sáng T4',
  'Sáng T5',
  'Chiều T1',
  'Chiều T2',
  'Chiều T3',
  'Chiều T4',
]

const MAX_PHOTOS = 3
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_EDGE = 1920
const JPEG_QUALITY = 0.82
const SKIP_COMPRESS_UNDER = 400 * 1024

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.7.9 1.2 1.6 1.3H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
}

function formatDate(value) {
  if (!value) return '—'
  const [y, m, d] = String(value).split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

function itemText(item) {
  if (typeof item === 'string') return item
  return item?.text || ''
}

function itemPoints(item) {
  const n = Number(typeof item === 'object' ? item?.points : NaN)
  return Number.isFinite(n) ? n : 5
}

function offenseOptions(rules) {
  const names = []
  for (const section of rules?.sections || []) {
    for (const line of section.items || []) {
      const text = itemText(line)
      const name = String(text).split(/\s*:\s*/)[0].trim()
      if (name && !names.some((row) => row.name === name)) {
        names.push({ name, points: itemPoints(line) })
      }
    }
  }
  return names
}

function buildLocalLeaderboard(members, violations, rules) {
  const starting = Number(rules?.startingPoints) > 0 ? Number(rules.startingPoints) : 100
  const map = new Map(offenseOptions(rules).map((row) => [row.name, row.points]))
  const rows = (members || []).map((member) => {
    const mine = (violations || []).filter((row) => {
      if (row.userId && member.id) return row.userId === member.id
      return !row.userId && row.name === member.username
    })
    const deducted = mine.reduce((sum, row) => {
      const pts = Number(row.points)
      if (Number.isFinite(pts)) return sum + pts
      return sum + (map.get(row.offense) ?? 5)
    }, 0)
    return {
      id: member.id,
      username: member.username,
      role: member.role,
      score: starting - deducted,
      deducted,
      violations: mine.length,
    }
  })
  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.violations !== b.violations) return a.violations - b.violations
    return String(a.username).localeCompare(String(b.username), 'vi')
  })
  let lastScore = null
  let rank = 0
  for (const row of rows) {
    if (row.score !== lastScore) {
      rank += 1
      lastScore = row.score
    }
    row.rank = rank
  }
  return { startingPoints: starting, rows }
}

export default function RulesBoard({
  rules,
  violations,
  members,
  directory,
  isAdmin,
  onSaveRules,
  onAddViolation,
  onDeleteViolation,
  onRefreshMembers,
}) {
  const { profile } = useAuth()
  const [pane, setPane] = useState('rules')
  const [openSettings, setOpenSettings] = useState(false)
  const [form, setForm] = useState({
    date: todayISO(),
    period: '',
    userId: '',
    offense: '',
    warning: '',
    customPoints: 5,
  })
  const [customOffense, setCustomOffense] = useState('')
  const [photos, setPhotos] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState(null)
  const galleryRef = useRef(null)
  const cameraRef = useRef(null)
  const photosRef = useRef([])

  const options = useMemo(() => offenseOptions(rules), [rules])
  const selectedOffense = options.find((row) => row.name === form.offense)
  const nameOptions = (directory?.length ? directory : members) || []
  const ranked = useMemo(
    () => buildLocalLeaderboard(members, violations, rules),
    [members, violations, rules],
  )

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  useEffect(() => {
    if (pane === 'rank') onRefreshMembers?.()
  }, [pane, onRefreshMembers])

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  useEffect(() => {
    return () => {
      photosRef.current.forEach((item) => URL.revokeObjectURL(item.preview))
    }
  }, [])

  const handlePickPhotos = async (fileList) => {
    const incoming = Array.from(fileList || [])
    if (!incoming.length) return
    setError('')
    const room = MAX_PHOTOS - photos.length
    if (room <= 0) {
      setError(`Tối đa ${MAX_PHOTOS} ảnh bằng chứng.`)
      return
    }

    const next = []
    for (const file of incoming.slice(0, room)) {
      if (!file.type.startsWith('image/')) {
        setError('Vui lòng chọn file ảnh (JPG, PNG, WEBP, GIF).')
        continue
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError('Mỗi ảnh tối đa 10MB.')
        continue
      }
      next.push({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        preview: URL.createObjectURL(file),
      })
    }
    if (next.length) setPhotos((prev) => [...prev, ...next].slice(0, MAX_PHOTOS))
    if (galleryRef.current) galleryRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  const removePhoto = (id) => {
    setPhotos((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target) URL.revokeObjectURL(target.preview)
      return prev.filter((item) => item.id !== id)
    })
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    const member = nameOptions.find((row) => row.id === form.userId)
    const offense = form.offense === '__other__' ? customOffense.trim() : form.offense.trim()
    if (!member) {
      setError('Hãy chọn họ và tên từ danh sách tài khoản đã đăng ký.')
      return
    }
    if (!offense) {
      setError('Cần nhập lỗi vi phạm.')
      return
    }
    const points = form.offense === '__other__'
      ? Math.min(100, Math.max(0, Math.round(Number(form.customPoints) || 0)))
      : (selectedOffense?.points ?? 5)

    setSaving(true)
    setError('')
    try {
      const photoPayloads = []
      for (const item of photos) {
        const prepared = await prepareImageForUpload(item.file)
        photoPayloads.push({
          filename: prepared.name,
          mimeType: prepared.type,
          contentBase64: await readAsDataUrl(prepared),
        })
      }
      await onAddViolation?.({
        date: form.date || todayISO(),
        period: form.period,
        userId: member.id,
        name: member.username,
        offense,
        warning: form.warning.trim(),
        points,
        photos: photoPayloads,
      })
      photos.forEach((item) => URL.revokeObjectURL(item.preview))
      setPhotos([])
      setForm({
        date: todayISO(),
        period: '',
        userId: '',
        offense: '',
        warning: '',
        customPoints: 5,
      })
      setCustomOffense('')
    } catch (err) {
      setError(err.message || 'Không thêm được vi phạm.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Xoá hàng vi phạm này?')) return
    try {
      await onDeleteViolation?.(id)
    } catch (err) {
      setError(err.message || 'Không xoá được vi phạm.')
    }
  }

  return (
    <div className="rules-board">
      <div className="rules-switch" role="tablist" aria-label="Nội quy lớp">
        <button
          type="button"
          role="tab"
          aria-selected={pane === 'rules'}
          className={pane === 'rules' ? 'is-active' : ''}
          onClick={() => setPane('rules')}
        >
          Nội quy
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pane === 'violations'}
          className={pane === 'violations' ? 'is-active' : ''}
          onClick={() => setPane('violations')}
        >
          Danh sách vi phạm
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pane === 'rank'}
          className={pane === 'rank' ? 'is-active' : ''}
          onClick={() => setPane('rank')}
        >
          Bảng xếp hạng
        </button>
      </div>

      {pane === 'rules' ? (
        <article className="rules-doc">
          <h2 className="rules-doc-title">{rules?.title || 'NỘI QUY LỚP'}</h2>
          {(rules?.sections || []).map((section) => (
            <section key={section.id} className="rules-doc-section">
              <h3>{section.title}</h3>
              <ul>
                {(section.items || []).map((item, index) => (
                  <li key={`${section.id}-${index}`}>
                    <span>{itemText(item)}</span>
                    {itemPoints(item) > 0 ? (
                      <span className="rules-point-chip">−{itemPoints(item)}đ</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {rules?.notice?.body ? (
            <p className="rules-doc-notice">
              <strong>{rules.notice.title || 'LƯU Ý'} :</strong> {rules.notice.body}
            </p>
          ) : null}
        </article>
      ) : null}

      {pane === 'rank' ? (
        <ReputationBoard
          rows={ranked.rows}
          startingPoints={ranked.startingPoints}
          currentUserId={profile?.id}
        />
      ) : null}

      {pane === 'violations' ? (
        <div className="rules-violations">
          {isAdmin ? (
            <form className="rules-add-form" onSubmit={handleAdd}>
              <h3>Thêm vi phạm</h3>
              <div className="rules-add-grid">
                <label>
                  Ngày
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Tiết (tuỳ chọn)
                  <select
                    value={form.period}
                    onChange={(e) => setForm((prev) => ({ ...prev, period: e.target.value }))}
                  >
                    {PERIOD_OPTIONS.map((item) => (
                      <option key={item || 'none'} value={item}>
                        {item || '—'}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Họ và tên
                  <select
                    value={form.userId}
                    onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))}
                    required
                  >
                    <option value="">Chọn tài khoản đã đăng ký</option>
                    {(nameOptions).map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.username}
                        {member.role === 'admin' ? ' (Admin)' : ''}
                        {member.is_member === false ? ' (chưa 10A4)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Lỗi vi phạm
                  <select
                    value={form.offense}
                    onChange={(e) => setForm((prev) => ({ ...prev, offense: e.target.value }))}
                    required
                  >
                    <option value="">Chọn lỗi</option>
                    {options.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name} (−{item.points}đ)
                      </option>
                    ))}
                    <option value="__other__">Khác...</option>
                  </select>
                </label>
                {form.offense === '__other__' ? (
                  <div className="rules-other-row">
                    <label>
                      Lỗi khác
                      <input
                        value={customOffense}
                        onChange={(e) => setCustomOffense(e.target.value)}
                        placeholder="Nhập lỗi vi phạm"
                      />
                    </label>
                    <label className="rules-points-field">
                      Số điểm trừ
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={form.customPoints}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, customPoints: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                ) : selectedOffense ? (
                  <p className="rules-points-hint">
                    Lỗi này sẽ trừ <strong>{selectedOffense.points} điểm uy tín</strong>
                    {' '}(chỉnh trong Cài đặt nội quy).
                  </p>
                ) : null}
                <label className="rules-add-span">
                  Nội dung cảnh báo
                  <input
                    value={form.warning}
                    onChange={(e) => setForm((prev) => ({ ...prev, warning: e.target.value }))}
                    placeholder="Ví dụ: Nhắc nhở lần 1 / đánh dấu 3 lần"
                  />
                </label>
                <div className="rules-add-span rules-photos">
                  <div className="rules-photos-head">
                    <span>Ảnh bằng chứng</span>
                    <small>Tối đa {MAX_PHOTOS} ảnh · mỗi ảnh ≤ 10MB</small>
                  </div>
                  <div className="rules-photos-grid">
                    {photos.map((item) => (
                      <figure key={item.id} className="rules-photo-card">
                        <img src={item.preview} alt="Bằng chứng" />
                        <button type="button" onClick={() => removePhoto(item.id)} aria-label="Xoá ảnh">
                          ×
                        </button>
                      </figure>
                    ))}
                    {photos.length < MAX_PHOTOS ? (
                      <div className="rules-photo-add">
                        <input
                          ref={galleryRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          multiple
                          hidden
                          onChange={(e) => handlePickPhotos(e.target.files)}
                        />
                        <input
                          ref={cameraRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          hidden
                          onChange={(e) => handlePickPhotos(e.target.files)}
                        />
                        <button type="button" onClick={() => cameraRef.current?.click()}>
                          Chụp ảnh
                        </button>
                        <button type="button" onClick={() => galleryRef.current?.click()}>
                          Thư viện
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              {error && pane === 'violations' ? <p className="rules-form-error">{error}</p> : null}
              <button type="submit" disabled={saving}>
                {saving ? 'Đang thêm...' : 'Thêm hàng vi phạm'}
              </button>
            </form>
          ) : null}

          {!violations?.length ? (
            <p className="rules-empty">Chưa có vi phạm</p>
          ) : (
            <div className="rules-table-wrap">
              <table className="rules-table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Tiết</th>
                    <th>Tên</th>
                    <th>Lỗi vi phạm</th>
                    <th>Điểm trừ</th>
                    <th>Nội dung cảnh báo</th>
                    <th>Bằng chứng</th>
                    {isAdmin ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {violations.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.date)}</td>
                      <td>{row.period || '—'}</td>
                      <td>{row.name}</td>
                      <td>{row.offense}</td>
                      <td className="rules-points-cell">−{Number(row.points) || 0}</td>
                      <td>{row.warning || '—'}</td>
                      <td>
                        {row.photos?.length ? (
                          <div className="rules-evidence">
                            {row.photos.map((photo) => (
                              <button
                                key={photo.path || photo.url}
                                type="button"
                                className="rules-evidence-thumb"
                                onClick={() => setLightbox(photo)}
                              >
                                <img src={photo.url} alt="Bằng chứng" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      {isAdmin ? (
                        <td>
                          <button
                            type="button"
                            className="rules-row-delete"
                            onClick={() => handleDelete(row.id)}
                          >
                            Xoá
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {isAdmin && pane === 'rules' ? (
        <button
          type="button"
          className="rules-fab"
          onClick={() => setOpenSettings(true)}
          aria-label="Cài đặt nội quy"
          title="Cài đặt nội quy"
        >
          <IconGear />
        </button>
      ) : null}

      {openSettings && isAdmin && rules ? (
        <RulesSettings
          data={rules}
          onClose={() => setOpenSettings(false)}
          onSave={onSaveRules}
        />
      ) : null}

      {lightbox ? (
        <div className="rules-lightbox" onClick={() => setLightbox(null)} role="presentation">
          <img src={lightbox.url} alt="Bằng chứng vi phạm" onClick={(e) => e.stopPropagation()} />
          <button type="button" onClick={() => setLightbox(null)} aria-label="Đóng">
            Đóng
          </button>
        </div>
      ) : null}
    </div>
  )
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Không đọc được file ảnh.'))
    reader.readAsDataURL(file)
  })
}

async function prepareImageForUpload(file) {
  if (file.type === 'image/gif') return file
  if (file.size <= SKIP_COMPRESS_UNDER) return file
  try {
    const compressed = await compressToJpeg(file)
    if (compressed && compressed.size > 0 && compressed.size < file.size) {
      return compressed
    }
  } catch (err) {
    console.warn('Không nén được ảnh, gửi file gốc.', err)
  }
  return file
}

async function compressToJpeg(file) {
  const source = await loadImageSource(file)
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height, 1))
    const width = Math.max(1, Math.round(source.width * scale))
    const height = Math.max(1, Math.round(source.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Canvas không khả dụng.')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    source.draw(ctx, width, height)
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Không nén được ảnh.'))),
        'image/jpeg',
        JPEG_QUALITY
      )
    })
    const base = String(file.name || 'anh').replace(/\.[a-z0-9]+$/i, '') || 'anh'
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } finally {
    source.close()
  }
}

async function loadImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, width, height) => ctx.drawImage(bitmap, 0, 0, width, height),
        close: () => bitmap.close?.(),
      }
    } catch {
      // fallback Image
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Không đọc được ảnh.'))
      el.src = url
    })
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw: (ctx, width, height) => ctx.drawImage(image, 0, 0, width, height),
      close: () => {},
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}
