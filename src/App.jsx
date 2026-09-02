import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function App() {
  const [announcements, setAnnouncements] = useState([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sender, setSender] = useState('')

  useEffect(() => {
    fetchAnnouncements()

    const channel = supabase
      .channel('realtime-announcements')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'announcements' }, 
        (payload) => {
          setAnnouncements((prev) => [payload.new, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (data) setAnnouncements(data)
    if (error) console.error('Lỗi lấy dữ liệu:', error)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title || !content) return alert('Vui lòng nhập đủ tiêu đề và nội dung!')

    const { error } = await supabase
      .from('announcements')
      .insert([{ title, content, sender: sender || 'Ẩn danh' }])

    if (error) {
      alert('Lỗi đăng thông báo: ' + error.message)
    } else {
      setTitle('')
      setContent('')
      setSender('')
    }
  }

  return (
    <div style={{ maxWidth: '650px', margin: '30px auto', fontFamily: 'Arial, sans-serif', padding: '0 15px' }}>
      <h1 style={{ textAlign: 'center', color: '#2c3e50' }}>📢 BẢNG THÔNG BÁO LỚP</h1>
      
      <form onSubmit={handleSubmit} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '30px' }}>
        <h3 style={{ marginTop: 0 }}>Tạo thông báo mới</h3>
        <input 
          type="text"
          placeholder="Tên người đăng (vd: Lớp trưởng, Nam...)" 
          value={sender} 
          onChange={(e) => setSender(e.target.value)} 
          style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
        <input 
          type="text"
          placeholder="Tiêu đề thông báo..." 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
          style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
        <textarea 
          placeholder="Nội dung thông báo chi tiết..." 
          rows="4"
          value={content} 
          onChange={(e) => setContent(e.target.value)} 
          style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
        <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
          🚀 Đăng Thông Báo Tức Thì
        </button>
      </form>

      <h2>Danh sách thông báo ({announcements.length})</h2>
      <div>
        {announcements.length === 0 ? (
          <p style={{ color: '#7f8c8d' }}>Chưa có thông báo nào.</p>
        ) : (
          announcements.map((item) => (
            <div key={item.id} style={{ background: '#fff', borderLeft: '5px solid #3498db', padding: '15px', borderRadius: '4px', marginBottom: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#2c3e50' }}>{item.title}</h3>
              <p style={{ margin: '0 0 10px 0', whiteSpace: 'pre-wrap', color: '#34495e' }}>{item.content}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#95a5a6' }}>
                <span>👤 Người đăng: <strong>{item.sender}</strong></span>
                <span>⏱️ {new Date(item.created_at).toLocaleString('vi-VN')}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}