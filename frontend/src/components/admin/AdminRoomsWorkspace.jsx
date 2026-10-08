import { useEffect, useState } from 'react'
import * as service from '../../services/adminContentService.js'

const statusLabels = { lobby: 'Đang chờ', ordering: 'Sắp xếp', playing: 'Đang chơi', finished: 'Đã kết thúc', cancelled: 'Đã hủy' }
const formatDate = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—'

function RoomMeta({ room }) {
  return <div className="admin-room-meta">
    <span><b>Passcode</b><code>{room.code}</code></span>
    <span><b>Host</b>{room.host?.full_name || room.host?.display_name || 'Chưa đặt tên'}</span>
    <span><b>Mode</b>{room.game_mode}</span>
    <span><b>Trạng thái</b><em className="provider-badge">{statusLabels[room.status] || room.status}</em></span>
    <span><b>Người chơi</b>{room.player_count}</span>
    <span><b>Cập nhật</b>{formatDate(room.updated_at || room.created_at)}</span>
  </div>
}

function RoomActions({ room, busy, onEdit, onRemove }) {
  return <div className="account-row-actions admin-room-actions">
    <button className="button button-quiet" type="button" onClick={() => onEdit({ ...room })} disabled={busy === room.id}>Sửa</button>
    <button className="button button-danger" type="button" onClick={() => void onRemove(room)} disabled={busy === room.id}>Xóa</button>
  </div>
}

export default function AdminRoomsWorkspace({ toast }) {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [editing, setEditing] = useState(null)
  const load = async () => { setLoading(true); try { setRooms(await service.listRooms()) } catch (e) { toast.error(e.message || 'Không thể tải danh sách phòng.') } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  const save = async (event) => { event.preventDefault(); setBusy(editing.id); try { const room = await service.updateRoom(editing.id, { code: editing.code, status: editing.status, game_mode: editing.game_mode, settings: editing.settings }); setRooms((rows) => rows.map((row) => row.id === room.id ? { ...row, ...room } : row)); setEditing(null); toast.success('Đã cập nhật phòng.') } catch (e) { toast.error(e.message || 'Không thể cập nhật phòng.') } finally { setBusy('') } }
  const remove = async (room) => { if (!window.confirm(`Bạn có chắc muốn xóa phòng ${room.code}? Dữ liệu gameplay liên quan có thể bị xóa theo.`)) return; setBusy(room.id); try { await service.deleteRoom(room.id); setRooms((rows) => rows.filter((row) => row.id !== room.id)); toast.success('Đã xóa phòng.') } catch (e) { toast.error(e.message || 'Không thể xóa phòng.') } finally { setBusy('') } }
  return <>
    <header className="browser-heading"><div><p className="browser-eyebrow">Gameplay workspace</p><h1>Quản lý phòng</h1><p>Tất cả phòng đã tạo, passcode và trạng thái vận hành.</p></div><span className="browser-stat"><strong>{rooms.length}</strong><small>Phòng</small></span></header>
    <section className="browser-panel"><div className="admin-toolbar"><span className="admin-muted">Passcode được hiển thị cho quản trị viên.</span><button className="button button-quiet" type="button" onClick={() => void load()} disabled={loading}>Làm mới</button></div>
      {loading ? <div className="admin-loading">Đang tải danh sách phòng…</div> : <>
        <div className="account-table-wrap admin-desktop-only"><table className="account-table room-table"><thead><tr><th>Quiz / Passcode</th><th>Host</th><th>Mode</th><th>Trạng thái</th><th>Người chơi</th><th>Thời gian</th><th /></tr></thead><tbody>{rooms.map((room) => <tr key={room.id}><td><strong>{room.quiz?.title || 'Quiz không còn tồn tại'}</strong><span className="admin-code">Passcode: {room.code}</span></td><td><strong>{room.host?.full_name || room.host?.display_name || 'Chưa đặt tên'}</strong><span>{room.host?.email || room.host_id}</span></td><td>{room.game_mode}</td><td><span className="provider-badge">{statusLabels[room.status] || room.status}</span></td><td>{room.player_count}</td><td><span>{formatDate(room.created_at)}</span><span>Cập nhật: {formatDate(room.updated_at)}</span></td><td><RoomActions room={room} busy={busy} onEdit={setEditing} onRemove={remove} /></td></tr>)}{!rooms.length && <tr><td colSpan="7" className="account-empty">Chưa có phòng nào.</td></tr>}</tbody></table></div>
        <div className="admin-room-cards admin-mobile-only">{rooms.map((room) => <article className="admin-room-card" key={room.id}><div className="admin-room-card-head"><div><span className="admin-eyebrow">Quiz</span><h2>{room.quiz?.title || 'Quiz không còn tồn tại'}</h2></div><span className="provider-badge">{statusLabels[room.status] || room.status}</span></div><RoomMeta room={room} /><RoomActions room={room} busy={busy} onEdit={setEditing} onRemove={remove} /></article>)}{!rooms.length && <div className="account-empty">Chưa có phòng nào.</div>}</div>
      </>}
    </section>
    {editing && <div className="admin-modal-backdrop" role="presentation"><form className="admin-modal" onSubmit={(e) => void save(e)}><h2>Sửa phòng {editing.code}</h2><label>Passcode<input value={editing.code} maxLength={6} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} /></label><label>Trạng thái<select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>{Object.keys(statusLabels).map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></label><label>Game mode<input value={editing.game_mode} readOnly /></label><div className="admin-modal-actions"><button type="button" className="button button-quiet" onClick={() => setEditing(null)}>Hủy</button><button type="submit" className="button button-primary" disabled={busy === editing.id}>Lưu</button></div></form></div>}
  </>
}
