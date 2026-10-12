import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader.jsx'
import { completeDiceRoll, getRoom, joinRoom, leaveRoom, moveRoomBatch, startRoom, submitAnswer, switchRoomTurn } from '../services/gameRoomService.js'
import { ROUTES } from '../lib/routes.js'
import { gameModeByApiMode, gameDetailPath } from '../lib/gameModes.js'
import { mazeCell, normalizeMaze, shortestPath } from '../lib/maze.js'
import RouteHint from '../components/game/RouteHint.jsx'
import { playAnswerSound } from '../lib/answerSound.js'
import MazeScene from '../components/game/MazeScene.jsx'
import DiceOverlay from '../components/game/DiceOverlay.jsx'
import MobileControls from '../components/game/MobileControls.jsx'
import '../game.css'
import '../game-sequence.css'
import { Check, Circle, CircleCheck, CircleX, House, LogOut, Maximize2, Minimize2, Play, Trophy } from 'lucide-react'

const DELTAS = { up: [0, -1, 'n'], down: [0, 1, 's'], left: [-1, 0, 'w'], right: [1, 0, 'e'] }
const KEY_TO_DIRECTION = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' }

const REVEAL_MS = 900
// Hiện bản đồ lần lượt từng đội: mỗi đội hiện HINT_SHOW_MS, nghỉ HINT_GAP_MS rồi tới đội kế tiếp.
const HINT_SHOW_MS = 3000
const HINT_GAP_MS = 1000
// Hết game: bật đèn -> các ô xanh lần lượt hiện -> bảng xếp hạng.
const LIGHTS_ON_MS = 1200
const GREEN_STEP_MS = 140
const GREEN_HOLD_MS = 1500

function optionClass(selected, revealed, isRight) {
  if (revealed) {
    if (isRight) return 'answer-option is-correct-answer'
    if (selected) return 'answer-option selected'
    return 'answer-option is-dimmed'
  }
  return selected ? 'answer-option selected' : 'answer-option'
}

function answerOptions(question, answer, setAnswer, revealed) {
  const lock = Boolean(revealed)
  if (question.type === 'multiple_choice') return <div className="answer-grid">{(question.options || []).map((option, index) => <button type="button" disabled={lock} className={optionClass(answer === String(index), lock, false)} key={`${option}-${index}`} onClick={() => setAnswer(String(index))}>{String.fromCharCode(65 + index)}. {option}</button>)}</div>
  return <div className="answer-grid"><button type="button" disabled={lock} className={optionClass(answer === 'true', lock, false)} onClick={() => setAnswer('true')}>Đúng</button><button type="button" disabled={lock} className={optionClass(answer === 'false', lock, false)} onClick={() => setAnswer('false')}>Sai</button></div>
}

export default function RoomPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const shellRef = useRef(null)
  const [room, setRoom] = useState(null)
  const [answer, setAnswer] = useState('')
  const [answerSubmitting, setAnswerSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [joined, setJoined] = useState(false)
  const [quality] = useState(() => (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || (navigator.hardwareConcurrency || 4) <= 2 ? 'low' : 'high'))
  const questionStarted = useRef(Date.now())
  const answerRequestKey = useRef(null)
  const roomRef = useRef(null)
  const pendingMoves = useRef(0)
  const outbox = useRef([])
  const flushing = useRef(false)
  const toastTimer = useRef(null)
  const [reveal, setReveal] = useState(null)
  const revealing = useRef(false)
  // Danh sách bản đồ từng đội + đội đang được hiện (null = không hiện)
  const [hintSeq, setHintSeq] = useState([])
  const [hintIndex, setHintIndex] = useState(null)
  const hintShown = useRef(false)
  const [resultClosed, setResultClosed] = useState(false)
  const [introActive, setIntroActive] = useState(false)
  const introRef = useRef(false)
  const [endStage, setEndStage] = useState('playing')
  const endStarted = useRef(false)
  const [teamNames, setTeamNames] = useState([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [exitPrompt, setExitPrompt] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const applyRoom = useCallback((next) => { roomRef.current = next; setRoom(next) }, [])
  const refresh = useCallback(() => { if (pendingMoves.current > 0 || revealing.current) return Promise.resolve(); return getRoom(code).then((next) => { if (pendingMoves.current === 0) applyRoom(next) }).catch((e) => setError(e.message)) }, [code, applyRoom])
  useEffect(() => { refresh(); const timer = setInterval(refresh, 3000); return () => clearInterval(timer) }, [refresh])
  useEffect(() => { questionStarted.current = Date.now(); answerRequestKey.current = null; setAnswer('') }, [room?.game?.question_index, room?.game?.phase])

  const currentTeam = useMemo(() => room?.teams?.[room?.game?.current_turn || 0], [room])
  const isSingleDevice = room?.settings?.single_device_mode === true
  const isLobby = room?.status === 'lobby'
  const isFinished = room?.status === 'finished' || room?.game?.phase === 'finished'
  const phase = room?.game?.phase || 'question'
  const exitCell = room?.game?.maze?.exit
  const noOneAtExit = Boolean(isFinished && exitCell && !room.teams.some((t) => Number(t.maze_x) === exitCell.x && Number(t.maze_y) === exitCell.y))

  // Xếp hạng cuối game: càng ít ô còn lại tới đích càng cao; bằng nhau thì nhiều câu đúng hơn, rồi tới tổng thời gian trả lời ít hơn.
  const finalRanking = useMemo(() => {
    const maze = normalizeMaze(room?.game?.maze)
    if (!isFinished || !maze || !room?.teams) return []
    return room.teams
      .map((team) => {
        const path = shortestPath(maze, { x: Number(team.maze_x ?? 0), y: Number(team.maze_y ?? 0) }, maze.exit)
        return { team, distance: path.length ? path.length - 1 : Number.POSITIVE_INFINITY }
      })
      .sort((a, b) => a.distance - b.distance || (b.team.correct_count || 0) - (a.team.correct_count || 0) || (a.team.total_response_time || 0) - (b.team.total_response_time || 0))
  }, [room, isFinished])
  const hintItem = hintIndex !== null ? hintSeq[hintIndex] : null

  useEffect(() => {
    if (!room?.teams?.length || !isLobby || !isSingleDevice) return
    setTeamNames((current) => current.length === room.teams.length ? current : room.teams.map((team, index) => team.name || `Đội ${index + 1}`))
  }, [room?.code, room?.teams?.length, isLobby, isSingleDevice])

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === shellRef.current)
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await shellRef.current?.requestFullscreen()
    } catch { setError('Không thể bật toàn màn hình trên thiết bị này.') }
  }

  const exitRoom = async (close) => {
    setLeaving(true)
    setError('')
    try {
      await leaveRoom(code, close)
      if (close) navigate(ROUTES.home)
      else navigate(gameDetailPath(gameModeByApiMode(room.game_mode)?.id || 'treasure-race'))
    } catch (e) { setError(e.message); setLeaving(false) }
  }

  const run = async (action) => { setBusy(true); setError(''); try { applyRoom(await action()) } catch (e) { setError(e.message) } finally { setBusy(false) } }
  const switchTeam = (teamId) => run(async () => {
    const next = await switchRoomTurn(code, teamId)
    setAnswer('')
    setReveal(null)
    answerRequestKey.current = null
    questionStarted.current = Date.now()
    return next
  })
  const submit = async (event) => {
    event.preventDefault()
    const question = roomRef.current?.question
    if (!answer || !question || revealing.current) return
    revealing.current = true
    setAnswerSubmitting(true)
    setError('')
    try {
      answerRequestKey.current ||= crypto.randomUUID()
      const next = await submitAnswer(code, { answer, response_time_ms: Date.now() - questionStarted.current }, answerRequestKey.current)
      const ok = next.answer_feedback?.is_correct === true
      setReveal({ questionId: question.id, ok })
      playAnswerSound(ok ? 'correct' : 'wrong')
      await new Promise((resolve) => { setTimeout(resolve, REVEAL_MS) })
      applyRoom(next)
    } catch (e) { setError(e.message); getRoom(code).then(applyRoom).catch(() => {}) } finally { revealing.current = false; setAnswerSubmitting(false); setReveal(null) }
  }
  const flush = useCallback(async () => {
    if (flushing.current) return
    flushing.current = true
    try {
      while (outbox.current.length) {
        const batch = outbox.current.splice(0)
        const serverRoom = await moveRoomBatch(code, batch, crypto.randomUUID())
        pendingMoves.current -= batch.length
        if (pendingMoves.current === 0) applyRoom(serverRoom)
      }
    } catch (e) {
      outbox.current = []
      pendingMoves.current = 0
      setError(e.message)
      getRoom(code).then(applyRoom).catch(() => {})
    } finally { flushing.current = false }
  }, [code, applyRoom])
  // Di chuyển tức thì: tính trước ở client (optimistic), gửi server theo hàng đợi, không chờ phản hồi mới cho đi tiếp.
  const move = useCallback((direction) => {
    const current = roomRef.current
    const game = current?.game
    if (introRef.current || !game || game.phase !== 'movement' || !game.remaining_moves || current.status === 'finished') return
    const delta = DELTAS[direction]
    const maze = normalizeMaze(game.maze)
    const team = current.teams?.[game.current_turn || 0]
    if (!delta || !maze || !team) return
    const x = Number(team.maze_x ?? 0)
    const y = Number(team.maze_y ?? 0)
    const from = mazeCell(maze, x, y)
    const to = mazeCell(maze, x + delta[0], y + delta[1])
    if (!from || !to || from.walls[delta[2]]) {
      applyRoom({ ...current, movement_feedback: { collision: true, direction } })
      clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => { if (roomRef.current?.movement_feedback?.collision) applyRoom({ ...roomRef.current, movement_feedback: null }) }, 700)
      return
    }
    const nx = x + delta[0]
    const ny = y + delta[1]
    const reachedExit = maze.exit && maze.exit.x === nx && maze.exit.y === ny
    const remaining = reachedExit ? 0 : game.remaining_moves - 1
    applyRoom({ ...current, movement_feedback: null, teams: current.teams.map((t) => (t.id === team.id ? { ...t, maze_x: nx, maze_y: ny } : t)), game: { ...game, remaining_moves: remaining } })
    pendingMoves.current += 1
    outbox.current.push(direction)
    flush()
  }, [applyRoom, flush])
  useEffect(() => { const onKey = (event) => { const direction = KEY_TO_DIRECTION[event.key]; if (!direction || phase !== 'movement' || introRef.current) return; event.preventDefault(); move(direction) }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [phase, move])
  const finishDice = useCallback(() => { run(() => completeDiceRoll(code)) }, [code])

  // Lúc mới vào game: hiện bản đồ (đường tới đích) của từng đội lần lượt.
  // Đội 1 hiện trước (1,5 giây), nghỉ 1 giây rồi tới đội 2, ... Chỉ chạy 1 lần mỗi phòng.
  useEffect(() => {
    if (hintShown.current || !room || room.status === 'lobby' || room.status === 'finished' || !room.game?.maze || room.game.question_index !== 0) return
    hintShown.current = true
    const storageKey = `maze-hint-${room.code}`
    try { if (sessionStorage.getItem(storageKey)) return; sessionStorage.setItem(storageKey, '1') } catch { /* bỏ qua */ }
    const sequence = (room.teams || []).map((team) => ({ id: team.id, name: team.name, token: team.token, from: { x: Number(team.maze_x ?? 0), y: Number(team.maze_y ?? 0) } }))
    if (!sequence.length) return
    setHintSeq(sequence)
    introRef.current = true
    setIntroActive(true)
    sequence.forEach((_, index) => {
      const startAt = index * (HINT_SHOW_MS + HINT_GAP_MS)
      setTimeout(() => setHintIndex(index), startAt)
      setTimeout(() => setHintIndex((current) => (current === index ? null : current)), startAt + HINT_SHOW_MS)
    })
    setTimeout(() => { introRef.current = false; setIntroActive(false) }, (sequence.length - 1) * (HINT_SHOW_MS + HINT_GAP_MS) + HINT_SHOW_MS + 300)
  }, [room])

  // Kết thúc game (hết câu hỏi hoặc có đội về đích): bật đèn -> ô xanh lần lượt hiện -> bảng xếp hạng.
  useEffect(() => {
    if (!isFinished || endStarted.current) return
    endStarted.current = true
    const finite = finalRanking.map((item) => item.distance).filter(Number.isFinite)
    const maxSteps = finite.length ? Math.max(...finite) : 0
    setEndStage('lights')
    setTimeout(() => setEndStage('green'), LIGHTS_ON_MS)
    setTimeout(() => setEndStage('ranking'), LIGHTS_ON_MS + maxSteps * GREEN_STEP_MS + 200 + GREEN_HOLD_MS)
  }, [isFinished, finalRanking])
  if (!room) return <div className="game-shell"><SiteHeader /><main className="container game-main"><div className="game-panel">{error || 'Đang tải phòng...'}</div></main></div>
  if (room.status === 'cancelled') return <div className="game-shell"><SiteHeader /><main className="container game-main"><div className="game-panel room-closed-panel"><h1>Phòng đã đóng</h1><p>Phòng này không còn xuất hiện trong danh sách và không thể tiếp tục tham gia.</p><Link className="game-button primary" to={ROUTES.home}><House className="ico" size={16} aria-hidden="true" /> Về trang chủ</Link></div></main></div>
  return <div ref={shellRef} className="game-shell maze-game-shell"><SiteHeader /><main className="container game-main"><div className="room-top"><div><p className="game-overline">Treasure Race · Dark Maze</p><h1>{room.settings?.title || 'Đua tới kho báu'}</h1></div><div className="room-top-actions">{room.is_host && !isFinished && <button type="button" className="game-button room-exit-button" onClick={() => setExitPrompt(true)}><LogOut className="ico" size={16} aria-hidden="true" /> Thoát phòng</button>}{isSingleDevice && <button type="button" className="game-button fullscreen-button" onClick={toggleFullscreen} title={isFullscreen ? 'Thoát toàn màn hình' : 'Bật toàn màn hình'}>{isFullscreen ? <Minimize2 className="ico" size={16} aria-hidden="true" /> : <Maximize2 className="ico" size={16} aria-hidden="true" />}{isFullscreen ? 'Thoát full màn hình' : 'Bật full màn hình'}</button>}<div className="room-code"><small>MÃ PHÒNG</small><strong>{room.code}</strong><button onClick={() => navigator.clipboard?.writeText(room.code)}>Sao chép</button></div></div></div>
    {isLobby && isSingleDevice && <section className="single-device-lobby"><div className="single-device-hero"><p className="game-overline">Một thiết bị · {room.teams.length} đội</p><h2>Sẵn sàng đua tới kho báu?</h2><p>Đặt tên các nhóm trước khi bắt đầu. Một màn hình sẽ lần lượt điều khiển tất cả đội.</p><div className="single-device-steps"><span><b>01</b> Đặt tên nhóm</span><span><b>02</b> Trả lời câu hỏi</span><span><b>03</b> Về đích</span></div></div><div className="single-device-setup game-panel"><div className="panel-title"><h2>Chuẩn bị đội chơi</h2><span className="live-pill"><Circle className="ico" size={9} fill="currentColor" aria-hidden="true" /> LIVE</span></div><p className="game-muted">Tên nhóm sẽ được hiển thị trên bản đồ và bảng xếp hạng.</p><div className="single-device-team-inputs">{room.teams.map((team, index) => <label key={team.id}><span><i className={`team-token token-${team.token}`} /> ĐỘI {index + 1}</span><input value={teamNames[index] || ''} maxLength="32" onChange={(event) => setTeamNames((current) => current.map((name, item) => item === index ? event.target.value : name))} placeholder={`Tên đội ${index + 1}`} /></label>)}</div>{room.is_host && <button className="game-button primary full" onClick={() => run(() => startRoom(code, { team_names: teamNames }))} disabled={busy || teamNames.some((name) => !name.trim())}>{busy ? 'Đang dựng mê cung...' : <><Play className="ico" size={16} aria-hidden="true" /> Bắt đầu game</>}</button>}{error && <div className="error-banner">{error}</div>}</div><div className="game-panel rules-panel"><h2>Luật mê cung</h2><div className="rule-line">Đúng <b>roll 1–6</b></div><div className="rule-line">Mỗi ô <b>-1 bước</b></div><div className="rule-line">Đụng tường <b>không mất bước</b></div><div className="rule-line">Về EXIT <b>thắng ngay</b></div></div></section>}
    {isLobby && !isSingleDevice && <section className="lobby-grid"><div className="game-panel"><div className="panel-title"><h2>Phòng chờ</h2><span className="live-pill"><Circle className="ico" size={9} fill="currentColor" aria-hidden="true" /> LIVE</span></div><p className="game-muted">Chia sẻ mã phòng để mọi người tham gia.</p><div className="team-list">{room.teams.map((team) => <div className="team-row" key={team.id}><span className={`team-token token-${team.token}`} /><strong>{team.name}</strong><small>{room.players.filter((p) => p.team_id === team.id).length} người chơi</small></div>)}</div>{room.is_host && <button className="game-button primary full" onClick={() => run(() => startRoom(code))} disabled={busy}>{busy ? 'Đang dựng mê cung...' : <><Play className="ico" size={16} aria-hidden="true" /> Bắt đầu game</>}</button>}<button className="game-button quiet full" onClick={async () => { try { applyRoom(await joinRoom(code)); setJoined(true) } catch (e) { setError(e.message) } }}>{joined ? 'Đã tham gia' : 'Tham gia phòng'}</button>{error && <div className="error-banner">{error}</div>}</div><div className="game-panel rules-panel"><h2>Luật mê cung</h2><div className="rule-line">Đúng <b>roll 1–6</b></div><div className="rule-line">Mỗi ô <b>-1 bước</b></div><div className="rule-line">Đụng tường <b>không mất bước</b></div><div className="rule-line">Về EXIT <b>thắng ngay</b></div></div></section>}
    {!isLobby && <section className="maze-play-layout"><div className="maze-main"><div className="maze-status-bar"><span className="maze-phase">{isFinished ? 'KẾT THÚC' : phase === 'movement' ? 'PHASE DI CHUYỂN' : phase === 'dice_roll' ? 'XÚC XẮC' : 'CÂU HỎI'}</span><strong>{isFinished ? <><Trophy className="ico" size={16} aria-hidden="true" /> {room.teams.find((team) => team.id === room.game?.winner_team_id)?.name || 'Đã xác định người thắng'}</> : `Đến lượt ${currentTeam?.name || ''}`}</strong><span className="moves-counter">Remaining moves <b>{room.game?.remaining_moves || 0}</b></span></div><div className="maze-stage"><MazeScene maze={room.game?.maze} teams={room.teams} currentTeamId={currentTeam?.id} quality={quality} pulseTeamId={hintItem?.id ?? null} lightsOn={isFinished} revealPaths={endStage === 'green' || endStage === 'ranking'} />{hintItem && room.game?.maze && <RouteHint key={hintItem.id} maze={normalizeMaze(room.game.maze)} from={hintItem.from} teamName={hintItem.name} token={hintItem.token} order={hintIndex + 1} total={hintSeq.length} />}{phase === 'dice_roll' && <DiceOverlay value={room.game?.dice_result} onComplete={finishDice} />}{room.movement_feedback?.collision && <div className="impact-toast">Tường chắn đường — chọn hướng khác</div>}</div>{phase === 'movement' && !isFinished && !introActive && <MobileControls disabled={!room.game?.remaining_moves} onMove={move} />}{isSingleDevice && !isFinished && <div className="team-switcher" aria-label="Chọn đội đang chơi"><strong>Chọn đội:</strong>{room.teams.map((team) => <button type="button" className={team.id === currentTeam?.id ? 'team-switch-button active' : 'team-switch-button'} key={team.id} onClick={() => switchTeam(team.id)} disabled={busy}>{team.name}</button>)}</div>}{phase === 'question' && !isFinished && !introActive && room.question && <form className="question-card" onSubmit={submit}><div className="question-meta">Câu hỏi {room.game.question_index + 1} / {room.game.total_questions}</div><h2>{room.question.content}</h2>{answerOptions(room.question, answer, setAnswer, reveal)}{reveal ? <div className={reveal.ok ? 'answer-result ok' : 'answer-result bad'}><strong>{reveal.ok ? <><CircleCheck className="ico" size={16} aria-hidden="true" /> Chính xác!</> : <><CircleX className="ico" size={16} aria-hidden="true" /> Chưa đúng</>}</strong>{room.question.explanation ? <p>{room.question.explanation}</p> : null}</div> : null}<button className="game-button primary full answer-submit-button" aria-busy={answerSubmitting} disabled={!answer || answerSubmitting || Boolean(reveal)}>{answerSubmitting ? <><span className="answer-energy-loader" aria-hidden="true"><i /><i /><i /></span> Đang nạp năng lượng…</> : reveal ? 'Đã kiểm tra' : <><Check className="ico" size={16} aria-hidden="true" /> Kiểm tra đáp án</>}</button>{isSingleDevice && <div className="answer-team-switch"><strong>Không biết? Đổi đội</strong><span>Chuyển câu hỏi này cho đội khác trả lời.</span><div>{room.teams.filter((team) => team.id !== currentTeam?.id).map((team) => <button type="button" className="team-switch-button" key={team.id} onClick={() => switchTeam(team.id)} disabled={busy || answerSubmitting || Boolean(reveal)}><span className={`team-token token-${team.token}`} /> {team.name}</button>)}</div></div>}</form>}{error && <div className="error-banner">{error}</div>}</div><aside className="score-panel game-panel"><h2>Đội thám hiểm</h2>{room.teams.map((team) => <div className={`score-row ${team.id === currentTeam?.id ? 'score-row-active' : ''}`} key={team.id}><span className={`team-token token-${team.token}`} /><div><strong>{team.name}</strong><small>Ô {team.maze_x ?? 0},{team.maze_y ?? 0} · đúng {team.correct_count}</small></div><b>{team.correct_count}</b></div>)}{noOneAtExit && endStage === 'ranking' && room.game?.ranking?.length > 0 && <div className="finish-ranking"><h3>Về đích gần nhất (đi theo ô)</h3>{room.game.ranking.map((item, index) => { const team = room.teams.find((t) => t.id === item.team_id); return team ? <div className="finish-rank-row" key={item.team_id}><span>{index + 1}</span><strong>{team.name}</strong><b>{Number.isFinite(item.distance) ? `${item.distance} ô` : '—'}</b></div> : null })}</div>}{isFinished && <Link className="game-button quiet full" to={ROUTES.home}><House className="ico" size={16} aria-hidden="true" /> Về trang chủ</Link>}</aside></section>}
    {exitPrompt && <div className="room-exit-backdrop" role="dialog" aria-modal="true" aria-label="Xác nhận rời phòng"><div className="room-exit-modal"><h2>Chủ phòng đang rời đi</h2><p>Phòng chưa kết thúc. Bạn có muốn đóng phòng không?</p><div className="room-exit-actions"><button className="game-button quiet" type="button" onClick={() => void exitRoom(false)} disabled={leaving}>Không, để phòng tiếp tục</button><button className="game-button primary" type="button" onClick={() => void exitRoom(true)} disabled={leaving}>{leaving ? 'Đang xử lý…' : 'Có, đóng phòng'}</button></div><small>Nếu chọn không, phòng công khai vẫn hiện để người khác vào chơi; phòng riêng tư chỉ còn ở trang chi tiết của bạn.</small></div></div>}
    {isFinished && endStage === 'ranking' && !resultClosed && finalRanking.length > 0 && <div className="result-backdrop" role="dialog" aria-modal="true" aria-label="Kết quả cuộc đua"><div className="result-modal"><h2><Trophy className="ico" size={24} aria-hidden="true" /> Kết thúc!</h2><p className="result-sub">{noOneAtExit ? 'Hết câu hỏi mà chưa đội nào về đích — xếp hạng theo số ô còn lại tới đích.' : `${room.teams.find((team) => team.id === room.game?.winner_team_id)?.name || finalRanking[0].team.name} đã về đích!`}</p><div className="result-list">{finalRanking.map((item, index) => <div className={index === 0 ? 'result-row is-first' : 'result-row'} key={item.team.id}><span className="result-rank">{index + 1}</span><span className={`team-token token-${item.team.token}`} /><strong className="result-name">{item.team.name}</strong><span className={item.distance === 0 ? 'result-left done' : 'result-left'}>{item.distance === 0 ? 'Đã về đích' : Number.isFinite(item.distance) ? `Còn ${item.distance} ô` : '—'}</span></div>)}</div><div className="result-actions"><button type="button" className="game-button quiet" onClick={() => setResultClosed(true)}>Xem mê cung</button><Link className="game-button primary" to={ROUTES.home}><House className="ico" size={16} aria-hidden="true" /> Về trang chủ</Link></div></div></div>}
  </main></div>
}
