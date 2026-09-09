import { useEffect, useRef, useState } from 'react'
import * as adminService from '../services/adminService.js'

const EMPTY = { teacher: [], hero: [], gallery: [] }

export default function SiteImagesPanel() {
  const [images, setImages] = useState(EMPTY)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(null)
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
    if (file.size > 2 * 1024 * 1024) {
      return alert('Ảnh tối đa 2MB.')
    }

    setUploading(categoryId)
    try {
      const contentBase64 = await readAsDataUrl(file)
      const data = await adminService.uploadSiteImage({
        category: categoryId,
        filename: file.name,
        contentBase64,
        mimeType: file.type,
        caption: captionDraft[categoryId] || '',
      })
      setImages(data.images || EMPTY)
      setCaptionDraft((prev) => ({ ...prev, [categoryId]: '' }))
      notifyHome()
    } catch (err) {
      alert(err.message || 'Không tải được ảnh lên GitHub.')
    } finally {
      setUploading(null)
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
        Ảnh được lưu trực tiếp vào repo GitHub <strong>class-web</strong>
        {' '}(thư mục <code>frontend/public/images</code>). Trang chủ sẽ hiện
        ảnh mới ngay sau khi thêm, không cần sửa code.
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
                    {busy ? 'Đang tải lên GitHub…' : 'Thêm ảnh'}
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
