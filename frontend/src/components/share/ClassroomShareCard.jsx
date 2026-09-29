import './OfficialDocShareCard.css'

function dateVN(value) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}
function rulesItems(rules) {
  return (rules?.sections || []).flatMap((section) => (section.items || []).map((item) => ({
    section: section.title,
    text: typeof item === 'string' ? item : item.text || item.title || item.name || '',
    points: Number(item?.points || item?.deduction || 0),
  })))
}
function Table({ headers, rows }) {
  return <table className="official-doc-table"><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell || '—'}</td>)}</tr>)}</tbody></table>
}
function Timetable({ data }) {
  const days = data?.days || []
  const sessions = [data?.morning, data?.afternoon].filter(Boolean)
  const rows = sessions.flatMap((session) => (session.periods || []).map((period) => [
    `${session.label || ''} · Tiết ${period.id}\n${period.start || ''}–${period.end || ''}`,
    ...days.map((day) => session.grid?.[day.id]?.[period.id - 1] || '—'),
  ]))
  return <>
    <p className="official-doc-subtitle">Áp dụng từ ngày {dateVN(data?.from)} đến ngày {dateVN(data?.to)}</p>
    {data?.changes?.length ? <section className="official-doc-change"><strong>Ghi nhận thay đổi:</strong><ul>{data.changes.map((x, i) => <li key={i}>{x}</li>)}</ul></section> : null}
    <Table headers={['Buổi / tiết', ...days.map((d) => d.label || d.name || d.id)]} rows={rows} />
  </>
}
function Rules({ data }) {
  const items = rulesItems(data?.rules)
  return <><p className="official-doc-subtitle">Tổng cộng {items.length} nội dung nội quy</p><Table headers={['Mục', 'Nội dung', 'Điểm trừ']} rows={items.map((x) => [x.section, x.text, x.points ? `−${x.points}đ` : '—'])} /></>
}
function Violations({ data }) {
  return <><p className="official-doc-subtitle">Từ ngày {dateVN(data?.from)} đến ngày {dateVN(data?.to)} · {data?.violations?.length || 0} lượt vi phạm</p><Table headers={['Ngày', 'Học sinh', 'Nội dung', 'Tiết', 'Điểm']} rows={(data?.violations || []).map((x) => [dateVN(x.date), x.name || x.username, x.offense || x.reason, x.period, x.points ? `−${x.points}đ` : '—'])} />{(data?.violations || []).flatMap((x) => x.photos || x.images || []).map((url, i) => <img className="official-doc-classroom-photo" src={url} alt={`Ảnh vi phạm ${i + 1}`} key={`${url}-${i}`} />)}</>
}
function Cleaning({ data }) {
  return <><p className="official-doc-subtitle">{data?.rangeLabel || ''}</p><Table headers={['Ngày/Thứ', 'Học sinh trực', 'Ghi chú', 'Đánh giá']} rows={(data?.days || []).map((x) => [x.label, (x.assignees || []).join(', '), x.note, x.rating ? `${x.rating}/5 sao` : 'Chưa đánh giá'])} /></>
}

export default function ClassroomShareCard({ type, number = 1, data = {} }) {
  const config = {
    timetable: ['THỜI KHÓA BIỂU', 'TKB-CĐ10A4', Timetable],
    rules: ['BÁO CÁO NỘI QUY', 'NQL-NQ-CĐ10A4', Rules],
    violations: ['BÁO CÁO DANH SÁCH VI PHẠM', 'NQL-DSVP-CĐ10A4', Violations],
    cleaning: ['BÁO CÁO VỆ SINH LỚP', 'VSC-CĐ10A4', Cleaning],
  }[type] || ['BÁO CÁO LỚP', 'CĐ10A4', Rules]
  const Body = config[2]
  return <article className="official-doc-card official-doc-card--long official-doc-classroom-card">
    <header className="official-doc-header">
      <div className="official-doc-col official-doc-col--left"><div className="official-doc-agency-sup">Ban cán sự 10A4</div><div className="official-doc-agency">Chi đoàn 10A4</div><div className="official-doc-agency-main"><span className="official-doc-rule-text">ĐOÀN TRƯỜNG THPT NGUYỄN HỮU HUÂN</span></div></div>
      <div className="official-doc-col official-doc-col--right"><div className="official-doc-nation">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div><div className="official-doc-motto"><span className="official-doc-rule-text">Độc lập - Tự do - Hạnh phúc</span></div></div>
    </header>
    <div className="official-doc-meta"><div className="official-doc-number">Số: {number}/{config[1]}</div><div className="official-doc-date">TP. Hồ Chí Minh, ngày {new Date().getDate()} tháng {String(new Date().getMonth() + 1).padStart(2, '0')} năm {new Date().getFullYear()}</div></div>
    <h1>{config[0]}</h1>
    <main className="official-doc-content"><Body data={data} /></main>
    <footer className="official-doc-footer"><div className="official-doc-recipient"><em>Nơi nhận:</em><br />- Lớp 10A4<br />- Lưu: Ban cán sự lớp</div><div className="official-doc-signature"><strong>Lớp trưởng 10A4</strong><br /><strong>Đoàn chủ tịch</strong><img className="official-doc-signature-image" src="/assets/signature-pham-thanh-tung.png" alt="Chữ ký Phạm Thanh Tùng" /><span className="official-doc-signed-label">(Đã ký)</span><b>Phạm Thanh Tùng</b></div></footer>
  </article>
}
