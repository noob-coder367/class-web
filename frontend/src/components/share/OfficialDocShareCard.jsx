import './OfficialDocShareCard.css'

const CODE_BY_POST = {
  main: 'TBC',
  important: 'BTVN',
  discipline: 'NQL',
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatVNDate(value) {
  const date = new Date(value || Date.now())
  if (Number.isNaN(date.getTime())) return 'TP. Hồ Chí Minh, ngày -- tháng -- năm ----'
  return `TP. Hồ Chí Minh, ngày ${date.getDate()} tháng ${pad2(date.getMonth() + 1)} năm ${date.getFullYear()}`
}

function bodyParagraphs(content) {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n')
  const paragraphs = []
  let buffer = []
  const flush = () => {
    const text = buffer.join(' ').trim()
    if (text) paragraphs.push(text)
    buffer = []
  }
  for (const line of lines) {
    if (!line.trim()) {
      flush()
      continue
    }
    if (/^\s*[-–—•]\s*/.test(line)) {
      flush()
      paragraphs.push(line.trim())
    } else {
      buffer.push(line.trim())
    }
  }
  flush()
  return paragraphs
}

export function documentCodeForPost(post) {
  return CODE_BY_POST[post?.section] || 'TBC'
}

export default function OfficialDocShareCard({ post }) {
  const code = documentCodeForPost(post)
  const kind = post?.document_kind === 'bao_cao' ? 'BÁO CÁO' : 'THÔNG BÁO'
  const shortId = Number(post?.short_id) > 0 ? post.short_id : '—'
  const images = Array.isArray(post?.images) ? post.images : []
  const paragraphs = bodyParagraphs(post?.content)
  return (
    <article className="official-doc-card">
      <header className="official-doc-header">
        <div className="official-doc-col official-doc-col--left">
          <div className="official-doc-agency-sup">Ban cán sự 10A4</div>
          <div className="official-doc-agency">Chi đoàn 10A4</div>
          <div className="official-doc-agency-main">
            <span className="official-doc-rule-text">ĐOÀN TRƯỜNG THPT NGUYỄN HỮU HUÂN</span>
          </div>
        </div>
        <div className="official-doc-col official-doc-col--right">
          <div className="official-doc-nation">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div className="official-doc-motto">
            <span className="official-doc-rule-text">Độc lập - Tự do - Hạnh phúc</span>
          </div>
        </div>
      </header>
      <div className="official-doc-meta">
        <div className="official-doc-number">Số: {shortId}/{code}-CĐ10A4</div>
        <div className="official-doc-date">{formatVNDate(post?.created_at || post?.updated_at)}</div>
      </div>
      <h1>{kind}</h1>
      {post?.title ? <h2 className="official-doc-main-title">{post.title}</h2> : null}
      <main className="official-doc-content">
        {paragraphs.map((text, index) => (
          <p key={index} className={`official-doc-text${/^\s*[-–—•]\s*/.test(text) ? ' official-doc-list' : ''}`}>
            {text}
          </p>
        ))}
        {images.length ? (
          <section className={`official-doc-images official-doc-images--${images.length === 1 ? 'one' : 'many'}`}>
            <h3>Hình ảnh đính kèm</h3>
            <div className="official-doc-image-grid">
              {images.map((url, index) => (
                <figure key={`${url}-${index}`}>
                  <img
                    src={url}
                    alt={`Hình ảnh đính kèm ${index + 1}`}
                    crossOrigin="anonymous"
                    onError={(e) => { e.currentTarget.closest('figure').style.display = 'none' }}
                  />
                </figure>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <footer className="official-doc-footer">
        <div className="official-doc-recipient">
          <em>Nơi nhận:</em>
          <br />- Lớp 10A4
          <br />- Lưu: Ban cán sự lớp
        </div>
        <div className="official-doc-signature">
          <strong>Lớp trưởng 10A4</strong>
          <br />
          <strong>Đoàn chủ tịch</strong>
          <img className="official-doc-signature-image" src="/assets/signature-pham-thanh-tung.png" alt="Chữ ký Phạm Thanh Tùng" />
          <span className="official-doc-signed-label">(Đã ký)</span>
          <b>Phạm Thanh Tùng</b>
        </div>
      </footer>
    </article>
  )
}
