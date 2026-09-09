import { useEffect, useRef, useState } from 'react'
import * as adminService from '../services/adminService.js'

const EMPTY = { teacher: [], hero: [], gallery: [] }
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_EDGE = 1920
const JPEG_QUALITY = 0.82
const SKIP_COMPRESS_UNDER = 400 * 1024

export default function SiteImagesPanel() {
  const [images, setImages] = useState(EMPTY)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(null)
  const [uploadStage, setUploadStage] = useState('upload')
  const [captionDraft, setCaptionDraft] = useState({})
  const inputRefs = useRef({})

  const load = async () => {
    setLoading(true)
    try {
      const data = await adminService.getSiteImages()
      setImages(data.images || EMPTY)
      setCategories(data.categories || [])
    } catch (err) {
      alert(err.message || 'Không tải được danh sách ảnh trên GitHub.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const notifyHome = () => {
    window.dispatchEvent(new Event('site-images-updated'))
  }

  const handlePick = (categoryId) => {
    inputRefs.current[categoryId]?.click()
  }

  const handleFiles = async (categoryId, fileList) => {
    const file = fileList?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      return alert('Vui lòng chọn file ảnh.')
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return alert('Ảnh tối đa 10MB.')
    }

    setUploading(categoryId)
    setUploadStage('compress')
    try {
      const prepared = await prepareImageForUpload(file)
      setUploadStage('upload')
      const contentBase64 = await readAsDataUrl(prepared)
      const data = await adminService.uploadSiteImage({
        category: categoryId,
        filename: prepared.name,
        contentBase64,
        mimeType: prepared.type,
        caption: captionDraft[categoryId] || '',
      })
      setImages(data.images || EMPTY)
      setCaptionDraft((prev) => ({ ...prev, [categoryId]: '' }))
      notifyHome()
    } catch (err) {
      alert(err.message || 'Không tải được ảnh lên GitHub.')
    } finally {
      setUploading(null)
      setUploadStage('upload')
      if (inputRefs.current[categoryId]) inputRefs.current[categoryId].value = ''
    }
  }

  const handleDelete = async (item) => {
    const ok = window.confirm(`Xóa ảnh "${item.caption || item.name}" khỏi GitHub?`)
    if (!ok) return
    try {
      const data = await adminService.deleteSiteImage(item.path)
      setImages(data.images || EMPTY)
      notifyHome()
    } catch (err) {
      alert(err.message || 'Xóa ảnh thất bại.')
    }
  }

  if (loading) {
    return <p className="loading-text">Đang tải ảnh từ GitHub…</p>
  }

  return (
    <div className="site-images-panel">
      <p className="site-images-intro">
        Ảnh được lưu <strong>vĩnh viễn</strong> trong repo GitHub{' '}
        <strong>class-web</strong> (thư mục <code>frontend/public/images</code>),
        cho đến khi admin bấm Xóa. Ảnh camera sẽ được nén trước khi tải lên
        để nhanh hơn. Trang chủ hiện ảnh mới ngay sau khi thêm.
      </p>

      {categories.map((cat) => {
        const list = images[cat.id] || []
        const atMax = list.length >= cat.max
        const busy = uploading === cat.id

        return (
          <section key={cat.id} className="site-images-group">
            <header className="site-images-group-head">
              <div>
                <h3>{cat.label}</h3>
                <p>{cat.hint}</p>
              </div>
              <span className="site-images-count">
                {list.length}/{cat.max}
              </span>
            </header>

            <div className="site-images-grid">
              {list.map((item) => (
                <figure key={item.path} className="site-images-card">
                  <img src={item.url} alt={item.caption || item.name} />
                  <figcaption>{item.caption || item.name}</figcaption>
                  <button
                    type="button"
                    className="btn-action btn-delete"
                    onClick={() => handleDelete(item)}
                  >
                    Xóa
                  </button>
                </figure>
              ))}

              {!atMax && (
                <div className="site-images-upload">
                  <input
                    ref={(el) => {
                      inputRefs.current[cat.id] = el
                    }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    hidden
                    onChange={(e) => handleFiles(cat.id, e.target.files)}
                  />
                  <input
                    type="text"
                    className="site-images-caption"
                    placeholder="Chú thích (không bắt buộc)"
                    value={captionDraft[cat.id] || ''}
                    onChange={(e) =>
                      setCaptionDraft((prev) => ({
                        ...prev,
                        [cat.id]: e.target.value,
                      }))
                    }
                    maxLength={120}
                  />
                  <button
                    type="button"
                    className="btn-action btn-member"
                    disabled={busy}
                    onClick={() => handlePick(cat.id)}
                  >
                    {busy
                      ? uploadStage === 'compress'
                        ? 'Đang nén ảnh…'
                        : 'Đang tải lên GitHub…'
                      : 'Thêm ảnh'}
                  </button>
                </div>
              )}
            </div>
          </section>
        )
      })}
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
      // Safari/iPad đôi khi fail createImageBitmap — fallback Image.
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
