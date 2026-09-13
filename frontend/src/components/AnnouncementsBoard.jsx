import { useEffect, useState } from 'react'
import * as classroomService from '../services/classroomService.js'
import './AnnouncementsBoard.css'

export default function AnnouncementsBoard() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    classroomService.getAnnouncements()
      .then((data) => {
        setPosts(Array.isArray(data?.items) ? data.items : [])
        setError('')
      })
      .catch((err) => setError(err.message || 'Loi tai thong bao'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="ann-state"><p>Dang tai thong bao...</p></div>
  if (error) return <div className="ann-state ann-state--error"><p>{error}</p></div>

  return (
    <div className="ann-board">
      <p className="ann-empty">Dang khoi phuc giao dien Thong bao. Co {posts.length} bai.</p>
      <div className="ann-list">
        {posts.map((post) => (
          <article key={post.id} className="ann-card">
            <p className="ann-content">{post.content}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
