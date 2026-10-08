import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader.jsx'
import { completeDiceRoll, getRoom, joinRoom, moveRoomBatch, startRoom, submitAnswer, switchRoomTurn } from '../services/gameRoomService.js'
import { ROUTES } from '../lib/routes.js'
import { mazeCell, normalizeMaze } from '../lib/maze.js'
import RouteHint from '../components/game/RouteHint.jsx'
import MazeScene from '../components/game/MazeScene.jsx'
import DiceOverlay from '../components/game/DiceOverlay.jsx'
import MobileControls from '../components/game/MobileControls.jsx'
import '../game.css'

const DELTAS = { up: [0, -1, 'n'], down: [0, 1, 's'], left: [-1, 0, 'w'], right: [1, 0, 'e'] }
const KEY_TO_DIRECTION = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' }

function answerOptions(question, answer, setAnswer) {
  if (question.type === 'multiple_choice') return <div className="answer-grid">{(question.options || []).map((option, index) => <button type="button" className={answer === String(index) ? 'answer-option selected' : 'answer-option'} key={`${option}-${index}`} onClick={() => setAnswer(String(index))}>{String.fromCharCode(65 + index)}. {option}</button>)}</div>
  return <div className="answer-grid"><button type="button" className={answer === 'true' ? 'answer-option selected' : 'answer-option'} onClick={() => setAnswer('true')}>Đúng</button><button type="button" className={answer === 'false' ? 'answer-option selected' : 'answer-option'} onClick={() => setAnswer('false')}>Sai</button></div>
}

export default function RoomPage() {
  const { code } = useParams()
  const [room, setRoom] = useState(null)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [joined, setJoined] = useState(false)
  const [quality] = useState(() => (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || (navigator.hardwareConcurrency || 4) <= 2 ? 'low' : 'high'))
  const questionStarted = useRef(Date.now())
  const roomRef = useRef(null)
  const pendingMoves = useRef(0)
  const outbox = useRef([])
  const flushing = useRef(false)
  const toastTimer = useRef(null)
  const [showHint, setShowHint] = useState(false)
  const hintShown = useRef(false)

  const applyRoom = useCallback((next) => { roomRef.current = next; setRoom(next) }, [])
  const refresh = useCallback(() => { if (pendingMoves.current > 0) return Promise.resolve(); return getRoom(code).then((next) => { if (pendingMoves.current === 0) applyRoom(next) }).catch((e) => setError(e.message)) }, [code, applyRoom])
  useEffect(() => { refresh(); const timer = setInterval(refresh, 3000); return () => clearInterval(timer) }, [refresh])
  useEffect(() => { questionStarted.current = Date.now(); setAnswer('') }, [room?.game?.question_index, room?.game?.phase])

  const currentTeam = useMemo(() => room?.teams?.[room?.game?.current_turn || 0], [room])
  const isSingleDevice = room?.settings?.single_device_mode === true
  const isLobby = room?.status === 'lobby'
  const isFinished = room?.status === 'finished' || room?.game?.phase === 'finished'
  const phase = room?.game?.phase || 'question'
  const exitCell = room?.game?.maze?.exit
  const noOneAtExit = Boolean(isFinished && exitCell && !room.teams.some((t) => Number(t.maze_x) === exitCell.x && Number(t.maze_y) === exitCell.y))
  const myTeam = room?.teams?.find((t) => t.id === room.current_user_team_id) || room?.teams?.[room?.game?.current_turn || 0]
  const hintFrom = myTeam ? { x: Number(myTeam.maze_x ?? 0), y: Number(myTeam.maze_y ?? 0) } : null

  const run = async (action) => { setBusy(true); setError(''); try { applyRoom(await action()) } catch (e) { setError(e.message) } finally { setBusy(false) } }
  const submit = async (event) => { event.preventDefault(); if (!answer) return; await run(() => submitAnswer(code, { answer, response_time_ms: Date.now() - questionStarted.current })) }
  const flush = useCallback(async () => {
    if (flushing.current) return
    flushing.current = true
    try {
      while (outbox.current.length) {
        const batch = outbox.current.splice(0)
        const serverRoom = await moveRoomBatch(code, batch)
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
    if (!game || game.phase !== 'movement' || !game.remaining_moves || current.status === 'finished') return
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
  useEffect(() => { const onKey = (event) => { const direction = KEY_TO_DIRECTION[event.key]; if (!direction || phase !== 'movement') return; event.preventDefault(); move(direction) }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [phase, move])
  const finishDice = useCallback(() => { run(() => completeDiceRoll(code)) }, [code])

  useEffect(() => {
    if (hintShown.current || !room || room.status === 'lobby' || room.status === 'finished' || !room.game?.maze || room.game.question_index !== 0) return
    hintShown.current = true
    const storageKey = `maze-hint-${room.code}`
    try { if (sessionStorage.getItem(storageKey)) return; sessionStorage.setItem(storageKey, '1') } catch { /* bỏ qua */ }
    setShowHint(true)
    setTimeout(() => setShowHint(false), 1500)
  }, [room])
  if (!room) return <div className="game-shell"><SiteHeader /><main className="container game-main"><div className="game-panel">{error || 'Đang tải phòng...'}</div></main></div>
  return <div className="game-shell maze-game-shell"><SiteHeader /><main className="container game-main"><div className="room-top"><div><p className="game-overline">Treasure Race · Dark Maze</p><h1>{room.settings?.title || 'Đua tới kho báu'}</h1></div><div className="room-code"><small>MÃ PHÒNG</small><strong>{room.code}</strong><button onClick={() => navigator.clipboard?.writeText(room.code)}>Sao chép</button></div></div>
    {isLobby && <section className="lobby-grid"><div className="game-panel"><div className="panel-title"><h2>Phòng chờ</h2><span className="live-pill">● LIVE</span></div><p className="game-muted">{isSingleDevice ? 'Một thiết bị điều khiển tất cả đội.' : 'Chia sẻ mã phòng để mọi người tham gia.'}</p><div className="team-list">{room.teams.map((team) => <div className="team-row" key={team.id}><span className={`team-token token-${team.token}`} /><strong>{team.name}</strong><small>{room.players.filter((p) => p.team_id === team.id).length} người chơi</small></div>)}</div>{room.is_host && <button className="game-button primary full" onClick={() => run(() => startRoom(code))} disabled={busy}>{busy ? 'Đang dựng mê cung...' : '▶ Bắt đầu game'}</button>}{!isSingleDevice && <button className="game-button quiet full" onClick={async () => { try { applyRoom(await joinRoom(code)); setJoined(true) } catch (e) { setError(e.message) } }}>{joined ? 'Đã tham gia' : 'Tham gia phòng'}</button>}{error && <div className="error-banner">{error}</div>}</div><div className="game-panel rules-panel"><h2>Luật mê cung</h2><div className="rule-line">Đúng <b>roll 1–6</b></div><div className="rule-line">Mỗi ô <b>-1 bước</b></div><div className="rule-line">Đụng tường <b>không mất bước</b></div><div className="rule-line">Về EXIT <b>thắng ngay</b></div></div></section>}
    {!isLobby && <section className="maze-play-layout"><div className="maze-main"><div className="maze-status-bar"><span className="maze-phase">{isFinished ? 'KẾT THÚC' : phase === 'movement' ? 'PHASE DI CHUYỂN' : phase === 'dice_roll' ? 'XÚC XẮC' : 'CÂU HỎI'}</span><strong>{isFinished ? `🏆 ${room.teams.find((team) => team.id === room.game?.winner_team_id)?.name || 'Đã xác định người thắng'}` : `Đến lượt ${currentTeam?.name || ''}`}</strong><span className="moves-counter">Remaining moves <b>{room.game?.remaining_moves || 0}</b></span></div><div className="maze-stage"><MazeScene maze={room.game?.maze} teams={room.teams} currentTeamId={currentTeam?.id} quality={quality} revealPaths={noOneAtExit} />{showHint && hintFrom && room.game?.maze && <RouteHint maze={normalizeMaze(room.game.maze)} from={hintFrom} />}{phase === 'dice_roll' && <DiceOverlay value={room.game?.dice_result} onComplete={finishDice} />}{room.movement_feedback?.collision && <div className="impact-toast">Tường chắn đường — chọn hướng khác</div>}</div>{phase === 'movement' && !isFinished && <MobileControls disabled={!room.game?.remaining_moves} onMove={move} />}{isSingleDevice && !isFinished && <div className="team-switcher" aria-label="Chọn đội đang chơi"><strong>Chọn đội:</strong>{room.teams.map((team) => <button type="button" className={team.id === currentTeam?.id ? 'team-switch-button active' : 'team-switch-button'} key={team.id} onClick={() => run(() => switchRoomTurn(code, team.id))} disabled={busy}>{team.name}</button>)}</div>}{phase === 'question' && !isFinished && room.question && <form className="question-card" onSubmit={submit}><div className="question-meta">Câu hỏi {room.game.question_index + 1} / {room.game.total_questions}</div><h2>{room.question.content}</h2>{answerOptions(room.question, answer, setAnswer)}<button className="game-button primary full" disabled={!answer || busy}>{busy ? 'Đang chấm...' : '🔒 Khóa đáp án'}</button></form>}{error && <div className="error-banner">{error}</div>}</div><aside className="score-panel game-panel"><h2>Đội thám hiểm</h2>{room.teams.map((team) => <div className={`score-row ${team.id === currentTeam?.id ? 'score-row-active' : ''}`} key={team.id}><span className={`team-token token-${team.token}`} /><div><strong>{team.name}</strong><small>Ô {team.maze_x ?? 0},{team.maze_y ?? 0} · đúng {team.correct_count}</small></div><b>{team.correct_count}</b></div>)}{noOneAtExit && room.game?.ranking?.length > 0 && <div className="finish-ranking"><h3>Về đích gần nhất (đi theo ô)</h3>{room.game.ranking.map((item, index) => { const team = room.teams.find((t) => t.id === item.team_id); return team ? <div className="finish-rank-row" key={item.team_id}><span>{index + 1}</span><strong>{team.name}</strong><b>{Number.isFinite(item.distance) ? `${item.distance} ô` : '—'}</b></div> : null })}</div>}{isFinished && <Link className="game-button quiet full" to={ROUTES.home}>🏠 Về trang chủ</Link>}</aside></section>}
  </main></div>
}
