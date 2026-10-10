import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader.jsx'
import { ROUTES } from '../lib/routes.js'
import { createRoom, listRoomQuizzes } from '../services/gameRoomService.js'
import '../game.css'
import { ArrowRight, ChevronRight, PartyPopper, Trophy } from 'lucide-react'

export default function CreateRoomPage() {
  const navigate = useNavigate()
  const [quizzes, setQuizzes] = useState([])
  const [selectedQuiz, setSelectedQuiz] = useState('')
  const [modeSelected, setModeSelected] = useState(false)
  const [selectedGameMode, setSelectedGameMode] = useState('treasure-race')
  const [form, setForm] = useState({ title: 'Phòng đua kho báu', team_count: 2, max_players_per_team: 4, board_length: 20, question_limit: '', timer_enabled: true, single_device_mode: false })
  const [status, setStatus] = useState({ loading: true, error: '' })
  const createRequestKey = useRef(null)
  useEffect(() => { listRoomQuizzes().then((items) => { setQuizzes(items); setSelectedQuiz(items[0]?.id || ''); setStatus({ loading: false, error: '' }) }).catch((error) => setStatus({ loading: false, error: error.message })) }, [])
  const currentQuiz = useMemo(() => quizzes.find((quiz) => quiz.id === selectedQuiz), [quizzes, selectedQuiz])
  const submit = async (event) => { event.preventDefault(); setStatus({ loading: true, error: '' }); try { createRequestKey.current ||= crypto.randomUUID(); const room = await createRoom({ ...form, quiz_id: selectedQuiz, game_mode: selectedGameMode, question_limit: form.question_limit || undefined }, createRequestKey.current); navigate(selectedGameMode === 'quiz_party' ? ROUTES.quizParty + '/' + room.code : ROUTES.room + '/' + room.code) } catch (error) { setStatus({ loading: false, error: error.message }) } }
  return <div className="game-shell"><SiteHeader /><main className="container game-main">
    <div className="game-breadcrumb">Tạo phòng <ChevronRight className="ico" size={14} aria-hidden="true" /> Chọn game <ChevronRight className="ico" size={14} aria-hidden="true" /> Thiết lập</div>
    <header className="game-heading"><p className="game-overline">Game mode</p><h1>{modeSelected ? 'Thiết lập phòng' : 'Chọn cách chơi'}</h1><p>Biến quiz của bạn thành một cuộc đua vui nhộn cùng bạn bè.</p></header>
    {!modeSelected ? <section className="mode-grid">
      <article className="mode-card mode-card-active">
        <div className="mode-icon"><Trophy size={38} aria-hidden="true" /></div><h2>Đua tới kho báu</h2><p>Chia đội, trả lời câu hỏi, tự tung xúc xắc và điều khiển linh vật tìm đường trong mê cung 3D.</p>
        <div className="mode-preview"><span>START</span><i /><i /><i /><b><Trophy size={26} aria-hidden="true" /></b></div>
        <button className="game-button primary" type="button" onClick={() => { setSelectedGameMode('treasure-race'); setForm((current) => ({ ...current, title: 'Phòng đua kho báu' })); setModeSelected(true) }}>Chọn game mode <ChevronRight className="ico" size={14} aria-hidden="true" /></button>
      </article>
      <article className="mode-card mode-card-active">
        <div className="mode-icon"><PartyPopper size={38} aria-hidden="true" /></div><h2>Quiz Party</h2><p>Đại chiến mini-game: hệ thống tự chọn thử thách mỗi vòng, đội trả lời ngay trên sân chơi và điểm được tính tự động.</p>
        <div className="mode-preview quiz-party-preview"><span>PARTY!</span><i /><i /><i /><b><PartyPopper size={26} aria-hidden="true" /></b></div>
        <button className="game-button primary" type="button" onClick={() => { setSelectedGameMode('quiz_party'); setForm((current) => ({ ...current, title: 'Quiz Party' })); setModeSelected(true) }}>Chọn Quiz Party <ChevronRight className="ico" size={14} aria-hidden="true" /></button>
      </article>
    </section> : <form className="room-form game-panel" onSubmit={submit}>
      <div className="form-section"><h2>Thông tin phòng</h2><label>Tên phòng<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength="80" required /></label><label>Bộ câu hỏi<select value={selectedQuiz} onChange={(e) => setSelectedQuiz(e.target.value)} required><option value="">Chọn quiz</option>{quizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}</select>{currentQuiz && <small>{currentQuiz.title} · quiz của bạn</small>}</label>{!status.loading && !quizzes.length && <div className="empty-state">Chưa có quiz phù hợp. <Link to={ROUTES.createQuiz}>+ Tạo quiz</Link></div>}</div>
      <div className="form-section"><h2>{selectedGameMode === 'quiz_party' ? 'Cấu hình Quiz Party' : 'Cấu hình cuộc đua'}</h2>{selectedGameMode === 'quiz_party' && <p className="game-muted">Mini-game được hệ thống chọn ngẫu nhiên. Tên đội và trang phục linh vật ở chế độ một máy chỉ được lưu tạm trong tab trình duyệt, không ghi vào database.</p>}<div className="form-grid"><label>Số đội<select value={form.team_count} onChange={(e) => setForm({ ...form, team_count: Number(e.target.value) })}>{[2,3,4,5,6,7,8].map((n) => <option key={n}>{n}</option>)}</select></label><label>Người tối đa / đội<select value={form.max_players_per_team} onChange={(e) => setForm({ ...form, max_players_per_team: Number(e.target.value) })}>{[1,2,3,4,5,6,8,10,12].map((n) => <option key={n}>{n}</option>)}</select></label>{selectedGameMode === 'treasure-race' && <label>Độ dài board<select value={form.board_length} onChange={(e) => setForm({ ...form, board_length: Number(e.target.value) })}>{[10,20,30,40,50].map((n) => <option key={n} value={n}>{n} ô</option>)}</select></label>}<label>Số câu hỏi<input type="number" min="1" max={currentQuiz?.question_count || 100} placeholder="Toàn bộ quiz" value={form.question_limit} onChange={(e) => setForm({ ...form, question_limit: e.target.value })} /></label></div><label className="toggle-label"><input type="checkbox" checked={form.timer_enabled} onChange={(e) => setForm({ ...form, timer_enabled: e.target.checked })} /><span />Bật timer · đúng nhanh +3, đúng chậm +2, sai -1</label><label className="toggle-label single-device-toggle"><input type="checkbox" checked={form.single_device_mode} onChange={(e) => setForm({ ...form, single_device_mode: e.target.checked })} /><span /><strong>Chế độ 1 máy điều khiển</strong><small>Một thiết bị hiển thị và điều khiển tất cả đội.</small></label></div>
      {status.error && <div className="error-banner">{status.error}</div>}<div className="form-actions"><button type="button" className="game-button quiet" onClick={() => setModeSelected(false)}>Chọn game khác</button><button className="game-button primary" disabled={status.loading || !selectedQuiz}>{status.loading ? 'Đang tạo...' : <>Tạo phòng <ArrowRight className="ico" size={16} aria-hidden="true" /></>}</button></div>
    </form>}
  </main></div>
}
