import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './AdminPanel.css'

export default function AdminPanel({ onClose }) {
  const [users, setUsers] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [activeTab, setActiveTab] = useState('announcements')

  useEffect(() => {
    fetchUsers()
    fetchAnnouncements()
  }, [])

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (data) setUsers(data)
  }

  const fetchAnnouncements = async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    if (data) setAnnouncements(data)
  }

  const handleDeleteAnnouncement = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa thông báo này?')) return
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (!error) setAnnouncements(prev => prev.filter(item => item.id !== id))
  }

  const handleDeleteUser = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa tài khoản này?')) return
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (!error) setUsers(prev => prev.filter(u => u.id !== id))
  }

  return (
    <div className="admin-overlay">
      <div className="admin-card">
        <div className="admin-header">
          <h2>Quản Lý Admin 🤓</h2>
          <button className="btn-close" onClick={onClose}>✕ Đóng</button>
        </div>

        <div className="admin-tabs">
          <button className={activeTab === 'announcements' ? 'active' : ''} onClick={() => setActiveTab('announcements')}>
            Thông báo ({announcements.length})
          </button>
          <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>
            Tài khoản ({users.length})
          </button>
        </div>

        <div className="admin-content">
          {activeTab === 'announcements' ? (
            <div className="admin-list">
              {announcements.map(item => (
                <div key={item.id} className="admin-item">
                  <div>
                    <strong>{item.title}</strong> — <small>{item.sender}</small>
                    <p>{item.content}</p>
                  </div>
                  <button className="btn-delete" onClick={() => handleDeleteAnnouncement(item.id)}>Xóa</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-list">
              {users.map(u => (
                <div key={u.id} className="admin-item">
                  <div>
                    <strong>{u.username}</strong> ({u.is_member ? 'Thành viên A4' : 'Khách'})
                    <div><small>Quyền: {u.role || 'user'}</small></div>
                  </div>
                  <button className="btn-delete" onClick={() => handleDeleteUser(u.id)}>Xóa</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
