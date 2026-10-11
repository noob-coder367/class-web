import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, CircleHelp, Link2, Monitor, Users } from 'lucide-react'
import SiteHeader from '../components/SiteHeader.jsx'
import { ROUTES } from '../lib/routes.js'
import { allocateWordChainTurns, buildWordChainSource, chooseLocalStartingPhrase, MAX_WORD_CHAIN_TEXT, WORD_CHAIN_TOPICS } from '../lib/wordChain.js'
import { createWordChainRoom, joinWordChainRoom } from '../services/wordChainService.js'
import '../word-chain.css'

const makeTeamNames = (count) => Array.from({ length: count }, (_, index) => `Đội ${index + 1}`)

export default function WordChainSetupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: 'Trận Nối Từ', source_mode: 'topic', topic: WORD_CHAIN_TOPICS[1] || WORD_CHAIN_TOPICS[0], text: '', validation_mode: 'strict', play_mode: 'local', team_count: 2, total_turns: 20, teams: makeTeamNames(2) })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const createKey = useRef(null)
  const quotas = useMemo(() => { try { return allocateWordChainTurns(Number(form.team_count), Number(form.total_turns)) } catch { return [] } }, [form.team_count, form.total_turns])
  const sourceInfo = useMemo(() => { try { return buildWordChainSource({ sourceMode: form.source_mode, topic: form.topic, text: form.text, validationMode: form.validation_mode }) } catch { return null } }, [form.source_mode, form.topic, form.text, form.validation_mode])

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const changeTeamCount = (value) => {
    const count = Number(value)
    setForm((current) => ({ ...current, team_count: count, teams: Array.from({ length: count }, (_, index) => current.teams[index] || `Đội ${index + 1}`) }))
  }

  const startLocal = (event) => {
    event.preventDefault()
    setError('')
    try {
      if (!form.title.trim() || form.title.trim().length > 80) throw new Error('Tên trận cần có từ 1 đến 80 ký tự.')
      if (form.teams.some((name) => !name.trim()) || new Set(form.teams.map((name) => name.trim().toLocaleLowerCase('vi-VN'))).size !== form.teams.length) throw new Error('Tên đội không được để trống và cần khác nhau.')
      const source = buildWordChainSource({ sourceMode: form.source_mode, topic: form.topic, text: form.text, validationMode: form.validation_mode })
      if (form.source_mode !== 'topic' && source.extractedCount < 2) throw new Error('Văn bản quá ngắn, chưa trích xuất được đủ cụm từ.')
      const turnQuotas = allocateWordChainTurns(Number(form.team_count), Number(form.total_turns))
      const room = {
        id: crypto.randomUUID(), code: null, title: form.title.trim(), source_mode: form.source_mode,
        topic: form.source_mode === 'text' ? null : form.topic, validation_mode: form.validation_mode,
        status: 'playing', total_turns: Number(form.total_turns), turns_used: 0, current_turn: 0, starting_phrase: chooseLocalStartingPhrase(source.phrases),
        teams: form.teams.map((name, index) => ({ id: `local-team-${index}`, name: name.trim(), turn_order: index, turn_quota: turnQuotas[index], turns_used: 0, players: 1 })),
        history: [], allowed_phrases: source.phrases, is_host: true, local: true,
      }
      sessionStorage.setItem('noi-tu:local-room', JSON.stringify(room))
      navigate(ROUTES.wordChainPlay)
    } catch (cause) { setError(cause.message || 'Không thể bắt đầu trận.') }
  }

  const createOnline = async (event) => {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      createKey.current ||= crypto.randomUUID()
      const room = await createWordChainRoom({ title: form.title, source_mode: form.source_mode, topic: form.topic, text: form.text, validation_mode: form.validation_mode, team_count: Number(form.team_count), total_turns: Number(form.total_turns), teams: form.teams }, createKey.current)
      createKey.current = null
      navigate(`${ROUTES.wordChainRoom}/${room.code}`)
    } catch (cause) { setError(cause.message || 'Không thể tạo phòng. Hãy kiểm tra đăng nhập và kết nối máy chủ.') }
    finally { setBusy(false) }
  }

  const joinOnline = async (event) => {
    event.preventDefault()
    const code = roomCode.trim().toUpperCase()
    if (!/^[A-Z0-9]{6}$/.test(code)) { setError('Mã phòng cần có đúng 6 ký tự chữ hoặc số.'); return }
    setBusy(true); setError('')
    try { await joinWordChainRoom(code); navigate(`${ROUTES.wordChainRoom}/${code}`) }
    catch (cause) { setError(cause.message || 'Không thể vào phòng. Kiểm tra mã phòng và đăng nhập.') }
    finally { setBusy(false) }
  }

  return <div className="game-shell word-chain-shell"><SiteHeader /><main className="container game-main wc-setup-page">
    <div className="game-breadcrumb"><Link to={ROUTES.play}>Chọn game</Link><span> / </span>Nối Từ / Thiết lập</div>
    <header className="game-heading wc-page-heading"><p className="game-overline">Game show chữ nghĩa</p><h1><Link2 aria-hidden="true" /> Nối Từ</h1><p>Chọn nguồn nội dung, đặt nhịp trận và gọi đội đầu tiên lên sân khấu.</p></header>
    <form className="wc-setup-layout" onSubmit={form.play_mode === 'local' ? startLocal : createOnline}>
      <section className="wc-setup-card wc-source-card"><div className="wc-section-title"><span className="wc-step">01</span><div><h2>Nguồn nội dung</h2><p>Chọn nơi lấy cụm từ hợp lệ trong trận.</p></div></div>
        <div className="wc-source-tabs" role="group" aria-label="Nguồn nội dung">
          {[['topic','Theo chủ đề'],['text','Theo văn bản'],['combined','Kết hợp']].map(([key,label]) => <button key={key} className={form.source_mode === key ? 'wc-choice active' : 'wc-choice'} type="button" onClick={() => update('source_mode', key)}>{label}</button>)}
        </div>
        {(form.source_mode === 'topic' || form.source_mode === 'combined') && <label className="wc-field">Chủ đề<input list="wc-topic-options" value={form.topic} onChange={(event) => update('topic', event.target.value)} maxLength={80} placeholder="Nhập hoặc chọn chủ đề…"/><datalist id="wc-topic-options">{WORD_CHAIN_TOPICS.map((topic) => <option key={topic} value={topic}>{topic[0].toLocaleUpperCase('vi-VN') + topic.slice(1)}</option>)}</datalist><small>Chủ đề tự nhập cần khớp một trong 8 bộ cụm từ seed hiện có.</small></label>}
        {(form.source_mode === 'text' || form.source_mode === 'combined') && <label className="wc-field">Dán văn bản<textarea value={form.text} onChange={(event) => update('text', event.target.value)} maxLength={MAX_WORD_CHAIN_TEXT} rows={6} placeholder="Dán đoạn văn tiếng Việt vào đây…"/><small>{form.text.length.toLocaleString('vi-VN')} / {MAX_WORD_CHAIN_TEXT.toLocaleString('vi-VN')} ký tự · phân tích cụm từ bằng heuristic n-gram (tối đa 4 âm tiết), không phải bộ phân tích ngôn ngữ hoàn chỉnh.</small></label>}
        {(form.source_mode === 'text' || form.source_mode === 'combined') && <fieldset className="wc-validation"><legend>Cách áp dụng văn bản</legend><label><input type="radio" name="validation" checked={form.validation_mode === 'strict'} onChange={() => update('validation_mode', 'strict')}/><span><strong>Nghiêm ngặt</strong><small>Chỉ dùng cụm từ trích xuất được từ văn bản.</small></span></label><label><input type="radio" name="validation" checked={form.validation_mode === 'expanded'} onChange={() => update('validation_mode', 'expanded')}/><span><strong>Mở rộng</strong><small>Dùng văn bản làm ngữ cảnh, cộng thêm tập từ seed của ứng dụng.</small></span></label></fieldset>}
        <div className="wc-source-summary"><BookOpen size={18}/><span>{sourceInfo ? `${sourceInfo.phrases.length.toLocaleString('vi-VN')} cụm từ trong nguồn trận` : 'Chọn nguồn hợp lệ để xem số cụm từ ước tính.'}</span></div>
        {sourceInfo && form.source_mode !== 'topic' && sourceInfo.extractedCount < 2 && <p className="wc-source-warning" role="status">Văn bản quá ngắn hoặc chưa tạo đủ lựa chọn. Dán thêm nội dung trước khi bắt đầu.</p>}
      </section>
      <section className="wc-setup-card"><div className="wc-section-title"><span className="wc-step">02</span><div><h2>Thiết lập trận</h2><p>Giữ nguyên tổng lượt đã chọn.</p></div></div>
        <label className="wc-field">Tên trận<input value={form.title} onChange={(event) => update('title', event.target.value)} maxLength={80}/></label>
        <fieldset className="wc-mode-choice"><legend>Chế độ chơi</legend><label className={form.play_mode === 'local' ? 'wc-mode-option active' : 'wc-mode-option'}><input type="radio" name="playmode" checked={form.play_mode === 'local'} onChange={() => update('play_mode','local')}/><Monitor size={20}/><span><strong>1 máy</strong><small>Một màn hình điều khiển tất cả đội, không cần đăng nhập từng đội.</small></span></label><label className={form.play_mode === 'online' ? 'wc-mode-option active' : 'wc-mode-option'}><input type="radio" name="playmode" checked={form.play_mode === 'online'} onChange={() => update('play_mode','online')}/><Users size={20}/><span><strong>Đấu người thật</strong><small>Tạo phòng bằng mã. Người chơi phòng online đăng nhập theo hệ thống hiện có.</small></span></label></fieldset>
        <div className="wc-config-grid"><label className="wc-field">Số đội<select value={form.team_count} onChange={(event) => changeTeamCount(event.target.value)}>{Array.from({length:7},(_,i)=>i+2).map((n)=><option key={n} value={n}>{n} đội</option>)}</select></label><label className="wc-field">Tổng lượt nối từ<input type="number" min={form.team_count} max="200" value={form.total_turns} onChange={(event) => update('total_turns', event.target.value === '' ? '' : Number(event.target.value))}/></label></div>
        <p className="wc-turn-allocation"><CircleHelp size={17}/>{quotas.length ? `Phân bổ: ${quotas.map((n,i)=>`${form.teams[i] || `Đội ${i+1}`} ${n} lượt`).join(' · ')}. Đội đứng trước nhận lượt dư.` : `Tổng lượt phải từ ${form.team_count} đến 200.`}</p>
        <div className="wc-team-inputs">{form.teams.map((name,index)=><label className="wc-field" key={index}>Tên đội {index+1}<input value={name} maxLength={32} onChange={(event)=>setForm((current)=>({...current,teams:current.teams.map((item,i)=>i===index?event.target.value:item)}))}/></label>)}</div>
      </section>
      {error && <div className="wc-error" role="alert">{error}</div>}
      <div className="wc-setup-actions"><Link to={ROUTES.play} className="game-button quiet"><ArrowLeft size={16}/> Quay lại</Link><button className="game-button primary" type="submit" disabled={busy || !sourceInfo || !quotas.length || (form.source_mode !== 'topic' && sourceInfo.extractedCount < 2)}>{busy ? 'Đang kết nối…' : form.play_mode === 'local' ? <>Bắt đầu trận <ArrowRight size={16}/></> : <>Tạo phòng online <ArrowRight size={16}/></>}</button></div>
    </form>
    <section className="wc-join-panel"><div><p className="game-overline">ĐÃ CÓ MÃ PHÒNG?</p><h2>Tham gia một trận Nối Từ</h2><p>Nhập mã sáu ký tự. Tài khoản người chơi dùng đăng nhập hiện có.</p></div><form onSubmit={joinOnline}><input aria-label="Mã phòng" placeholder="ABC123" maxLength={6} autoCapitalize="characters" value={roomCode} onChange={(event)=>setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6))}/><button className="game-button quiet" disabled={busy || roomCode.length!==6}>{busy?'Đang vào…':'Vào phòng'}</button></form></section>
  </main></div>
}
