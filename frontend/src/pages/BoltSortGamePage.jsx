import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Clock3, HelpCircle, RotateCcw, Sparkles, Trophy, Undo2, Volume2, VolumeX } from 'lucide-react'
import { ROUTES } from '../lib/routes.js'
import { listRoomQuizzes } from '../services/gameRoomService.js'
import { fetchQuiz } from '../services/quizService.js'
import '../bolt-sort-game.css'

const LEVELS = [
  { id: 1, name: 'Tân binh', color: '#48e878', capacity: 3, colors: 3, rods: 5, moves: 18, rounds: 8, face: '◕‿◕', tip: 'Ít bu lông, dễ quan sát và làm quen.' },
  { id: 2, name: 'Thợ máy', color: '#ffb83f', capacity: 4, colors: 4, rods: 6, moves: 26, rounds: 8, face: 'ಠ‿ಠ', tip: 'Nhiều màu hơn, cần tính trước vài bước.' },
  { id: 3, name: 'Chuyên gia', color: '#ff796e', capacity: 6, colors: 5, rods: 7, moves: 36, rounds: 10, face: 'ಠ益ಠ', tip: 'Các chồng dài, hãy tận dụng đinh trống.' },
  { id: 4, name: 'Siêu cấp', color: '#8bbdff', capacity: 8, colors: 6, rods: 8, moves: 48, rounds: 12, face: 'งಠ益ಠง', tip: 'Tối đa 8 bu lông mỗi đinh. Mỗi nước đi đều quan trọng.' },
]
const PALETTE = ['#39df53', '#ffc13c', '#ff5d68', '#32baf5', '#b86bff', '#ff8c52', '#f58dc9', '#a6d936']
const DEFAULT_QUESTIONS = [
  ['12 + 8 = ?', '20', ['18', '20', '22', '24']],
  ['Từ nào là danh từ?', 'học sinh', ['nhanh', 'học sinh', 'đẹp', 'chạy']],
  ['3 × 7 = ?', '21', ['18', '21', '24', '27']],
  ['Thủ đô Việt Nam là?', 'Hà Nội', ['Huế', 'Đà Nẵng', 'Hà Nội', 'TP.HCM']],
  ['100 − 36 = ?', '64', ['54', '64', '74', '66']],
  ['Một tuần có bao nhiêu ngày?', '7', ['5', '6', '7', '8']],
  ['Từ trái nghĩa với “cao” là?', 'thấp', ['dài', 'thấp', 'rộng', 'nhẹ']],
  ['9 + 6 = ?', '15', ['14', '15', '16', '17']],
  ['Hành tinh chúng ta đang sống?', 'Trái Đất', ['Sao Hỏa', 'Trái Đất', 'Sao Kim', 'Sao Mộc']],
  ['5 × 5 = ?', '25', ['20', '15', '25', '30']],
  ['Nước đóng băng ở khoảng bao nhiêu °C?', '0°C', ['10°C', '0°C', '100°C', '-10°C']],
  ['Từ nào viết đúng?', 'sạch sẽ', ['sạch sẻ', 'sạch xẽ', 'sạch sẽ', 'sạch sễ']],
]
const shuffle = (items) => [...items].sort(() => Math.random() - 0.5)
function makeBoard(level) {
  const colors = PALETTE.slice(0, level.colors)
  const pieces = shuffle(colors.flatMap((color) => Array(level.capacity).fill(color)))
  const stacks = Array.from({ length: level.rods }, (_, i) => i < colors.length ? pieces.slice(i * level.capacity, (i + 1) * level.capacity).map((color) => ({ color, revealed: false, id: Math.random().toString(36).slice(2) })) : [])
  return stacks
}
function isComplete(stack, capacity) { return stack.length === capacity && stack.every((bolt) => bolt.color === stack[0]?.color) }
function Bolt({ bolt, selected }) {
  return <div data-bolt-id={bolt.id} className={`bolt ${bolt.revealed ? 'bolt-revealed' : 'bolt-hidden'} ${selected ? 'bolt-selected' : ''}`} style={{ '--bolt-color': bolt.revealed ? bolt.color : '#d9e1d7' }}>
    <span className="bolt-top">{bolt.revealed ? <i /> : '?'}</span>
    <span className="bolt-body"><i /><i /><i /></span>
  </div>
}
function TeamBoard({ team, active, level, onRod, selected, moves, completed, onUndo, canUndo, onPass, timer, score, question, answered, answerQuestion, questionResult, questionIndex }) {
  return <section className={`bolt-team ${active ? 'bolt-team-active' : ''}`} style={{ '--team-color': team.color }}>
    <header className="bolt-team-head"><div className="bolt-team-identity"><span className="team-dot" /><div><small>ĐỘI {team.id}</small><h2>{team.name}</h2></div></div><div className="bolt-team-stats"><span><Trophy size={14}/> {completed} đinh</span><span><Sparkles size={14}/> {score} điểm</span></div></header>
    {active && !answered && <div className="bolt-question-panel"><div className="question-kicker"><HelpCircle size={15}/> LƯỢT CỦA ĐỘI {team.id} · CÂU {questionIndex + 1}</div><h3>{question.content}</h3><div className="bolt-answer-grid">{question.type === 'essay' ? <form className="bolt-essay-answer" onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.namedItem('essay-answer'); if (input?.value.trim()) answerQuestion(input.value.trim()) }}><input name="essay-answer" placeholder="Nhập câu trả lời..." autoComplete="off"/><button type="submit">Trả lời</button></form> : question.options.map((choice) => <button type="button" key={choice} onClick={() => answerQuestion(choice)}>{choice}</button>)}</div></div>}
    {active && answered && <div className={`bolt-turn-banner ${questionResult?.correct ? 'is-correct' : 'is-wrong'}`}><span>{questionResult?.correct ? '✓ Chính xác!' : '↻ Chưa đúng!'}</span><strong>{questionResult?.message}</strong><small><Clock3 size={13}/> {timer}s để di chuyển bu lông</small></div>}
    {!active && <div className="bolt-wait-banner">Đang chờ lượt đối thủ <span>•••</span></div>}
    <div className="bolt-board" style={{ '--capacity': level.capacity }}>
      {team.stacks.map((stack, index) => <button type="button" data-rod-index={index} className={`bolt-rod ${selected === index ? 'rod-selected' : ''} ${isComplete(stack, level.capacity) ? 'rod-complete' : ''} ${stack.length === 0 ? 'rod-empty' : ''}`} key={index} onClick={() => onRod(index)} aria-label={`Đinh ${index + 1}, ${stack.length} bu lông`}>
        <span className="rod-number">{String(index + 1).padStart(2, '0')}</span><span className="rod-shaft" />
        <span className="rod-bolts">{stack.map((bolt) => <Bolt key={bolt.id} bolt={bolt} selected={selected === index && stack[stack.length - 1]?.id === bolt.id}/>)}</span><span className="rod-base" />
        {isComplete(stack, level.capacity) && <span className="rod-check"><Check size={13}/></span>}
      </button>)}
    </div>
    <footer className="bolt-team-foot"><span className="moves-left">LƯỢT DI CHUYỂN <b>{moves}</b></span><button onClick={onUndo} disabled={!canUndo || !active || !answered}><Undo2 size={15}/> Hoàn tác <small>−1 điểm</small></button><button onClick={onPass} disabled={!active || !answered}>Kết thúc lượt <ArrowRight size={15}/></button></footer>
  </section>
}
export default function BoltSortGamePage() {
  const navigate = useNavigate()
  const [screen, setScreen] = useState('setup')
  const [teamNames, setTeamNames] = useState(['Đội Sao Xanh', 'Đội Sấm Đỏ'])
  const [quizzes, setQuizzes] = useState([])
  const [selectedQuizId, setSelectedQuizId] = useState('')
  const [quizLoading, setQuizLoading] = useState(true)
  const [quizError, setQuizError] = useState('')
  const [level, setLevel] = useState(LEVELS[0])
  const [teams, setTeams] = useState([])
  const [turn, setTurn] = useState(0)
  const [moves, setMoves] = useState(0)
  const [selected, setSelected] = useState(null)
  const [timer, setTimer] = useState(60)
  const [answered, setAnswered] = useState(false)
  const [questionResult, setQuestionResult] = useState(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS)
  const [history, setHistory] = useState([])
  const [scores, setScores] = useState([0, 0])
  const [finished, setFinished] = useState(false)
  const [toast, setToast] = useState('')
  const [soundOn, setSoundOn] = useState(true)
  const [flyingBolt, setFlyingBolt] = useState(null)
  const audioRef = useRef(null)
  const flightTimerRef = useRef(null)
  const tickRef = useRef(null)
  const playSfx = (kind = 'move') => {
    if (!soundOn) return
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return
      if (!audioRef.current) audioRef.current = new AudioContextClass()
      const ctx = audioRef.current
      if (ctx.state === 'suspended') ctx.resume()
      const notes = kind === 'correct' ? [660, 880] : kind === 'wrong' ? [190, 145] : kind === 'complete' ? [523, 659, 784, 1046] : kind === 'undo' ? [430, 330] : kind === 'select' ? [480] : [360, 520]
      notes.forEach((frequency, index) => {
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()
        oscillator.type = kind === 'move' ? 'triangle' : 'sine'
        oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + index * 0.075)
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + index * 0.075)
        gain.gain.exponentialRampToValueAtTime(kind === 'complete' ? 0.12 : 0.065, ctx.currentTime + index * 0.075 + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + index * 0.075 + 0.16)
        oscillator.connect(gain); gain.connect(ctx.destination)
        oscillator.start(ctx.currentTime + index * 0.075)
        oscillator.stop(ctx.currentTime + index * 0.075 + 0.17)
      })
    } catch { /* Âm thanh không khả dụng thì game vẫn chơi bình thường. */ }
  }
  useEffect(() => () => { window.clearTimeout(flightTimerRef.current); if (audioRef.current) audioRef.current.close().catch(() => {}) }, [])
  const activeTeam = teams[turn]
  useEffect(() => { let alive = true; listRoomQuizzes().then((items) => { if (!alive) return; setQuizzes(items); setSelectedQuizId(items[0]?.id || ''); setQuizLoading(false) }).catch((error) => { if (!alive) return; setQuizError(error.message || 'Không tải được kho câu hỏi. Hãy đăng nhập và thử lại.'); setQuizLoading(false) }); return () => { alive = false } }, [])
  const completedCounts = useMemo(() => teams.map((team) => team?.stacks?.filter((stack) => isComplete(stack, level.capacity)).length || 0), [teams, level])
  useEffect(() => {
    if (!answered || finished) return undefined
    tickRef.current = window.setInterval(() => setTimer((value) => {
      if (value <= 1) { window.clearInterval(tickRef.current); setToast('Hết giờ! Lượt chuyển sang đội còn lại.'); return 0 }
      return value - 1
    }), 1000)
    return () => window.clearInterval(tickRef.current)
  }, [answered, finished, turn, questionIndex])
  useEffect(() => { if (answered && timer === 0 && !finished) { const id = window.setTimeout(() => nextTurn(), 700); return () => window.clearTimeout(id) } }, [timer, answered, finished])
  const beginGame = async (chosenLevel) => {
    if (!selectedQuizId) { setQuizError('Hãy chọn một bộ câu hỏi trong kho trước khi chơi.'); setScreen('setup'); return }
    setQuizLoading(true); setQuizError('')
    let quizQuestions
    try {
      const quiz = await fetchQuiz(selectedQuizId)
      quizQuestions = (quiz.questions || []).map((item) => {
        if (item.type === 'true_false') return { content: item.content, type: 'multiple_choice', answer: item.correct_boolean ? 'Đúng' : 'Sai', options: ['Đúng', 'Sai'] }
        if (item.type === 'essay') return { content: item.content, type: 'essay', answer: String(item.reference_answer || '').trim(), options: [] }
        const options = (item.options || []).map((option) => String(option))
        return { content: item.content, type: 'multiple_choice', options, answer: options[Number(item.correct_option)] ?? '' }
      }).filter((item) => item.content && (item.type === 'essay' ? item.answer : item.options.length >= 2 && item.answer))
      if (!quizQuestions.length) throw new Error('Bộ câu hỏi này chưa có câu hỏi hợp lệ. Hãy chọn bộ khác.')
    } catch (error) { setQuizError(error.message || 'Không tải được câu hỏi từ kho.'); setQuizLoading(false); return }
    setQuestions(shuffle(quizQuestions))
    setLevel(chosenLevel)
    setTeams([1, 2].map((id) => ({ id, name: teamNames[id - 1].trim() || `Đội ${id}`, color: id === 1 ? '#42e878' : '#ff756f', stacks: makeBoard(chosenLevel) })))
    setTurn(0); setMoves(0); setSelected(null); setTimer(60); setAnswered(false); setQuestionResult(null); setQuestionIndex(0); setHistory([]); setScores([0, 0]); setFinished(false); setToast(''); setScreen('game'); setQuizLoading(false)
  }
  const nextTurn = () => {
    if (finished) return
    if (questionIndex + 1 >= level.rounds) { setFinished(true); setScreen('result'); return }
    setQuestionIndex((index) => index + 1); setTurn((value) => 1 - value); setMoves(0); setSelected(null); setTimer(60); setAnswered(false); setQuestionResult(null); setToast('')
  }
  const answerQuestion = (choice) => {
    if (answered) return
    const question = questions[questionIndex % questions.length]
    const correct = String(choice).trim().toLocaleLowerCase('vi') === String(question.answer).trim().toLocaleLowerCase('vi')
    playSfx(correct ? 'correct' : 'wrong')
    const earned = correct ? Math.max(1, Math.floor(level.moves / level.rounds)) : 1 + Math.floor(Math.random() * 2)
    setMoves(earned); setAnswered(true); setTimer(60); setQuestionResult({ correct, message: correct ? `Bạn có ${earned} lượt di chuyển!` : `Đáp án: ${question.answer || 'hãy tiếp tục cố gắng'} · nhận ${earned} lượt ngẫu nhiên.` })
    if (correct) setScores((old) => old.map((score, index) => index === turn ? score + 2 : score))
    else setToast('Không sao! Dùng lượt ngẫu nhiên để xoay chuyển tình thế.')
  }
  const moveRod = (index) => {
    if (!activeTeam || !answered || moves <= 0 || timer <= 0 || finished) return
    if (selected === null) {
      if (!activeTeam.stacks[index].length || isComplete(activeTeam.stacks[index], level.capacity)) { setToast('Hãy chọn một đinh có bu lông chưa hoàn thành.'); playSfx('wrong'); return }
      setSelected(index); playSfx('select'); return
    }
    if (selected === index) { setSelected(null); return }
    const from = activeTeam.stacks[selected], to = activeTeam.stacks[index], bolt = from[from.length - 1]
    if (!bolt) { setSelected(null); return }
    if (to.length >= level.capacity) { setToast('Đinh này đã đầy!'); playSfx('wrong'); return }
    if (to.length && to[to.length - 1].color !== bolt.color) { setToast('Chỉ được đặt lên đinh rỗng hoặc bu lông cùng màu.'); playSfx('wrong'); return }
    const sourceElement = document.querySelector(`[data-bolt-id="${bolt.id}"]`)
    const targetRod = document.querySelector(`[data-rod-index="${index}"]`)
    if (sourceElement && targetRod) {
      const fromRect = sourceElement.getBoundingClientRect()
      const targetRect = targetRod.getBoundingClientRect()
      const boltHeight = fromRect.height
      const destination = { left: targetRect.left + targetRect.width / 2 - fromRect.width / 2, top: targetRect.bottom - 20 - (to.length + 1) * boltHeight }
      setFlyingBolt({ bolt: { ...bolt, revealed: true }, left: fromRect.left, top: fromRect.top, width: fromRect.width, height: fromRect.height, dx: destination.left - fromRect.left, dy: destination.top - fromRect.top, travel: false })
      window.clearTimeout(flightTimerRef.current)
      window.requestAnimationFrame(() => setFlyingBolt((current) => current ? { ...current, travel: true } : current))
      flightTimerRef.current = window.setTimeout(() => setFlyingBolt(null), 620)
    }
    playSfx('move')
    const nextStacks = activeTeam.stacks.map((stack, i) => i === selected ? stack.slice(0, -1) : i === index ? [...stack, { ...bolt, revealed: true }] : stack)
    setHistory((old) => [...old, { turn, stacks: activeTeam.stacks, moves }])
    setTeams((old) => old.map((team, i) => i === turn ? { ...team, stacks: nextStacks } : team))
    setMoves((value) => value - 1); setSelected(null); const rodJustCompleted = isComplete(nextStacks[index], level.capacity); setToast(rodJustCompleted ? 'Tuyệt vời! Một đinh đã đủ màu và đủ số lượng!' : ''); if (rodJustCompleted) playSfx('complete')
    if (nextStacks.every((stack) => stack.length === 0 || isComplete(stack, level.capacity))) { setFinished(true); setScreen('result') }
  }
  const undo = () => {
    const last = history[history.length - 1]
    if (!last || last.turn !== turn || moves >= level.moves) return
    setTeams((old) => old.map((team, i) => i === turn ? { ...team, stacks: last.stacks } : team))
    setHistory((old) => old.slice(0, -1)); playSfx('undo'); setMoves((value) => value + 1); setScores((old) => old.map((score, i) => i === turn ? Math.max(0, score - 1) : score)); setSelected(null); setToast('Đã hoàn tác: +1 lượt di chuyển, −1 điểm.')
  }
  const resetGame = () => { setScreen('setup'); setTeams([]); setFinished(false) }
  const resultWinner = completedCounts[0] > completedCounts[1] ? teams[0]?.name : completedCounts[1] > completedCounts[0] ? teams[1]?.name : null
  const currentQuestion = questions[questionIndex % questions.length] || { content: 'Hãy chọn kho câu hỏi để bắt đầu', answer: '', options: [] }
  return <main className={`bolt-game-shell ${screen === 'game' || screen === 'result' ? 'bolt-game-fullscreen' : ''}`}>
    <div className="bolt-ambient bolt-ambient-one"/><div className="bolt-ambient bolt-ambient-two"/>{flyingBolt && <div className={`bolt-flight ${flyingBolt.travel ? 'bolt-flight-travelling' : ''}`} style={{ left: flyingBolt.left, top: flyingBolt.top, width: flyingBolt.width, height: flyingBolt.height, '--flight-x': `${flyingBolt.dx}px`, '--flight-y': `${flyingBolt.dy}px` }}><Bolt bolt={flyingBolt.bolt} selected/></div>}
    <header className="bolt-topbar"><button className="bolt-back" onClick={() => screen === 'game' ? (window.confirm('Thoát ván chơi hiện tại?') && resetGame()) : navigate(ROUTES.play)}><ArrowLeft size={17}/> <span>{screen === 'game' ? 'Thoát ván' : 'Chọn trò chơi'}</span></button><div className="bolt-brand"><span className="brand-nut">✦</span><span>ĐẠI CHIẾN <b>BU LÔNG</b></span></div><div className="bolt-top-controls"><span className="bolt-top-level">{level.name.toUpperCase()}</span><button type="button" className="bolt-sound-toggle" onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? 'Tắt âm thanh' : 'Bật âm thanh'} title={soundOn ? 'Tắt âm thanh' : 'Bật âm thanh'}>{soundOn ? <Volume2 size={16}/> : <VolumeX size={16}/>}<span>{soundOn ? 'ÂM THANH' : 'ĐÃ TẮT'}</span></button></div></header>
    {screen === 'setup' && <section className="bolt-setup-wrap"><div className="bolt-hero"><span className="bolt-eyebrow"><Sparkles size={14}/> MINI GAME · 2 ĐỘI · 1 THIẾT BỊ</span><h1>Đại chiến<br/><em>Bu Lông!</em></h1><p>Trả lời thật nhanh. Di chuyển thật khéo. Gom đủ bu lông cùng màu để chinh phục chiến thắng.</p><div className="bolt-hero-art"><div className="hero-rod hero-rod-green"><i/><i/><i/></div><div className="hero-rod hero-rod-yellow"><i/><i/><i/></div><div className="hero-rod hero-rod-blue"><i/><i/><i/></div><span className="hero-spark">✦</span></div></div><div className="bolt-setup-card"><div className="setup-step"><span>01</span><div><small>BƯỚC ĐẦU TIÊN</small><h2>Chuẩn bị đội chơi</h2></div></div><label className="bolt-field-label">Tên hai đội</label><div className="bolt-team-inputs"><label><span>🟢 ĐỘI 1</span><input value={teamNames[0]} maxLength={22} onChange={(e) => setTeamNames((old) => [e.target.value, old[1]])}/></label><label><span>🔴 ĐỘI 2</span><input value={teamNames[1]} maxLength={22} onChange={(e) => setTeamNames((old) => [old[0], e.target.value])}/></label></div><label className="bolt-field-label" htmlFor="bolt-quiz-select">Kho câu hỏi lớp học</label><select id="bolt-quiz-select" className="bolt-quiz-select" value={selectedQuizId} onChange={(event) => setSelectedQuizId(event.target.value)} disabled={quizLoading || !quizzes.length}><option value="">{quizLoading ? 'Đang tải kho câu hỏi...' : quizzes.length ? 'Chọn bộ câu hỏi' : 'Chưa có bộ câu hỏi'}</option>{quizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title}{quiz.question_count != null ? ` · ${quiz.question_count} câu` : ''}</option>)}</select><p className="bolt-field-help">Chọn bộ câu hỏi đã lưu như các game khác. Câu hỏi và đáp án sẽ được lấy trực tiếp từ kho câu hỏi của bạn.</p>{quizError && <p className="bolt-quiz-error" role="alert">{quizError}</p>}{!quizLoading && !quizzes.length && <p className="bolt-field-help">Bạn cần đăng nhập và tạo/lưu bộ câu hỏi trước khi chơi.</p>}<button className="bolt-primary-button" disabled={quizLoading || !selectedQuizId} onClick={() => setScreen('levels')}>Chọn cấp độ <ArrowRight size={18}/></button><div className="bolt-safe-note"><Volume2 size={14}/> Chơi luân phiên trên cùng một màn hình</div></div></section>}
    {screen === 'levels' && <section className="bolt-level-screen"><div className="bolt-screen-title"><span className="bolt-eyebrow">CHỌN THỬ THÁCH</span><h1>Chọn cấp độ của bạn</h1><p>Cấp càng cao, đinh càng dài và cần chiến thuật tốt hơn.</p></div><div className="bolt-level-grid">{LEVELS.map((item) => <button key={item.id} className={`bolt-level-card ${level.id === item.id ? 'level-picked' : ''}`} style={{ '--level-color': item.color }} onClick={() => setLevel(item)}><span className="level-face">{item.face}</span><span className="level-number">CẤP ĐỘ 0{item.id}</span><h2>{item.name}</h2><div className="level-stack-preview">{Array.from({ length: Math.min(item.capacity, 5) }, (_, i) => <i key={i} style={{ background: PALETTE[(i + item.id) % PALETTE.length] }}/>)}</div><p>{item.tip}</p><div className="level-meta"><span>{item.capacity} bu lông/đinh</span><span>{item.moves} lượt tối đa</span></div><span className="level-radio">{level.id === item.id && <Check size={14}/>}</span></button>)}</div><div className="bolt-level-actions"><button className="bolt-secondary-button" onClick={() => setScreen('setup')}><ArrowLeft size={16}/> Quay lại</button><button className="bolt-primary-button" onClick={() => void beginGame(level)} disabled={quizLoading || !selectedQuizId}>Bắt đầu trận đấu <Sparkles size={17}/></button></div></section>}
    {screen === 'game' && teams.length === 2 && <><div className="bolt-matchbar"><div><span className="live-dot"/> TRẬN ĐẤU ĐANG DIỄN RA</div><div className="match-round">VÒNG {Math.min(questionIndex + 1, level.rounds)} / {level.rounds}</div><div className="match-rule">Đinh hoàn thành: đủ {level.capacity} bu lông cùng màu</div></div><div className="bolt-split-board">{teams.map((team, index) => <TeamBoard key={team.id} team={team} active={turn === index} level={level} onRod={moveRod} selected={turn === index ? selected : null} moves={turn === index ? moves : '—'} completed={completedCounts[index]} onUndo={undo} canUndo={history.some((item) => item.turn === index)} onPass={nextTurn} timer={timer} score={scores[index]} question={currentQuestion} answered={answered} answerQuestion={answerQuestion} questionResult={questionResult} questionIndex={questionIndex}/>)}</div><div className="bolt-game-toast" aria-live="polite">{toast || (answered ? 'Chọn đinh có bu lông trên cùng → chọn đinh đích.' : 'Trả lời câu hỏi để mở lượt di chuyển.')}</div></>}
    {screen === 'result' && <section className="bolt-result-screen"><div className="result-confetti">✦　✧　✦　✧　✦</div><div className="result-trophy"><Trophy size={43}/></div><span className="bolt-eyebrow">KẾT THÚC TRẬN ĐẤU</span><h1>{resultWinner ? 'Chiến thắng!' : 'Trận đấu hòa!'}</h1><p>{resultWinner ? `${resultWinner} đã chinh phục thử thách!` : 'Hai đội có số đinh hoàn thành bằng nhau. Đỉnh quá!'}</p><div className="bolt-result-scores">{teams.map((team, index) => <div key={team.id} className={resultWinner === team.name ? 'result-winner' : ''}><span className="result-team-dot" style={{ background: team.color }}/><small>{team.name}</small><strong>{completedCounts[index]}</strong><span>đinh hoàn thành</span><em>{scores[index]} điểm</em></div>)}</div><div className="bolt-result-actions"><button className="bolt-secondary-button" onClick={resetGame}><RotateCcw size={16}/> Chơi lại</button><button className="bolt-primary-button" onClick={() => navigate(ROUTES.play)}>Về chọn trò chơi <ArrowRight size={17}/></button></div></section>}
    {screen === 'game' && <button className="bolt-help-fab" title="Luật chơi" onClick={() => setToast('Chỉ chuyển bu lông trên cùng. Đinh đích phải rỗng hoặc có bu lông cùng màu. Hoàn tác trả 1 lượt và trừ 1 điểm.')}><HelpCircle size={18}/></button>}
  </main>
}
