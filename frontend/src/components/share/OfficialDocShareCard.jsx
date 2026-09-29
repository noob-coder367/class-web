import './OfficialDocShareCard.css'

const CODE_BY_POST = {
  main: 'TBC',
  important: 'BTVN',
  discipline: 'NQL',
}

function formatVNDate(value) {
  const date = new Date(value || Date.now())
  if (Number.isNaN(date.getTime())) return 'TP. Hồ Chí Minh, ngày -- tháng -- năm ----'
  return `TP. Hồ Chí Minh, ngày ${String(date.getDate()).padStart(2, '0')} tháng ${String(date.getMonth() + 1).padStart(2, '0')} năm ${date.getFullYear()}`
}

export function documentCodeForPost(post) {
  return CODE_BY_POST[post?.section] || 'TBC'
}

export default function OfficialDocShareCard({ post }) {
  const code = documentCodeForPost(post)
  const kind = post?.document_kind === 'bao_cao' ? 'BÁO CÁO' : 'THÔNG BÁO'
  const shortId = Number(post?.short_id) > 0 ? post.short_id : '—'
  const images = Array.isArray(post?.images) ? post.images : []
  return (
    <article className="official-doc-card">
      <header className="official-doc-header">
        <div className="official-doc-left-head">
          <strong>Ban cán sự 10A4</strong>
          <span>Chi đoàn 10A4</span>
          <span>ĐOÀN TRƯỜNG THPT NGUYỄN HỮU HUÂN</span>
        </div>
        <div className="official-doc-right-head">
          <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong>
          <span>Độc lập – Tự do – Hạnh phúc</span>
        </div>
      </header>
      <div className="official-doc-rule" />
      <div className="official-doc-number">Số: {shortId}/{code}-CĐ10A4</div>
      <div className="official-doc-date">{formatVNDate(post?.created_at || post?.updated_at)}</div>
      <h1>{kind}</h1>
      <main className="official-doc-content">
        {post?.title ? <h2>{post.title}</h2> : null}
        {post?.content ? <p className="official-doc-text">{post.content}</p> : null}
        {images.length ? (
          <section className={`official-doc-images official-doc-images--${Math.min(images.length, 2)}`}>
            <h3>Hình ảnh đính kèm</h3>
            <div className="official-doc-image-grid">
              {images.map((url, index) => (
                <figure key={`${url}-${index}`}>
                  <img src={url} alt={`Hình ảnh đính kèm ${index + 1}`} crossOrigin="anonymous" onError={(e) => { e.currentTarget.closest('figure').style.display = 'none' }} />
                </figure>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <footer className="official-doc-footer">
        <div className="official-doc-recipient"><strong>Nơi nhận:</strong><br />- Lớp 10A4<br />- Lưu: Ban cán sự lớp</div>
        <div className="official-doc-signature"><strong>Lớp trưởng 10A4</strong><br />Đoàn chủ tịch<br /><b>Phạm Thanh Tùng</b></div>
      </footer>
    </article>
  )
}
