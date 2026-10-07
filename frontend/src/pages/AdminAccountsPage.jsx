import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { ROUTES } from '../lib/routes.js'
import * as accountService from '../services/adminAccountService.js'

const providerLabels = { google: 'Google', email: 'Email', ghost: 'Tài khoản ma', unknown: 'Không rõ' }

export default function AdminAccountsPage() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [accounts, setAccounts] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')

  const load = async () => {
    setLoading(true)
    try { setAccounts(await accountService.listAccounts()) } catch (error) { toast.error(error?.message || 'Không thể tải danh sách tài khoản.') } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return accounts.filter((account) => !needle || [account.email, account.full_name, account.display_name, providerLabels[account.provider]].some((value) => String(value || '').toLowerCase().includes(needle)))
  }, [accounts, query])

  const rename = async (account) => {
    const next = window.prompt('Tên hiển thị mới cho tài khoản ma:', account.full_name || '')
    if (next === null || !next.trim()) return
    setBusyId(account.id)
    try { await accountService.updateGhostDisplayName(account.id, next.trim()); toast.success('Đã cập nhật tên.'); await load() } catch (error) { toast.error(error?.message || 'Không thể cập nhật tên.') } finally { setBusyId('') }
  }

  const remove = async (account) => {
    if (!window.confirm(`Xóa tài khoản ma "${account.full_name || account.email}"? Hành động này không thể hoàn tác.`)) return
    setBusyId(account.id)
    try { await accountService.deleteGhostAccount(account.id); toast.success('Đã xóa tài khoản ma.'); await load() } catch (error) { toast.error(error?.message || 'Không thể xóa tài khoản ma.') } finally { setBusyId('') }
  }

  if (!isAdmin) return <Navigate to={ROUTES.home} replace />

  return <div className="site-shell admin-shell"><SiteHeader /><main className="container admin-main">
    <header className="admin-page-heading"><div><p className="section-overline">Quản trị</p><h1>Quản lý tài khoản</h1><p>Theo dõi tài khoản 10A4-Quizz và quản lý tài khoản ma. Thao tác xóa chỉ khả dụng với tài khoản ma.</p></div><span className="admin-count">{accounts.length} tài khoản</span></header>
    <section className="profile-card admin-card" aria-label="Danh sách tài khoản"><div className="admin-toolbar"><input aria-label="Tìm tài khoản" placeholder="Tìm theo email hoặc tên…" value={query} onChange={(event) => setQuery(event.target.value)} /><button className="button button-quiet" type="button" onClick={() => void load()} disabled={loading}>Làm mới</button></div>
      {loading ? <div className="admin-loading">Đang tải danh sách…</div> : <div className="account-table-wrap"><table className="account-table"><thead><tr><th>Tài khoản</th><th>Provider</th><th>Vai trò</th><th>Trạng thái</th><th /></tr></thead><tbody>{filtered.map((account) => <tr key={account.id}><td><strong>{account.full_name || account.display_name || 'Chưa đặt tên'}</strong><span>{account.email}</span></td><td><span className={`provider-badge provider-${account.provider}`}>{providerLabels[account.provider] || account.provider}</span></td><td>{account.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</td><td>{account.confirmed ? 'Đã xác nhận' : 'Chưa xác nhận'}</td><td>{account.is_ghost && <div className="account-row-actions"><button className="button button-quiet" type="button" onClick={() => void rename(account)} disabled={busyId === account.id}>Sửa tên</button><button className="button button-danger" type="button" onClick={() => void remove(account)} disabled={busyId === account.id}>Xóa</button></div>}</td></tr>)}{!filtered.length && <tr><td colSpan="5" className="account-empty">Không có tài khoản phù hợp.</td></tr>}</tbody></table></div>}
    </section>
  </main></div>
}
