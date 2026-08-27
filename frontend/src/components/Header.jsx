import { useEffect, useState } from 'react'

export default function Header({ admin = false }) {
  const [authenticated, setAuthenticated] = useState(false)
  useEffect(() => {
    if (!admin) {
      fetch('/api/auth/me')
        .then((response) => response.ok && setAuthenticated(true))
        .catch(() => {})
    }
  }, [admin])

  const userMenu = (
    <nav>
      <a href="/dashboard">Room</a>
      <a href="/profile">Profile</a>
      <a href="/createpost">Write</a>
      <a className="text-button" href="/logout">Sign out</a>
    </nav>
  )

  const guestMenu = (
    <nav>
      <a href="/login">Sign in</a>
      <a href="/login?signup=1" className="button small">Join the room</a>
      <a href="/admin" className="admin-link">Admin</a>
    </nav>
  )

  return (
    <header className="topbar">
      <a className="logo" href={admin ? '/admin' : authenticated ? '/dashboard' : '/'}>
        Whisper<span>Loud</span><sup>{admin ? 'OPS' : '•'}</sup>
      </a>
      {admin ? <button className="text-button" onClick={() => fetch('/admin/logout', { method: 'POST' }).then(() => location.reload())}>Sign out</button> : authenticated ? userMenu : guestMenu}
    </header>
  )
}
