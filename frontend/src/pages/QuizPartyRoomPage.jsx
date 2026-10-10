import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Clock3, Crown, PartyPopper, Play, RotateCw, ShieldCheck, Shirt, Sparkles, Trophy, X } from 'lucide-react'
import SiteHeader from '../components/SiteHeader.jsx'
import PetMascot, { PET_CATEGORIES } from '../components/pet/PetMascot.jsx'
import { getRoom, joinRoom, startRoom, submitAnswer } from '../services/gameRoomService.js'
import { ROUTES } from '../lib/routes.js'
import { QUIZ_PARTY_MINIGAMES } from '../lib/quizPartyMinigames.js'
import '../quiz-party.css'

const EMPTY_OUTFIT = Object.freeze({ hat: null, acc: null, shirt: null })
const CATEGORY_ICONS = { hat: Crown, acc: Sparkles, shirt: Shirt }
const TOKEN_COLORS = ['blue', 'green', 'purple', 'orange', 'pink', 'cyan', 'red', 'gold']
const TEAM_COLOR_HEX = { blue: '#76a9ff', green: '#62e6ab', purple: '#bd9cff', orange: '#ffb86e', pink: '#ff91be', cyan: '#72e5f3', red: '#ff7c88', gold: '#ffd56d' }

function storageKey(code) { return `quiz-party-session:${String(code || '').toUpperCase()}` }
function readSession(code) {
  try {
    const raw = sessionStorage.getItem(storageKey(code))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function writeSession(code, drafts) {
  try {
    sessionStorage.setItem(storageKey(code), JSON.stringify(drafts.map(({ id, name, outfit }) => ({ id, name, outfit }))))
  } catch { /* Private browsing can disable storage; in-memory play still works. */ }
}
function makeDrafts(teams, stored = []) {
  return teams.map((team, index) => {
    const previous = stored.find((item) => item.id === team.id)
    return {
      id: team.id,
      name: String(previous?.name || team.name || `Đội ${index + 1}`).slice(0, 28),
      outfit: { ...EMPTY_OUTFIT, ...(previous?.outfit || {}) },
    }
  })
}
function shuffleSafeSeededNames(teams, drafts) {
  return teams.map((team) => {
    const draft = drafts.find((item) => item.id === team.id)
    return { ...team, name: draft?.name || team.name, outfit: draft?.outfit || EMPTY_OUTFIT }
  })
}

function TeamSetup({ room, drafts, setDrafts, onStart, starting, error }) {
  const [selectedId, setSelectedId] = useState(room.teams[0]?.id || '')
  const [category, setCategory] = useState('hat')
  const current = drafts.find((team) => team.id === selectedId) || drafts[0]
  const categoryData = PET_CATEGORIES.find((item) => item.key === category)
  const update = (teamId, patch) => setDrafts((currentDrafts) => currentDrafts.map((team) => team.id === teamId ? { ...team, ...patch } : team))
  const outfit = current?.outfit || EMPTY_OUTFIT
  return (
    <section className="qp-setup-layout">
      <header className="qp-setup-heading">
        <span className="qp-kicker"><Sparkles size={14} /> ĐỘI HÌNH CỦA BẠN</span>
        <h1>Chọn linh vật, <span>vào cuộc chơi!</span></h1>
        <p>Mỗi đội có một linh vật riêng. Đặt tên và phối đồ trước khi bắt đầu.</p>
      </header>
      <div className="qp-team-roster" style={{ '--qp-team-count': room.teams.length }}>
        {drafts.map((team, index) => (
          <article className={team.id === current?.id ? 'qp-roster-card selected' : 'qp-roster-card'} key={team.id} style={{ '--team-color': TEAM_COLOR_HEX[room.teams.find((row) => row.id === team.id)?.token] || TEAM_COLOR_HEX[TOKEN_COLORS[index % TOKEN_COLORS.length]] }}>
            <button type="button" className="qp-roster-select" onClick={() => setSelectedId(team.id)} aria-pressed={team.id === current?.id}>
              <span className="qp-team-number">ĐỘI {index + 1}</span>
              <PetMascot outfit={team.outfit} size={118} label={team.name} />
              <strong>{team.name || `Đội ${index + 1}`}</strong>
              <span className="qp-edit-hint">{team.id === current?.id ? 'Đang chỉnh sửa' : 'Chạm để tùy chỉnh'}</span>
            </button>
            <label className="qp-name-label">Tên linh vật
              <input value={team.name} maxLength={28} onChange={(event) => update(team.id, { name: event.target.value })} placeholder={`Đội ${index + 1}`} />
            </label>
          </article>
        ))}
      </div>
      {current && (
        <section className="qp-outfit-editor" aria-label="Tùy chỉnh trang phục linh vật">
          <div className="qp-editor-preview"><PetMascot outfit={outfit} size={162} label={current.name} /><div><span className="qp-kicker">LINH VẬT ĐANG CHỌN</span><h2>{current.name || 'Chưa đặt tên'}</h2><p>Trang phục sẽ chỉ tồn tại trong phiên chơi này.</p></div></div>
          <div className="qp-category-tabs" role="tablist">
            {PET_CATEGORIES.map((item) => {
              const Icon = CATEGORY_ICONS[item.key]
              return <button key={item.key} type="button" role="tab" aria-selected={category === item.key} className={category === item.key ? 'active' : ''} onClick={() => setCategory(item.key)}><Icon size={18} />{item.label}</button>
            })}
          </div>
          <div className="qp-outfit-grid">
            <button type="button" className={!outfit[category] ? 'qp-outfit-item active' : 'qp-outfit-item'} onClick={() => update(current.id, { outfit: { ...outfit, [category]: null } })}><PetMascot ghost size={64} viewBox={categoryData.crop} outfit={{ [category]: null }} /><span>Không dùng</span>{!outfit[category] && <Check size={14} />}</button>
            {categoryData.items.map((item) => (
              <button key={item.id} type="button" title={item.name} className={outfit[category] === item.id ? 'qp-outfit-item active' : 'qp-outfit-item'} onClick={() => update(current.id, { outfit: { ...outfit, [category]: item.id } })}>
                <PetMascot ghost size={64} viewBox={categoryData.crop} outfit={{ [category]: item.id }} label={item.name} />
                <span>{item.name}</span>{outfit[category] === item.id && <Check size={14} />}
              </button>
            ))}
          </div>
        </section>
      )}
      {error && <p className="qp-error" role="alert">{error}</p>}
      <div className="qp-setup-footer"><p><ShieldCheck size={16} /> Tên và trang phục chỉ lưu tạm trong tab này, không ghi vào database.</p><button className="qp-primary-button" type="button" onClick={onStart} disabled={starting}>{starting ? 'Đang chuẩn bị sân chơi…' : <>Bắt đầu Quiz Party <Play size={17} fill="currentColor" /></>}</button></div>
    </section>
  )
}

function QuizQuestion({ question, minigame, disabled, onAnswer, memoryVisible, teamColor, answerResult }) {
  const [essay, setEssay] = useState('')
  useEffect(() => setEssay(''), [question?.id])
  if (!question) return <div className="qp-question-loading">Đang chuẩn bị câu hỏi tiếp theo…</div>
  const onPick = (answer) => { if (!disabled) onAnswer(answer) }
  if (question.type === 'essay') {
    return <form className="qp-essay-form" onSubmit={(event) => { event.preventDefault(); onPick(essay.trim()) }}>
      <label htmlFor="qp-essay-answer">Câu trả lời của đội</label>
      <input id="qp-essay-answer" value={essay} onChange={(event) => setEssay(event.target.value)} placeholder="Nhập câu trả lời…" disabled={disabled} />
      <button type="submit" disabled={disabled || !essay.trim()}>Gửi đáp án <ArrowRight size={16} /></button>
    </form>
  }
  const answers = question.type === 'multiple_choice'
    ? (question.options || []).map((label, index) => ({ label, answer: String(index), letter: String.fromCharCode(65 + index) }))
    : [{ label: 'Đúng', answer: 'true', letter: '✓' }, { label: 'Sai', answer: 'false', letter: '×' }]
  return (
    <div className={`qp-answer-grid minigame-${minigame.id}`} style={{ '--team-color': teamColor }}>
      {answers.map((option, index) => (
        <button type="button" key={`${question.id}-${option.answer}`} className={"qp-answer-tile tile-" + (index % 4) + (answerResult && String(answerResult.answer) === option.answer ? (answerResult.correct ? " is-correct-choice" : " is-wrong-choice") : "")} disabled={disabled} onClick={() => onPick(option.answer)}>
          <span className="qp-answer-letter">{option.letter}</span>
          <span className={minigame.id === 'memory-tiles' && !memoryVisible ? 'qp-answer-label is-hidden' : 'qp-answer-label'}>{option.label}</span>
          {minigame.id === 'safe-island' && <span className="qp-island-ripple" />}
        </button>
      ))}
    </div>
  )
}

export default function QuizPartyRoomPage() {
  const { code } = useParams()
  const [room, setRoom] = useState(null)
  const [drafts, setDraftsState] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [answerPending, setAnswerPending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const questionStartedAt = useRef(Date.now())
  const transitionTimer = useRef(null)
  const requestRef = useRef(null)
  const transitionLock = useRef(false)

  const setDrafts = useCallback((updater) => {
    setDraftsState(updater)
  }, [])
  useEffect(() => {
    if (code && drafts.length) writeSession(code, drafts)
  }, [code, drafts])

  const refresh = useCallback(async (quiet = false) => {
    try {
      const next = await getRoom(code)
      setRoom(next)
      setError('')
      return next
    } catch (e) {
      if (!quiet) setError(e.message || 'Không tải được phòng chơi.')
      return null
    } finally {
      setLoading(false)
    }
  }, [code])

  useEffect(() => {
    let active = true
    getRoom(code).then((next) => {
      if (!active) return
      setRoom(next)
      setDraftsState(makeDrafts(next.teams || [], readSession(code) || []))
      setError('')
    }).catch((e) => { if (active) setError(e.message || 'Không tải được phòng chơi.') })
      .finally(() => { if (active) setLoading(false) })
    return () => {
      active = false
      if (transitionTimer.current) clearTimeout(transitionTimer.current)
    }
  }, [code])

  const singleDevice = room?.settings?.single_device_mode === true
  useEffect(() => {
    if (!room || singleDevice || room.status !== 'playing') return undefined
    const timer = setInterval(() => {
      if (!transitionLock.current && !answerPending) void refresh(true)
    }, 2500)
    return () => clearInterval(timer)
  }, [room?.code, room?.status, singleDevice, answerPending, refresh])

  const activeMinigame = useMemo(() => {
    const id = room?.game?.maze?.minigame_schedule?.[room?.game?.question_index] || QUIZ_PARTY_MINIGAMES[0].id
    return QUIZ_PARTY_MINIGAMES.find((item) => item.id === id) || QUIZ_PARTY_MINIGAMES[0]
  }, [room?.game?.maze, room?.game?.question_index])
  const activeTeam = room?.teams?.[room?.game?.current_turn || 0]
  const displayTeams = useMemo(() => shuffleSafeSeededNames(room?.teams || [], drafts), [room?.teams, drafts])
  const ranking = useMemo(() => {
    const rows = room?.game?.ranking || []
    return [...rows].sort((a, b) => (a.rank || 999) - (b.rank || 999))
  }, [room?.game?.ranking])
  const isLobby = room?.status === 'lobby'
  const isFinished = room?.status === 'finished' || room?.game?.status === 'finished'
  const activeTurn = (room?.game?.question_index || 0) + 1
  const totalTurns = room?.game?.total_questions || 0
  const teamColor = TEAM_COLOR_HEX[activeTeam?.token] || '#8f7bff'
  const totalCorrect = (room?.teams || []).reduce((total, team) => total + (Number(team.correct_count) || 0), 0)
  const totalWrong = (room?.teams || []).reduce((total, team) => total + (Number(team.wrong_count) || 0), 0)
  const bossHealth = Math.max(8, Math.min(100, 100 - totalCorrect * 8 + totalWrong * 3))
  const draftList = drafts.length ? drafts : makeDrafts(room?.teams || [])

  useEffect(() => {
    if (activeMinigame.id !== 'memory-tiles' || !room || room.status !== 'playing' || result) return undefined
    const id = setTimeout(() => setMemoryVisible(false), 2400)
    setMemoryVisible(true)
    return () => clearTimeout(id)
  }, [activeMinigame.id, room?.game?.question_index, room?.status, result])
  const [memoryVisible, setMemoryVisible] = useState(true)

  const begin = async () => {
    if (starting) return
    setStarting(true)
    setError('')
    writeSession(code, draftList)
    try {
      const next = await startRoom(code)
      setRoom(next)
      questionStartedAt.current = Date.now()
    } catch (e) {
      setError(e.message || 'Không thể bắt đầu Quiz Party.')
    } finally { setStarting(false) }
  }

  const submit = async (answer) => {
    if (!room?.question || answerPending || transitionLock.current || isFinished) return
    setAnswerPending(true)
    setError('')
    transitionLock.current = true
    const requestId = crypto.randomUUID()
    requestRef.current = requestId
    const elapsed = Math.max(0, Math.min(120000, Date.now() - questionStartedAt.current))
    try {
      const next = await submitAnswer(code, { answer, response_time_ms: elapsed }, requestId)
      if (requestRef.current !== requestId) return
      const correct = next.answer_feedback?.is_correct === true
      setResult({ correct, answer, nextRoom: next })
      // Hold the color flash briefly, darken the complete stage, then reveal the next round.
      transitionTimer.current = setTimeout(() => {
        setRoom(next)
        setResult(null)
        setAnswerPending(false)
        transitionLock.current = false
        questionStartedAt.current = Date.now()
        setMemoryVisible(true)
      }, 900)
    } catch (e) {
      transitionLock.current = false
      setAnswerPending(false)
      setError(e.message || 'Không gửi được đáp án. Vui lòng thử lại.')
    }
  }

  const join = async () => {
    try { const next = await joinRoom(code); setRoom(next); setError('') }
    catch (e) { setError(e.message || 'Không thể tham gia phòng.') }
  }

  if (loading) return <div className="game-shell quiz-party-shell"><SiteHeader /><main className="container game-main"><div className="qp-loading"><PartyPopper size={26} /> Đang chuẩn bị Quiz Party…</div></main></div>
  if (!room) return <div className="game-shell quiz-party-shell"><SiteHeader /><main className="container game-main"><p className="qp-error">{error || 'Không tìm thấy phòng.'}</p><Link className="qp-secondary-button" to={ROUTES.play}><ArrowLeft size={16} /> Quay lại chọn game</Link></main></div>

  const host = room.is_host === true
  const answerLocked = answerPending || Boolean(result)
  const winningTeam = room.teams.find((team) => team.id === room.game?.winner_team_id)
  const stageTheme = `quiz-party-shell theme-${activeMinigame.accent}`

  return (
    <div className={stageTheme}>
      <SiteHeader />
      <main className="container game-main qp-main">
        <header className="qp-topbar">
          <Link className="qp-back-link" to={ROUTES.play}><ArrowLeft size={16} /> Chọn game khác</Link>
          <div className="qp-code"><span>PASSCODE</span><strong>{room.code}</strong><button type="button" onClick={() => navigator.clipboard?.writeText(room.code)}>Sao chép</button></div>
          <span className="qp-mode-badge"><PartyPopper size={15} /> QUIZ PARTY</span>
        </header>

        {isLobby && singleDevice && host && (
          <TeamSetup room={room} drafts={draftList} setDrafts={setDrafts} onStart={begin} starting={starting} error={error} />
        )}

        {isLobby && !(singleDevice && host) && (
          <section className="qp-lobby">
            <span className="qp-kicker"><PartyPopper size={15} /> SÂN CHƠI SẮP BẮT ĐẦU</span><h1>{room.settings?.title || 'Quiz Party'}</h1>
            <p>Hệ thống sẽ tự chọn mini-game từng vòng. Đội hiện tại trả lời ngay trên sân chơi.</p>
            <div className="qp-team-roster">
              {displayTeams.map((team, index) => <article className="qp-roster-card" key={team.id}><PetMascot outfit={team.outfit} size={110} /><strong>{team.name || `Đội ${index + 1}`}</strong><span className="qp-edit-hint">{room.players?.some((p) => p.team_id === team.id) ? 'Đã có người chơi' : 'Đang chờ người chơi'}</span></article>)}
            </div>
            {host && <button className="qp-primary-button" type="button" onClick={begin} disabled={starting}>{starting ? 'Đang chuẩn bị…' : <>Bắt đầu game <Play size={17} /></>}</button>}
            {!host && <button className="qp-primary-button" type="button" onClick={join}>Tham gia phòng <Play size={17} /></button>}
            {error && <p className="qp-error" role="alert">{error}</p>}
          </section>
        )}

        {room.status === 'playing' && !isFinished && (
          <section className={result ? 'qp-arena is-transitioning' : 'qp-arena'}>
            <header className="qp-round-top">
              <div><span className="qp-kicker">VÒNG {activeTurn} / {totalTurns}</span><h1>{activeMinigame.title}</h1><p>{activeMinigame.instruction}</p></div>
              <div className="qp-round-counter"><Clock3 size={16} /><strong>{activeTurn}<small>/{totalTurns}</small></strong></div>
            </header>
            <div className="qp-team-strip" aria-label="Các đội">
              {displayTeams.map((team, index) => <div key={team.id} className={team.id === activeTeam?.id ? 'qp-team-chip active' : 'qp-team-chip'} style={{ '--team-color': TEAM_COLOR_HEX[team.token] || TOKEN_COLORS[index] }}><PetMascot outfit={team.outfit} size={44} label={team.name} /><span>{team.name || `Đội ${index + 1}`}</span><b>{team.correct_count || 0}</b></div>)}
            </div>
            <div className="qp-stage" style={{ '--team-color': teamColor }}>
              <div className="qp-stage-decor decor-one" /><div className="qp-stage-decor decor-two" /><div className="qp-stage-decor decor-three" />
              {activeMinigame.id === 'boss-battle' && <div className="qp-boss"><span className="qp-boss-face">👾</span><div><strong>QUIZ BOSS</strong><span className="qp-boss-health"><i style={{ width: `${bossHealth}%` }} /></span></div></div>}
              {activeMinigame.id === 'obby-dash' && <div className="qp-obby-path"><span>START</span><i style={{ width: `${Math.min(92, 12 + (activeTeam?.correct_count || 0) * 8)}%` }} /><span>FINISH</span></div>}
              {activeMinigame.id === 'color-rush' && <div className="qp-color-gates" aria-hidden="true"><i /><i /><i /><i /></div>}
              <div className="qp-current-team"><span className="qp-turn-spark" /><PetMascot outfit={displayTeams.find((team) => team.id === activeTeam?.id)?.outfit || EMPTY_OUTFIT} size={76} label={activeTeam?.name || 'Đội hiện tại'} /><div><small>ĐẾN LƯỢT</small><strong>{displayTeams.find((team) => team.id === activeTeam?.id)?.name || activeTeam?.name || 'Đội hiện tại'}</strong><span>Chọn đáp án trên sân!</span></div></div>
              <article className="qp-question-panel">
                <div className="qp-question-label"><Sparkles size={15} /> CÂU HỎI THỬ THÁCH <span>#{activeTurn}</span></div>
                <h2>{room.question?.content || 'Chuẩn bị cho vòng tiếp theo…'}</h2>
                <QuizQuestion question={room.question} minigame={activeMinigame} disabled={answerLocked} onAnswer={submit} memoryVisible={memoryVisible} teamColor={teamColor} answerResult={result} />
              </article>
              {result && <div className={result.correct ? 'qp-result-flash correct' : 'qp-result-flash wrong'} role="status"><span>{result.correct ? <Check size={30} strokeWidth={4} /> : <X size={30} strokeWidth={4} />}</span><strong>{result.correct ? 'CHÍNH XÁC!' : 'CHƯA ĐÚNG!'}</strong><small>{result.correct ? '+1 điểm cho đội' : 'Lượt tiếp theo đang đến…'}</small></div>}
              {result && <div className="qp-dark-cut" aria-hidden="true" />}
              {answerPending && !result && <div className="qp-pending"><span /> Đang xác nhận đáp án…</div>}
            </div>
            {error && <p className="qp-error" role="alert">{error}</p>}
          </section>
        )}

        {isFinished && (
          <section className="qp-finale">
            <span className="qp-finale-trophy"><Trophy size={48} /></span><span className="qp-kicker">HẾT GIỜ CHƠI</span><h1>Chiến thắng thuộc về <span>{displayTeams.find((team) => team.id === winningTeam?.id)?.name || winningTeam?.name || displayTeams[0]?.name || 'đội chiến thắng'}</span>!</h1><p>Điểm và thứ hạng được xác nhận từ máy chủ.</p>
            <div className="qp-leaderboard">{(ranking.length ? ranking : [...room.teams].sort((a, b) => (b.correct_count || 0) - (a.correct_count || 0))).map((row, index) => { const team = room.teams.find((item) => item.id === (row.team_id || row.id)); const display = displayTeams.find((item) => item.id === team?.id); return <div className={index === 0 ? 'qp-rank-row winner' : 'qp-rank-row'} key={team?.id || index}><strong className="qp-rank-number">{index + 1}</strong><PetMascot outfit={display?.outfit || EMPTY_OUTFIT} size={64} label={display?.name || team?.name} /><span><b>{display?.name || team?.name || 'Đội'}</b><small>{team?.correct_count || row.correct_count || 0} câu đúng · {team?.wrong_count || row.wrong_count || 0} câu sai</small></span><strong className="qp-score">{row.score ?? team?.correct_count ?? 0} điểm</strong></div> })}</div>
            <div className="qp-finale-actions"><Link className="qp-primary-button" to={ROUTES.createRoom}><RotateCw size={17} /> Tạo phòng Quiz Party mới</Link><Link className="qp-secondary-button" to={ROUTES.play}>Về chọn game</Link></div>
          </section>
        )}
      </main>
    </div>
  )
}
