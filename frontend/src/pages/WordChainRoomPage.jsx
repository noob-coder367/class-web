import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Expand, Link2, RotateCcw, SkipForward, Trophy } from 'lucide-react'
import SiteHeader from '../components/SiteHeader.jsx'
import { ROUTES } from '../lib/routes.js'
import { advanceLocalWordChain, chooseLocalStartingPhrase, loadWordChainDictionary, normalizeWordChainPhrase } from '../lib/wordChain.js'
import { getWordChainRoom, skipWordChainTurn, startWordChainRoom, submitWordChainAnswer } from '../services/wordChainService.js'
import '../word-chain.css'

const LOCAL_KEY = 'noi-tu:local-room'
const requestKey = () => crypto.randomUUID()

export default function WordChainRoomPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState(null)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false)
  const inputRef = useRef(null)
  const submitRequest = useRef(null)
  const skipRequest = useRef(null)
  const pendingAction = useRef(null)
  const refreshSequence = useRef(0)
  const local = !code

  const refresh = useCallback(async (force = false) => {
    if (local) {
      const saved = sessionStorage.getItem(LOCAL_KEY)
      if (!saved) { setError('Không tìm thấy trận đang lưu trên thiết bị này.'); return }
      try { setRoom(JSON.parse(saved)) } catch { setError('Không thể khôi phục trận đã lưu.'); }
      return
    }
    if ((pendingAction.current || busy) && !force) return
    const sequence = ++refreshSequence.current
    try {
      const next = await getWordChainRoom(code)
      if (sequence !== refreshSequence.current) return
      if (pendingAction.current && next.turns_used > pendingAction.current.baseTurns) {
        if (pendingAction.current.action === 'answer') submitRequest.current = null
        if (pendingAction.current.action === 'skip') skipRequest.current = null
        pendingAction.current = null
      }
      setRoom(next); setError('')
    }
    catch (cause) { if (sequence === refreshSequence.current) setError(cause.message || 'Không thể đồng bộ phòng.'); }
  }, [busy, code, local])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => () => { refreshSequence.current += 1 }, [])
  useEffect(() => {
    if (local) return undefined
    const timer = window.setInterval(refresh, 2500)
    return () => window.clearInterval(timer)
  }, [local, refresh])
  useEffect(() => { if (room?.local) sessionStorage.setItem(LOCAL_KEY, JSON.stringify(room)) }, [room])
  // Trận 1 máy kiểm tra từ có nghĩa ngay trên trình duyệt nên cần nạp từ điển (kể cả khi tải lại trang).
  useEffect(() => { if (room?.local) loadWordChainDictionary().catch(() => setError('Không tải được từ điển tiếng Việt. Hãy kiểm tra kết nối rồi tải lại trang.')) }, [room?.local])
  useEffect(() => {
    const onFullscreen = () => setFallbackFullscreen(false)
    const onKey = (event) => { if (event.key === 'Escape') setFallbackFullscreen(false) }
    document.addEventListener('fullscreenchange', onFullscreen)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('fullscreenchange', onFullscreen); window.removeEventListener('keydown', onKey) }
  }, [])

  const teams = room?.teams || []
  const teamStats = useMemo(() => teams.map((team) => {
    const turns = (room?.history || []).filter((entry) => entry.team_id === team.id)
    return { ...team, answers: turns.filter((entry) => entry.action === 'answer').length, skips: turns.filter((entry) => entry.action === 'skip').length, remaining: Math.max(0, team.turn_quota - team.turns_used) }
  }), [room?.history, teams])
  const currentTeam = room?.local ? teams[room.current_turn] : teams.find((team) => team.is_current)
  const lastAccepted = useMemo(() => [...(room?.history || [])].reverse().find((turn) => turn.action === 'answer')?.phrase || room?.starting_phrase || '', [room?.history, room?.starting_phrase])
  const lastWord = normalizeWordChainPhrase(lastAccepted).split(' ').at(-1) || ''
  const isLobby = room?.status === 'lobby'
  const finished = room?.status === 'finished'
  const myTurn = room?.local || currentTeam?.id === room?.current_user_team_id
  const used = room?.turns_used || 0
  const remaining = Math.max(0, (room?.total_turns || 0) - used)

  const run = async (operation) => {
    if (busy) return
    if (!local) refreshSequence.current += 1
    setBusy(true); setError(''); setNotice('')
    try { setRoom(await operation()) }
    catch (cause) { setError(cause.message || 'Không thực hiện được thao tác.'); if (!local) await refresh() }
    finally { setBusy(false) }
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!answer.trim() || !myTurn || !room || finished || isLobby) return
    setBusy(true); setError(''); setNotice('')
    try {
      const key = submitRequest.current || requestKey()
      submitRequest.current = key
      if (!local && !pendingAction.current) { refreshSequence.current += 1; pendingAction.current = { action: 'answer', baseTurns: room.turns_used } }
      if (local) await loadWordChainDictionary()
      const next = local
        ? advanceLocalWordChain(room, 'answer', answer)
        : await submitWordChainAnswer(code, answer, key)
      submitRequest.current = null; pendingAction.current = null
      setRoom(next); setAnswer(''); setNotice('Đã chấp nhận lượt nối từ.');
      window.setTimeout(() => inputRef.current?.focus(), 30)
    } catch (cause) { setError(cause.message || 'Đáp án chưa hợp lệ. Sửa từ trong ô nhập rồi thử lại.'); if (!local) await refresh(true) }
    finally { setBusy(false) }
  }

  const skip = async () => {
    if (busy || !room || !myTurn || finished) return
    setBusy(true); setError(''); setNotice('')
    try {
      const key = skipRequest.current || requestKey()
      skipRequest.current = key
      if (!local && !pendingAction.current) { refreshSequence.current += 1; pendingAction.current = { action: 'skip', baseTurns: room.turns_used } }
      const next = local ? advanceLocalWordChain(room, 'skip') : await skipWordChainTurn(code, key)
      skipRequest.current = null; pendingAction.current = null
      setRoom(next)
    } catch (cause) { setError(cause.message || 'Không thể bỏ lượt.'); if (!local) await refresh(true) }
    finally { setBusy(false) }
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen()
      else setFallbackFullscreen((value) => !value)
    } catch { setFallbackFullscreen((value) => !value) }
  }

  const exit = () => {
    if (!window.confirm('Thoát khỏi trận Nối Từ? Trạng thái trận online vẫn được lưu trên máy chủ.')) return
    setFallbackFullscreen(false)
    navigate(ROUTES.wordChain)
  }

  const start = () => run(() => startWordChainRoom(code))
  const replayLocal = () => {
    if (!room?.local) return
    try {
      const starting_phrase = chooseLocalStartingPhrase(room.allowed_phrases)
      setError(''); setNotice(''); setAnswer('')
      setRoom({ ...room, status: 'playing', starting_phrase, turns_used: 0, current_turn: 0, history: [], teams: room.teams.map((team) => ({ ...team, turns_used: 0 })) })
    } catch (cause) { setError(cause.message || 'Không tìm được từ khởi đầu hợp lệ.') }
  }

  if (!room) return <div className="game-shell word-chain-shell"><SiteHeader/><main className="container game-main"><div className="game-panel">{error || 'Đang tải trận Nối Từ…'} <button type="button" onClick={refresh}>Thử đồng bộ lại</button> <Link to={ROUTES.wordChain}>Quay lại thiết lập</Link></div></main></div>

  return <div className={`game-shell word-chain-shell ${fallbackFullscreen ? 'wc-fallback-fullscreen' : ''}`}>
    {!fallbackFullscreen && <SiteHeader/>}
    <main className={`container game-main wc-room ${fallbackFullscreen ? 'wc-room-fullscreen' : ''}`}>
      <header className="wc-room-header"><div className="wc-room-brand"><Link2 aria-hidden="true"/><div><span className="game-overline">NỐI TỪ · {local ? 'MỘT MÁY' : `PHÒNG ${room.code}`}</span><h1>{room.title}</h1></div></div><div className="wc-header-actions"><span className="wc-round-pill">{finished ? 'ĐÃ KẾT THÚC' : `${used + 1} / ${room.total_turns} LƯỢT`}</span><button className="wc-icon-button" type="button" aria-label="Bật hoặc tắt toàn màn hình" title="Toàn màn hình" onClick={toggleFullscreen}><Expand size={18}/></button><button className="wc-icon-button" type="button" onClick={exit} aria-label="Thoát trận" title="Thoát trận"><ArrowLeft size={18}/></button></div></header>
      {isLobby ? <section className="wc-lobby"><div className="wc-lobby-main"><p className="game-overline">PHÒNG CHỜ</p><h2>Chuẩn bị nối chữ</h2><p>{room.source_mode === 'text' ? 'Nguồn: văn bản người tạo đã chọn' : `Chủ đề: ${room.topic || 'Kết hợp chủ đề và văn bản'}`} · {room.total_turns} lượt · {room.teams.length} đội</p>{room.code && <div className="wc-share-code"><small>MÃ PHÒNG</small><strong>{room.code}</strong><button type="button" onClick={() => navigator.clipboard?.writeText(room.code)}>Sao chép mã</button></div>}<div className="wc-team-strip">{teams.map((team,index)=><div className="wc-team-card" key={team.id}><span className={`wc-team-dot dot-${index%8}`}/><div><strong>{team.name}</strong><small>{team.players ?? 0} người · {team.turn_quota} lượt</small></div></div>)}</div>{room.is_host && <button className="game-button primary" type="button" onClick={start} disabled={busy || teams.filter((team)=>team.players>0).length<2}>{busy?'Đang bắt đầu…':'Bắt đầu trận'}</button>}{room.is_host && teams.filter((team)=>team.players>0).length<2 && <p className="wc-subtle">Cần người chơi ở ít nhất hai đội trước khi bắt đầu.</p>}</div></section>
      : <>
        <section className="wc-stage" aria-live="polite">
          {finished ? <div className="wc-finished"><span className="wc-trophy"><Trophy size={36}/></span><p className="game-overline">HẾT LƯỢT</p><h2>Trận đấu hoàn thành</h2><p>Đã dùng {used} / {room.total_turns} lượt · còn {remaining} lượt. Kết quả được tổng hợp từ trạng thái trận; không tự công bố đội thắng.</p><div className="wc-final-stats">{teamStats.map((team,index)=><div className="wc-final-stat" key={team.id}><span className={`wc-team-dot dot-${index%8}`}/><strong>{team.name}</strong><small>{team.answers} đáp án hợp lệ · {team.skips} bỏ lượt · còn {team.remaining}/{team.turn_quota}</small></div>)}</div>{room.local ? <button className="game-button primary" type="button" onClick={replayLocal}><RotateCcw size={16}/> Chơi lại</button> : <Link className="game-button primary" to={ROUTES.wordChain}><RotateCcw size={16}/> Thiết lập trận khác</Link>}</div> : <>
            <div className="wc-active-team" key={currentTeam?.id || 'sync'}><span className="wc-active-label">ĐANG ĐẾN LƯỢT</span><strong>{currentTeam?.name || 'Đang đồng bộ đội'}</strong><span>{currentTeam ? `${currentTeam.turns_used} / ${currentTeam.turn_quota} lượt đã dùng` : 'Đồng bộ trạng thái phòng…'}</span></div>
            <div className="wc-chain-board"><span className="wc-chain-label">{room.history?.some((turn) => turn.action === 'answer') ? 'CỤM TỪ CUỐI CÙNG' : 'TỪ KHỞI ĐẦU'}</span><strong>{lastAccepted || 'Mở đầu trận'}</strong><div className="wc-next-prompt">{lastWord ? <>Đội tiếp theo nối bằng <b>{lastWord}</b></> : 'Hệ thống chưa chọn được từ khởi đầu'}</div></div>
            <form className="wc-answer-form" onSubmit={submit}><label htmlFor="wc-answer">Đáp án của {currentTeam?.name || 'đội đang chơi'}</label><div className="wc-input-row"><input id="wc-answer" ref={inputRef} value={answer} onChange={(event)=>setAnswer(event.target.value)} maxLength={80} placeholder={lastWord ? `Bắt đầu bằng “${lastWord}”…` : 'Nhập từ hoặc cụm từ…'} disabled={!myTurn || busy || finished} autoComplete="off"/><button className="game-button primary" type="submit" disabled={!myTurn || busy || !answer.trim()}>{busy?'Đang kiểm tra…':<><Check size={17}/> Hoàn thành</>}</button></div></form>
            {!myTurn && <p className="wc-waiting-note">Đang chờ {currentTeam?.name || 'đội hiện tại'} gửi lượt.</p>}
            <div className="wc-action-row"><button type="button" className="wc-skip-button" onClick={skip} disabled={!myTurn || busy || finished}><SkipForward size={16}/> Bỏ lượt <span>(−1 lượt)</span></button><span className="wc-remaining">Còn <strong>{remaining}</strong> lượt trong trận</span></div>
          </>}
          {error && <div className="wc-error" role="alert">{error}</div>}{notice && <div className="wc-success" role="status">{notice}</div>}
        </section>
        {!finished && <section className="wc-scoreboard" aria-label="Lượt còn lại của từng đội"><div className="wc-scoreboard-title"><h2>Đội chơi</h2><span>{teams.length} đội</span></div><div className="wc-team-strip">{teams.map((team,index)=><div key={team.id} className={`wc-team-card ${team.id===currentTeam?.id?'is-current':''}`}><span className={`wc-team-dot dot-${index%8}`}/><div><strong>{team.name}</strong><small>{team.turns_used} / {team.turn_quota} đã dùng · còn {Math.max(0,team.turn_quota-team.turns_used)}</small></div>{team.id===currentTeam?.id && <span className="wc-turn-mark">LƯỢT</span>}</div>)}</div></section>}
        {room.history?.length > 0 && <section className="wc-history"><div className="wc-scoreboard-title"><h2>Lịch sử nối từ</h2><span>{room.history.length} thao tác</span></div><ol>{[...room.history].reverse().map((turn)=><li key={turn.id}><span className="wc-history-number">{turn.turn_number}</span><strong>{teams.find((team)=>team.id===turn.team_id)?.name || 'Đội'}</strong>{turn.action==='skip'?<em>Đã bỏ lượt</em>:<span>{turn.phrase}</span>}</li>)}</ol></section>}
      </>}
      <footer className="wc-room-footer"><span>{room.validation_mode==='strict'?'Nghiêm ngặt':room.validation_mode==='expanded'?'Mở rộng':'Tự do'} · Unicode tiếng Việt được chuẩn hóa · dấu câu/gạch nối là ranh giới âm tiết</span><button type="button" onClick={()=>navigate(ROUTES.wordChain)}>Thiết lập trận khác</button></footer>
    </main>
  </div>
}
