import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  createMoneyBook,
  createMoneyCollection,
  createMoneyExpense,
  deleteMoneyExpense,
  getMoneyAuditLogs,
  getMoneyBooks,
  getMoneyCollection,
  getMoneyCollections,
  getMoneyExpenses,
  getMoneyMembers,
  getMoneyOverview,
  getMoneyTransactions,
  updateMoneyCollectionMember,
  uploadMoneyCollectionMemberPhoto,
} from '../services/classMoneyService.js'
import './ClassMoneyPage.css'

const TABS = [
  ['overview', 'Tổng quan'],
  ['collections', 'Thu tiền'],
  ['expenses', 'Chi tiêu'],
  ['budget', 'Ngân sách'],
  ['members', 'Thành viên'],
  ['history', 'Lịch sử'],
]

function IconWallet() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a1 1 0 0 1 1 1v12.5a1.5 1.5 0 0 1-1.5 1.5H6.5A2.5 2.5 0 0 1 4 17.5z" /><path d="M4 8h15.5A1.5 1.5 0 0 1 21 9.5v4H17a2 2 0 0 1 0-4h4" /><path d="M8 5V3.5A1.5 1.5 0 0 1 9.5 2h7A1.5 1.5 0 0 1 18 3.5V5" /></svg>
}
function IconBack() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7" /><path d="M8 12h13" /></svg>
}
function IconPlus() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
}
function IconRefresh() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.7-3.8L4 9" /><path d="M4 4v5h5" /><path d="M4 13a8 8 0 0 0 14.7 3.8L20 15" /><path d="M20 20v-5h-5" /></svg>
}
function IconCamera() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h2l1.3-2h4.4l1.3 2h2A2.5 2.5 0 0 1 20 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" /><circle cx="12" cy="12.5" r="3.5" /></svg>
}

function money(value) {
  return `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)}đ`
}
function dateVN(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN')
}
function errorText(error, fallback = 'Không thể tải dữ liệu tiền lớp.') {
  return error?.message || fallback
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Không đọc được ảnh.'))
    reader.readAsDataURL(file)
  })
}

async function prepareMoneyPhoto(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Vui lòng chọn một tập tin ảnh.')
  if (file.size > 12 * 1024 * 1024) throw new Error('Ảnh gốc tối đa 12MB.')
  const source = await readFileAsDataUrl(file)
  const image = await new Promise((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('Không đọc được ảnh chụp.'))
    element.src = source
  })
  const maxSide = 1600
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale))
  canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale))
  const context = canvas.getContext('2d')
  if (!context) return { blob: file, mimeType: file.type }
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const prepared = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
  if (!prepared) return { blob: file, mimeType: file.type }
  return { blob: prepared, mimeType: 'image/jpeg' }
}

function StatCard({ label, value, tone = '' }) {
  return <article className={`money-stat-card ${tone}`}><span>{label}</span><strong>{money(value)}</strong></article>
}

function StatusBadge({ status }) {
  const labels = { unpaid: 'Chưa đóng', debt: 'Nợ tiền', paid: 'Đã đóng', change: 'Cần thối' }
  return <span className={`money-status money-status--${status || 'unpaid'}`}>{labels[status] || status || 'Chưa đóng'}</span>
}

export default function ClassMoneyPage({ onBack }) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [activeTab, setActiveTab] = useState('overview')
  const [book, setBook] = useState(null)
  const [overview, setOverview] = useState(null)
  const [members, setMembers] = useState([])
  const [rosterSource, setRosterSource] = useState(null)
  const [collections, setCollections] = useState([])
  const [selectedCollection, setSelectedCollection] = useState(null)
  const [expenses, setExpenses] = useState({ items: [], total: 0 })
  const [history, setHistory] = useState({ items: [], total: 0 })
  const [auditLogs, setAuditLogs] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [tabLoading, setTabLoading] = useState(false)
  const [error, setError] = useState('')
  const [showBookForm, setShowBookForm] = useState(false)
  const [showCollectionForm, setShowCollectionForm] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bookForm, setBookForm] = useState({ name: '', description: '' })
  const [collectionForm, setCollectionForm] = useState({ name: '', amountPerPerson: '', dueDate: '', note: '', studentNumbers: [] })
  const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', category: '', spentAt: new Date().toISOString().slice(0, 10), spentBy: '', note: '' })
  const [memberSearch, setMemberSearch] = useState('')

  const summary = overview?.summary || { totalCollected: 0, totalOwed: 0, totalChange: 0, totalExpense: 0, balance: 0 }

  const loadInitial = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    setError('')
    try {
      const [bookData, overviewData, memberData] = await Promise.all([
        getMoneyBooks(),
        getMoneyOverview(),
        getMoneyMembers(),
      ])
      const nextBooks = bookData?.books || []
      setBook(overviewData?.book || nextBooks.find((item) => item.status === 'active') || null)
      setOverview(overviewData)
      setMembers(memberData?.members || [])
      setRosterSource(memberData?.source || null)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => { loadInitial() }, [loadInitial])

  const refreshOverview = async () => {
    const data = await getMoneyOverview(book?.id)
    setOverview(data)
    setBook(data?.book || book)
  }

  useEffect(() => {
    if (!isAdmin || !book?.id || activeTab === 'overview' || activeTab === 'budget') return
    let cancelled = false
    setTabLoading(true)
    setError('')
    const load = async () => {
      try {
        if (activeTab === 'collections') {
          const data = await getMoneyCollections(book.id)
          if (!cancelled) setCollections(data?.collections || [])
        } else if (activeTab === 'expenses') {
          const data = await getMoneyExpenses(book.id)
          if (!cancelled) setExpenses(data || { items: [], total: 0 })
        } else if (activeTab === 'history') {
          const [transactions, audit] = await Promise.all([getMoneyTransactions(book.id), getMoneyAuditLogs(book.id)])
          if (!cancelled) { setHistory(transactions || { items: [], total: 0 }); setAuditLogs(audit || { items: [], total: 0 }) }
        }
      } catch (err) {
        if (!cancelled) setError(errorText(err))
      } finally {
        if (!cancelled) setTabLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [activeTab, book?.id, isAdmin])

  const filteredMembers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase()
    return members.filter((item) => {
      if (!term) return true
      const name = String(item.name || '').toLowerCase()
      const stt = String(item.student_number ?? '')
      return name.includes(term) || stt.includes(term)
    })
  }, [members, memberSearch])

  const createBookNow = async (event) => {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      const result = await createMoneyBook(bookForm)
      setBook(result.book); setShowBookForm(false); setBookForm({ name: '', description: '' }); await refreshOverview()
    } catch (err) { setError(errorText(err, 'Không tạo được sổ tiền lớp.')) } finally { setSaving(false) }
  }

  const createCollectionNow = async (event) => {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      const result = await createMoneyCollection({ ...collectionForm, bookId: book.id })
      setCollections((prev) => [result.collection, ...prev]); setSelectedCollection(result); setShowCollectionForm(false)
      setCollectionForm({ name: '', amountPerPerson: '', dueDate: '', note: '', studentNumbers: [] }); await refreshOverview()
    } catch (err) { setError(errorText(err, 'Không tạo được đợt thu.')) } finally { setSaving(false) }
  }

  const savePayment = async (row, amountPaid, note = row.note || '') => {
    try {
      const result = await updateMoneyCollectionMember(row.id, { amountPaid, note })
      setSelectedCollection((prev) => prev ? { ...prev, members: prev.members.map((item) => item.id === row.id ? result.member : item) } : prev)
      await refreshOverview()
      return result.member
    } catch (err) { setError(errorText(err, 'Không lưu được số tiền.')) }
  }

  const saveMemberPhoto = async (row, payload) => {
    try {
      const result = await uploadMoneyCollectionMemberPhoto(row.id, payload)
      setSelectedCollection((prev) => prev ? { ...prev, members: prev.members.map((item) => item.id === row.id ? result.member : item) } : prev)
      return result.member
    } catch (err) { setError(errorText(err, 'Không lưu được ảnh thu tiền.')) }
  }

  const createExpenseNow = async (event) => {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      await createMoneyExpense({ ...expenseForm, bookId: book.id }); setShowExpenseForm(false); setExpenseForm({ title: '', amount: '', category: '', spentAt: new Date().toISOString().slice(0, 10), spentBy: '', note: '' }); await refreshOverview()
      const data = await getMoneyExpenses(book.id); setExpenses(data || { items: [], total: 0 })
    } catch (err) { setError(errorText(err, 'Không thêm được khoản chi.')) } finally { setSaving(false) }
  }

  const removeExpense = async (id) => {
    if (!window.confirm('Xóa khoản chi này khỏi sổ? Lịch sử giao dịch vẫn được giữ lại.')) return
    try { await deleteMoneyExpense(id); setExpenses((prev) => ({ ...prev, items: prev.items.filter((item) => item.id !== id) })); await refreshOverview() } catch (err) { setError(errorText(err, 'Không xóa được khoản chi.')) }
  }

  const openCollection = async (id) => {
    try { setSelectedCollection(await getMoneyCollection(id)) } catch (err) { setError(errorText(err)) }
  }

  if (!isAdmin) return <main className="money-page money-page--denied"><div className="money-denied-card"><div className="money-denied-lock">🔒</div><h1>Bạn không có quyền truy cập</h1><p>Hệ thống Tiền lớp hiện chỉ dành cho Admin.</p><button type="button" onClick={onBack}>Quay lại</button></div></main>

  return <main className="money-page">
    <header className="money-topbar">
      <button type="button" className="money-back" onClick={onBack}><IconBack /> <span>Quay lại</span></button>
      <div className="money-brand"><span className="money-brand-icon"><IconWallet /></span><div><span>CLASS-WEB</span><h1>Tiền lớp</h1></div></div>
      <button type="button" className="money-refresh" onClick={loadInitial} aria-label="Tải lại" title="Tải lại"><IconRefresh /></button>
    </header>
    <nav className="money-tabs" role="tablist" aria-label="Tiền lớp">
      {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={`money-tab${activeTab === id ? ' is-active' : ''}`} onClick={() => { setActiveTab(id); setSelectedCollection(null) }}>{label}</button>)}
    </nav>
    <section className="money-content">
      {error ? <div className="money-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')}>Đóng</button></div> : null}
      {loading ? <div className="money-state">Đang tải dữ liệu tiền lớp...</div> : !book ? <div className="money-empty"><IconWallet /><h2>Chưa có sổ tiền lớp</h2><p>Tạo sổ đầu tiên để bắt đầu quản lý quỹ lớp.</p><button type="button" className="money-primary" onClick={() => setShowBookForm(true)}><IconPlus /> Tạo sổ tiền</button></div> : <>
        <div className="money-book-line"><div><span className="money-eyebrow">Sổ đang mở</span><h2>{book.name}</h2>{book.description ? <p>{book.description}</p> : null}</div><button type="button" className="money-secondary" onClick={() => setShowBookForm(true)}>Sổ mới</button></div>
        {activeTab === 'overview' ? <Overview summary={summary} activeCollection={overview?.activeCollection} onOpenCollections={() => setActiveTab('collections')} /> : null}
        {activeTab === 'collections' ? <CollectionsTab collections={collections} selected={selectedCollection} onOpen={openCollection} onNew={() => setShowCollectionForm(true)} onSavePayment={savePayment} onSavePhoto={saveMemberPhoto} loading={tabLoading} /> : null}
        {activeTab === 'expenses' ? <ExpensesTab expenses={expenses.items || []} onNew={() => setShowExpenseForm(true)} onDelete={removeExpense} loading={tabLoading} /> : null}
        {activeTab === 'budget' ? <BudgetTab summary={summary} /> : null}
        {activeTab === 'members' ? <MembersTab members={filteredMembers} totalCount={members.length} source={rosterSource} search={memberSearch} setSearch={setMemberSearch} /> : null}
        {activeTab === 'history' ? <HistoryTab transactions={history.items || []} auditLogs={auditLogs.items || []} loading={tabLoading} /> : null}
      </>}
    </section>
    {showBookForm ? <Modal title="Tạo sổ tiền lớp" onClose={() => setShowBookForm(false)}><form className="money-form" onSubmit={createBookNow}><label>Tên sổ<input required value={bookForm.name} onChange={(e) => setBookForm({ ...bookForm, name: e.target.value })} placeholder="Quỹ lớp 10A4" /></label><label>Mô tả<textarea value={bookForm.description} onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })} rows={3} /></label><FormActions saving={saving} /></form></Modal> : null}
    {showCollectionForm ? <Modal title="Khởi tạo đợt thu" onClose={() => setShowCollectionForm(false)}><form className="money-form" onSubmit={createCollectionNow}><label>Tên đợt thu<input required value={collectionForm.name} onChange={(e) => setCollectionForm({ ...collectionForm, name: e.target.value })} placeholder="Quỹ lớp tháng 10" /></label><label>Số tiền mỗi người<input required type="number" min="0" step="1" inputMode="numeric" value={collectionForm.amountPerPerson} onChange={(e) => setCollectionForm({ ...collectionForm, amountPerPerson: e.target.value })} placeholder="50000" /></label><label>Hạn đóng<input type="date" value={collectionForm.dueDate} onChange={(e) => setCollectionForm({ ...collectionForm, dueDate: e.target.value })} /></label><label>Ghi chú<textarea value={collectionForm.note} onChange={(e) => setCollectionForm({ ...collectionForm, note: e.target.value })} rows={2} /></label><MemberPicker members={members} selected={collectionForm.studentNumbers} onChange={(studentNumbers) => setCollectionForm({ ...collectionForm, studentNumbers })} /><FormActions saving={saving} label="Khởi tạo sổ thu" /></form></Modal> : null}
    {showExpenseForm ? <Modal title="Thêm khoản chi" onClose={() => setShowExpenseForm(false)}><form className="money-form" onSubmit={createExpenseNow}><label>Tên khoản chi<input required value={expenseForm.title} onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })} placeholder="Mua giấy A4" /></label><label>Số tiền<input required type="number" min="1" step="1" inputMode="numeric" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} placeholder="120000" /></label><div className="money-form-grid"><label>Ngày<input type="date" value={expenseForm.spentAt} onChange={(e) => setExpenseForm({ ...expenseForm, spentAt: e.target.value })} /></label><label>Danh mục<input value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} placeholder="Đồ dùng lớp" /></label></div><label>Người chi<input value={expenseForm.spentBy} onChange={(e) => setExpenseForm({ ...expenseForm, spentBy: e.target.value })} /></label><label>Ghi chú<textarea value={expenseForm.note} onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })} rows={2} /></label><FormActions saving={saving} label="Lưu khoản chi" /></form></Modal> : null}
  </main>
}

function FormActions({ saving, label = 'Lưu' }) { return <div className="money-form-actions"><button type="submit" className="money-primary" disabled={saving}>{saving ? 'Đang lưu...' : label}</button></div> }
function Modal({ title, onClose, children }) { return <div className="money-modal-backdrop" role="presentation"><div className="money-modal" role="dialog" aria-modal="true" aria-label={title}><div className="money-modal-head"><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Đóng">×</button></div>{children}</div></div> }
function Overview({ summary, activeCollection, onOpenCollections }) { return <div className="money-panel"><div className="money-stats"><StatCard label="Số dư hiện tại" value={summary.balance} tone="is-balance" /><StatCard label="Tổng tiền đã thu" value={summary.totalCollected} /><StatCard label="Tổng tiền còn nợ" value={summary.totalOwed} tone="is-warning" /><StatCard label="Tổng tiền cần thối" value={summary.totalChange} tone="is-warning" /><StatCard label="Tổng tiền đã chi" value={summary.totalExpense} /></div><div className="money-section-head"><div><span className="money-eyebrow">Đợt thu đang hoạt động</span><h3>{activeCollection?.name || 'Chưa có đợt thu nào'}</h3></div><button type="button" className="money-secondary" onClick={onOpenCollections}>Quản lý thu tiền</button></div>{activeCollection ? <p className="money-muted">{activeCollection.members?.length || 0} thành viên · Mức thu {money(activeCollection.amount_per_person)}{activeCollection.due_date ? ` · Hạn ${dateVN(activeCollection.due_date)}` : ''}</p> : <p className="money-muted">Tạo đợt thu đầu tiên trong tab Thu tiền.</p>}</div> }
function BudgetTab({ summary }) { return <div className="money-panel"><div className="money-budget"><div><span>Tổng tiền thu</span><strong>{money(summary.totalCollected)}</strong></div><div className="money-budget-minus">−</div><div><span>Tổng tiền chi</span><strong>{money(summary.totalExpense)}</strong></div><div className="money-budget-line" /><div><span>Số dư</span><strong>{money(summary.balance)}</strong></div></div><p className="money-muted">Số liệu được tính từ dữ liệu backend, không cộng lại ở frontend.</p></div> }
function CollectionsTab({ collections, selected, onOpen, onNew, onSavePayment, onSavePhoto, loading }) { return <div className="money-panel"><div className="money-section-head"><div><span className="money-eyebrow">Các đợt thu</span><h3>Quản lý thu tiền</h3></div><button type="button" className="money-primary" onClick={onNew}><IconPlus /> Tạo đợt thu</button></div>{loading ? <div className="money-state">Đang tải...</div> : !collections.length ? <div className="money-empty-inline">Chưa có đợt thu nào.</div> : <div className="money-collection-list">{collections.map((item) => <button type="button" className={`money-collection-card${selected?.collection?.id === item.id ? ' is-active' : ''}`} key={item.id} onClick={() => onOpen(item.id)}><strong>{item.name}</strong><span>{money(item.amount_per_person)} mỗi người · {item.due_date ? `Hạn ${dateVN(item.due_date)}` : 'Không hạn'}</span></button>)}</div>}{selected ? <CollectionDetail data={selected} onSavePayment={onSavePayment} onSavePhoto={onSavePhoto} /> : null}</div> }
function CollectionDetail({ data, onSavePayment, onSavePhoto }) { return <div className="money-detail"><div className="money-detail-head"><h3>{data.collection.name}</h3><span>{data.members.length} người</span></div><div className="money-table-wrap"><table className="money-table"><thead><tr><th>STT</th><th>Họ và tên</th><th>Trạng thái</th><th>Cần thu</th><th>Đã thu</th><th>Còn nợ</th><th>Cần thối</th><th>Ghi chú</th><th>Ảnh</th><th>Ngày thu</th><th>Người thu</th></tr></thead><tbody>{data.members.map((row) => <tr key={row.id}><td>{row.student_number ?? '—'}</td><td className="money-name-cell">{row.display_name_snapshot}</td><td><StatusBadge status={row.status} /></td><td>{money(row.amount_due)}</td><td><PaymentCell row={row} onSave={onSavePayment} /></td><td>{money(row.amount_owed)}</td><td>{money(row.amount_change)}</td><td><NoteCell row={row} onSave={onSavePayment} /></td><td><PhotoCell row={row} onSave={onSavePhoto} /></td><td>{dateVN(row.paid_at)}</td><td>{row.paid_by ? 'Admin' : '—'}</td></tr>)}</tbody></table></div></div> }
function PaymentCell({ row, onSave }) {
  const [value, setValue] = useState(row.amount_paid)
  const [note, setNote] = useState(row.note || '')
  const [state, setState] = useState('')
  useEffect(() => { setValue(row.amount_paid); setNote(row.note || '') }, [row.amount_paid, row.note])
  const save = async () => {
    if (Number(value) === Number(row.amount_paid) && note === (row.note || '')) return
    setState('saving')
    const result = await onSave(row, value, note)
    setState(result ? 'saved' : 'error')
  }
  return <div className="money-payment-cell"><input className="money-amount-input" type="number" min="0" step="1" inputMode="numeric" value={value} onChange={(e) => { setValue(e.target.value); setState('') }} onBlur={save} />{state === 'saving' ? <small>Đang lưu…</small> : state === 'saved' ? <small className="is-saved">Đã lưu</small> : state === 'error' ? <small className="is-error">Lỗi</small> : null}</div>
}
function NoteCell({ row, onSave }) {
  const [value, setValue] = useState(row.note || '')
  const [state, setState] = useState('')
  useEffect(() => setValue(row.note || ''), [row.note])
  const save = async () => {
    if (value === (row.note || '') || state === 'saving') return
    setState('saving')
    const result = await onSave(row, row.amount_paid, value)
    setState(result ? 'saved' : 'error')
  }
  return <div className="money-note-cell"><textarea value={value} maxLength={500} rows={2} placeholder="Nhập ghi chú" onChange={(e) => { setValue(e.target.value); setState('') }} /><button type="button" className="money-note-ok" onClick={save} disabled={state === 'saving' || value === (row.note || '')}>OK</button>{state === 'saving' ? <small>Đang lưu…</small> : state === 'saved' ? <small className="is-saved">Đã lưu</small> : state === 'error' ? <small className="is-error">Lỗi</small> : null}</div>
}
function PhotoCell({ row, onSave }) {
  const [state, setState] = useState('')
  
  const selectPhoto = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setState('saving')
    try {
      const payload = await prepareMoneyPhoto(file)
      const result = await onSave(row, payload)
      setState(result ? 'saved' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="money-photo-cell">
      {row.photo_url ? (
        <a href={row.photo_url} target="_blank" rel="noreferrer">
          <img src={row.photo_url} alt={`Ảnh của ${row.display_name_snapshot}`} />
        </a>
      ) : null}

      <div className="money-photo-actions">
        {/* Nút chụp camera */}
        <label className="money-photo-btn">
          <IconCamera /> Chụp
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            onChange={selectPhoto} 
          />
        </label>

        {/* Nút chọn từ album */}
        <label className="money-photo-btn money-photo-btn--gallery">
          📁 Album
          <input 
            type="file" 
            accept="image/*" 
            onChange={selectPhoto} 
          />
        </label>
      </div>

      {state === 'saving' ? <small>Đang lưu…</small> : 
       state === 'saved' ? <small className="is-saved">Đã lưu</small> : 
       state === 'error' ? <small className="is-error">Lỗi ảnh</small> : null}
    </div>
  )
}
function ExpensesTab({ expenses, onNew, onDelete, loading }) { return <div className="money-panel"><div className="money-section-head"><div><span className="money-eyebrow">Sổ chi</span><h3>Khoản chi</h3></div><button type="button" className="money-primary" onClick={onNew}><IconPlus /> Thêm khoản chi</button></div>{loading ? <div className="money-state">Đang tải...</div> : !expenses.length ? <div className="money-empty-inline">Chưa có khoản chi nào.</div> : <div className="money-table-wrap"><table className="money-table"><thead><tr><th>Khoản chi</th><th>Số tiền</th><th>Ngày</th><th>Danh mục</th><th>Ghi chú</th><th /></tr></thead><tbody>{expenses.map((item) => <tr key={item.id}><td className="money-name-cell">{item.title}</td><td>{money(item.amount)}</td><td>{dateVN(item.spent_at)}</td><td>{item.category || '—'}</td><td>{item.note || '—'}</td><td><button type="button" className="money-danger-link" onClick={() => onDelete(item.id)}>Xóa</button></td></tr>)}</tbody></table></div>}</div> }
function MembersTab({ members, totalCount, source, search, setSearch }) { return <div className="money-panel"><div className="money-section-head"><div><span className="money-eyebrow">Danh sách lớp từ Tiện ích</span><h3>Thành viên</h3>{source?.fileName ? <p className="money-muted">{source.fileName} · {totalCount} học sinh</p> : <p className="money-muted">{totalCount} học sinh theo STT danh sách lớp</p>}</div><span className="money-count">{members.length}{search.trim() ? ` / ${totalCount}` : ''} người</span></div><input className="money-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên học sinh..." />{!members.length ? <div className="money-empty-inline">Không tìm thấy học sinh.</div> : <div className="money-member-grid">{members.map((item) => <div className="money-member-card" key={item.id}><div className="money-member-card-head"><span className="money-stt">{item.student_number}</span><strong>{item.name}</strong></div><span>{item.has_account ? 'Đã có tài khoản' : 'Chưa có tài khoản'}</span></div>)}</div>}</div> }
function HistoryTab({ transactions, auditLogs, loading }) { return <div className="money-panel"><div className="money-section-head"><div><span className="money-eyebrow">Ledger</span><h3>Lịch sử giao dịch</h3></div></div>{loading ? <div className="money-state">Đang tải...</div> : !transactions.length && !auditLogs.length ? <div className="money-empty-inline">Chưa có lịch sử thay đổi.</div> : <div className="money-history-list">{transactions.map((item) => <div className="money-history-item" key={`tx-${item.id}`}><span className={`money-history-dot money-history-dot--${item.type}`} /><div><strong>{item.description || item.type}</strong><span>{money(item.amount)} · {dateVN(item.created_at)}</span></div></div>)}{auditLogs.map((item) => <div className="money-history-item" key={`audit-${item.id}`}><span className="money-history-dot money-history-dot--audit" /><div><strong>{item.action} · {item.entity_type}</strong><span>{dateVN(item.created_at)}</span></div></div>)}</div>}</div> }
function MemberPicker({ members, selected, onChange }) {
  const allNumbers = members.map((item) => item.student_number)
  const allSelected = allNumbers.length > 0 && selected.length === allNumbers.length
  return <div className="money-picker"><div className="money-picker-head"><strong>Học sinh ({selected.length}/{members.length})</strong><button type="button" onClick={() => onChange(allSelected ? [] : allNumbers)}>{allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</button></div>{!members.length ? <p className="money-muted">Chưa có danh sách lớp từ Tiện ích. Hãy tải PDF danh sách lớp trong mục Tiện ích trước.</p> : <div className="money-picker-list">{members.map((item) => <label key={item.id}><input type="checkbox" checked={selected.includes(item.student_number)} onChange={(e) => onChange(e.target.checked ? [...selected, item.student_number] : selected.filter((stt) => stt !== item.student_number))} /><span className="money-stt">{item.student_number}</span><span className="money-picker-name">{item.name}</span>{item.has_account ? null : <em className="money-no-account">chưa có TK</em>}</label>)}</div>}</div>
}
