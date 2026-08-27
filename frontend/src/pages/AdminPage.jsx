import { useEffect, useState } from 'react'
import Header from '../components/Header.jsx'

export default function AdminPage() {
  const [data, setData] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadOverview() {
    const response = await fetch('/admin/api/overview')
    if (!response.ok) throw new Error('Admin authentication required')
    setData(await response.json())
  }

  useEffect(() => {
    loadOverview()
      .catch(() => setMessage(''))
      .finally(() => setLoading(false))
  }, [])

  async function login(event) {
    event.preventDefault()
    setMessage('')
    const credentials = Object.fromEntries(new FormData(event.currentTarget))
    const response = await fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })

    if (!response.ok) {
      setMessage('Invalid admin credentials.')
      return
    }

    await loadOverview()
  }

  async function removeThought(id) {
    const response = await fetch(`/admin/api/thoughts/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      setMessage('Unable to remove thought.')
      return
    }
    setData((current) => ({
      ...current,
      thoughts: current.thoughts.filter((thought) => thought.id !== id),
    }))
  }

  if (loading) return <><Header admin /><main className="admin-page"><div className="empty">Loading console...</div></main></>

  if (!data) {
    return (
      <>
        <Header admin />
        <main className="admin-login">
          <div className="kicker">Restricted access</div>
          <h1>Admin<br /><em>console.</em></h1>
          <form className="panel auth-form" onSubmit={login}>
            <label>Username<input name="username" required /></label>
            <label>Password<input name="password" type="password" required /></label>
            <button className="button" type="submit">Open console <b>→</b></button>
            {message && <p className="error">{message}</p>}
          </form>
        </main>
      </>
    )
  }

  return (
    <>
      <Header admin />
      <main className="admin-page">
        <div className="feed-heading">
          <div>
            <div className="kicker">WhisperLoud / moderation</div>
            <h1>Control room.</h1>
          </div>
          <span className="admin-badge">LIVE DATA</span>
        </div>
        <section className="stats">
          <div><span>Members</span><strong>{data.users.length}</strong></div>
          <div><span>Thoughts</span><strong>{data.thoughts.length}</strong></div>
          <div><span>Replies</span><strong>{data.comments}</strong></div>
        </section>
        <section className="admin-grid">
          <div className="panel table-panel">
            <h2>Recent thoughts</h2>
            {data.thoughts.map((thought) => (
              <div className="table-row" key={thought.id}>
                <div><strong>{thought.username}</strong><p>{thought.content}</p></div>
                <button className="danger-button" onClick={() => removeThought(thought.id)}>Remove</button>
              </div>
            ))}
          </div>
          <div className="panel table-panel">
            <h2>Members</h2>
            {data.users.map((user) => (
              <div className="member-row" key={user.user_id}><strong>{user.username}</strong><span>{user.email}</span></div>
            ))}
          </div>
        </section>
      </main>
    </>
  )
}
