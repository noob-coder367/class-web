import './ClassroomShareCard.css'

function dateVN(value) {
  if (!value) return '—'
  const parts = String(value).split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(value)
}
function rulesItems(rules) {
  return (rules?.sections || []).flatMap((section) => (section.items || []).map((item) => ({
    section: section.title,
    text: typeof item === 'string' ? item : item.text || item.title || item.name || '',
    points: Number(item?.points || item?.deduction || 0),
  })))
}
function Table({ headers, rows }) {
  return <table className="classroom-share-table"><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell || '—'}</td>)}</tr>)}</tbody></table>
}
function Timetable({ data }) {
  const days = data?.days || []
  const sessions = [data?.morning, data?.afternoon].filter(Boolean)
  const rows = sessions.flatMap((session) => (session.periods || []).map((period) => [
    `${session.label || ''} · Tiết ${period.id}\n${period.start || ''}–${period.end || ''}`,
    ...days.map((day) => session.grid?.[day.id]?.[period.id - 1] || '—'),
  ]))
  return <>
    <p className="classroom-share-subtitle">Áp dụng từ ngày {dateVN(data?.from)} đến ngày {dateVN(data?.to)}</p>
    {data?.changes?.length ? <section className="classroom-share-change"><strong>Ghi nhận thay đổi:</strong><ul>{data.changes.map((x, i) => <li key={i}>{x}</li>)}</ul></section> : null}
    <Table headers={['Buổi / tiết', ...days.map((d) => d.label || d.name || d.id)]} rows={rows} />
  </>
}
function Rules({ data }) {
  const items = rulesItems(data?.rules)
  return <>
    <p className="classroom-share-subtitle">Tổng cộng {items.length} nội dung nội quy</p>
    <Table headers={['Mục', 'Nội dung', 'Điểm trừ']} rows={items.map((x) => [x.section, x.text, x.points ? `−${x.points}đ` : '—'])} />
  </>
}
function Violations({ data }) {
  return <>
    <p className="classroom-share-subtitle">Từ ngày {dateVN(data?.from)} đến ngày {dateVN(data?.to)} · {data?.violations?.length || 0} lượt vi phạm</p>
    <Table headers={['Ngày', 'Học sinh', 'Nội dung', 'Tiết', 'Điểm']} rows={(data?.violations || []).map((x) => [dateVN(x.date), x.name || x.username, x.offense || x.reason, x.period, x.points ? `−${x.points}đ` : '—'])} />
    {(data?.violations || []).flatMap((x) => x.photos || x.images || []).map((url, i) => <img className="classroom-share-photo" src={url} alt={`Ảnh vi phạm ${i + 1}`} key={`${url}-${i}`} />)}
  </>
}
function Rank({ data }) {
  return <>
    <p className="classroom-share-subtitle">Bảng xếp hạng uy tín · {data?.rows?.length || 0} thành viên</p>
    <Table headers={['Top', 'Họ và tên', 'Điểm', 'Tình trạng', 'Vi phạm']} rows={(data?.rows || []).map((x) => [x.rank, x.username, `${x.score}đ`, x.status?.label || x.status || '—', x.violations || 0])} />
  </>
}
function Cleaning({ data }) {
  const days = data?.days || []
  return <>
    <p className="classroom-share-subtitle">{data?.rangeLabel || ''}</p>
    <Table headers={['Ngày/Thứ', 'Học sinh trực', 'Ghi chú', 'Đánh giá']} rows={days.map((x) => [x.label, (x.assignees || []).join(', '), x.note, x.rating ? `${x.rating}/5 sao` : 'Chưa đánh giá'])} />
  </>
}
export default function ClassroomShareCard({ type, number = 1, data = {} }) {
  const config = {
    timetable: ['THỜI KHÓA BIỂU', 'TKB-CĐ10A4', Timetable],
    rules: ['BÁO CÁO NỘI QUY', 'NQL-NQ-CĐ10A4', Rules],
    violations: ['BÁO CÁO DANH SÁCH VI PHẠM', 'NQL-DSVP-CĐ10A4', Violations],
    rank: ['BÁO CÁO BẢNG XẾP HẠNG', 'NQL-BXH-CĐ10A4', Rank],
    cleaning: ['BÁO CÁO VỆ SINH LỚP', 'VSC-CĐ10A4', Cleaning],
  }[type] || ['BÁO CÁO LỚP', 'CĐ10A4', Rules]
  const Body = config[2]
  return <article className="classroom-share-card">
    <header className="classroom-share-header">
      <div>Ban cán sự 10A4<br />Chi đoàn 10A4<br /><strong>ĐOÀN TRƯỜNG THPT NGUYỄN HỮU HUÂN</strong></div>
      <div><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br /><strong>Độc lập - Tự do - Hạnh phúc</strong></div>
    </header>
    <div className="classroom-share-meta"><span>Số: {number}/{config[1]}</span><span>TP. Hồ Chí Minh, ngày {new Date().getDate()} tháng {String(new Date().getMonth() + 1).padStart(2, '0')} năm {new Date().getFullYear()}</span></div>
    <h1>{config[0]}</h1>
    <main><Body data={data} /></main>
    <footer><div><em>Nơi nhận:</em><br />- Lớp 10A4<br />- Lưu: Ban cán sự lớp</div><div className="classroom-share-sign"><strong>Lớp trưởng 10A4</strong><br /><strong>Đoàn chủ tịch</strong><img src="/assets/signature-pham-thanh-tung.png" alt="Chữ ký Phạm Thanh Tùng" /><span>(Đã ký)</span><br /><strong>Phạm Thanh Tùng</strong></div></footer>
  </article>
}
