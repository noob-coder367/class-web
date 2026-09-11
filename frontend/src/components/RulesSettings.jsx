import { useEffect, useState } from 'react'
import './RulesBoard.css'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export default function RulesSettings({ data, onClose, onSave }) {
  const [draft, setDraft] = useState(() => clone(data))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const setSectionTitle = (index, title) => {
    setDraft((prev) => {
      const next = clone(prev)
      next.sections[index].title = title
      return next
    })
  }

  const setItem = (sectionIndex, itemIndex, value) => {
    setDraft((prev) => {
      const next = clone(prev)
      next.sections[sectionIndex].items[itemIndex] = value
      return next
    })
  }

  const addItem = (sectionIndex) => {
    setDraft((prev) => {
      const next = clone(prev)
      next.sections[sectionIndex].items.push('')
      return next
    })
  }

  const removeItem = (sectionIndex, itemIndex) => {
    setDraft((prev) => {
      const next = clone(prev)
      next.sections[sectionIndex].items.splice(itemIndex, 1)
      return next
    })
  }

  const addSection = () => {
    setDraft((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        { id: `s-${Date.now()}`, title: 'Mục mới', items: [''] },
      ],
    }))
  }

  const removeSection = (index) => {
    setDraft((prev) => {
      const next = clone(prev)
      next.sections.splice(index, 1)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const cleaned = clone(draft)
      cleaned.sections = cleaned.sections
        .map((section) => ({
          ...section,
          title: String(section.title || '').trim(),
          items: (section.items || []).map((item) => String(item || '').trim()).filter(Boolean),
        }))
        .filter((section) => section.title || section.items.length)
      cleaned.notice = {
        title: String(cleaned.notice?.title || '').trim() || 'LƯU Ý',
        body: String(cleaned.notice?.body || '').trim(),
      }
      await onSave?.(cleaned)
      onClose?.()
    } catch (err) {
      setError(err.message || 'Không lưu được nội quy.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rules-settings-overlay" onClick={onClose} role="presentation">
      <div
        className="rules-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="rules-settings-header">
          <div>
            <p>Chỉ admin</p>
            <h2 id="rules-settings-title">Cài đặt nội quy</h2>
          </div>
          <button type="button" className="rules-settings-close" onClick={onClose} aria-label="Đóng">
            <IconClose />
          </button>
        </header>

        <div className="rules-settings-body">
          <label className="rules-settings-field">
            <span className="rules-settings-red">Tiêu đề trang</span>
            <input
              value={draft.title || ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
            />
          </label>

          {draft.sections.map((section, sIndex) => (
            <section key={section.id || sIndex} className="rules-settings-block">
              <div className="rules-settings-block-head">
                <label className="rules-settings-field">
                  <span className="rules-settings-red">Tiêu đề mục</span>
                  <input
                    value={section.title}
                    onChange={(e) => setSectionTitle(sIndex, e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="rules-settings-remove"
                  onClick={() => removeSection(sIndex)}
                >
                  Xoá mục
                </button>
              </div>

              <p className="rules-settings-hint">Nội dung chữ đen</p>
              {(section.items || []).map((item, iIndex) => (
                <div key={`${section.id}-${iIndex}`} className="rules-settings-item-row">
                  <input
                    value={item}
                    onChange={(e) => setItem(sIndex, iIndex, e.target.value)}
                    placeholder="Nội dung điều khoản..."
                  />
                  <button type="button" onClick={() => removeItem(sIndex, iIndex)} aria-label="Xoá dòng">
                    ×
                  </button>
                </div>
              ))}
              <button type="button" className="rules-settings-add" onClick={() => addItem(sIndex)}>
                + Thêm dòng
              </button>
            </section>
          ))}

          <button type="button" className="rules-settings-add rules-settings-add--section" onClick={addSection}>
            + Thêm mục
          </button>

          <section className="rules-settings-block">
            <label className="rules-settings-field">
              <span className="rules-settings-red">Tiêu đề lưu ý</span>
              <input
                value={draft.notice?.title || ''}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    notice: { ...prev.notice, title: e.target.value },
                  }))
                }
              />
            </label>
            <label className="rules-settings-field">
              <span className="rules-settings-red">Nội dung lưu ý (chữ đỏ)</span>
              <textarea
                rows={3}
                value={draft.notice?.body || ''}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    notice: { ...prev.notice, body: e.target.value },
                  }))
                }
              />
            </label>
          </section>
        </div>

        {error ? <p className="rules-settings-error">{error}</p> : null}

        <footer className="rules-settings-footer">
          <button type="button" className="rules-btn-ghost" onClick={onClose} disabled={saving}>
            Huỷ
          </button>
          <button type="button" className="rules-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu nội quy'}
          </button>
        </footer>
      </div>
    </div>
  )
}
