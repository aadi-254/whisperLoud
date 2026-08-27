import { useEffect, useState } from 'react'
import Header from '../components/Header.jsx'

function photoUrl(value) {
  if (!value || !value.includes('uploads')) return null
  return `/${value.replace(/\\/g, '/').replace(/^\//, '')}`
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [social, setSocial] = useState(null)
  const [activeList, setActiveList] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/profile')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((user) => {
        setProfile(user)
        return fetch(`/api/users/${encodeURIComponent(user.username)}`)
      })
      .then((response) => response.json())
      .then(setSocial)
      .catch(() => setError('Please sign in to view your profile.'))
  }, [])

  async function submit(event) {
    event.preventDefault()
    const response = await fetch('/api/profile', {
      method: 'PUT',
      body: new FormData(event.currentTarget),
    })
    const data = await response.json()
    if (response.ok) {
      setProfile(data.user)
      setMessage('Profile updated.')
    } else {
      setError(data.error || 'Unable to update profile.')
    }
  }

  if (error && !profile) return <><Header /><main className="feed"><div className="notice">{error} <a href="/login">Sign in</a></div></main></>
  if (!profile || !social) return <><Header /><main className="feed"><div className="empty">Loading profile...</div></main></>

  const photo = photoUrl(profile.profilephoto)
  const list = activeList === 'followers' ? social.followers : social.following

  return (
    <>
      <Header />
      <main className="profile-page">
        <div className="kicker">Your signal / profile</div>
        <div className="profile-layout">
          <section className="profile-card panel">
            {photo ? <img className="profile-photo" src={photo} alt={`${profile.username} profile`} /> : <div className="avatar">{profile.username[0].toUpperCase()}</div>}
            <h1>{profile.username}</h1>
            <p>{profile.email}</p>
            <span>Member since {new Date(profile.memberSince).toLocaleDateString()}</span>
            <div className="follow-stats follow-stats-clickable">
              <button onClick={() => setActiveList(activeList === 'followers' ? null : 'followers')}><strong>{social.followers.length}</strong><span>Followers</span></button>
              <button onClick={() => setActiveList(activeList === 'following' ? null : 'following')}><strong>{social.following.length}</strong><span>Following</span></button>
            </div>
          </section>

          <form className="panel auth-form" onSubmit={submit} encType="multipart/form-data">
            <h2>Edit profile</h2>
            <label>Bio<textarea name="bio" defaultValue={profile.bio || ''} maxLength="200" /></label>
            <label>Address<input name="address" defaultValue={profile.address || ''} /></label>
            <label>Birthdate<input name="birth" type="date" defaultValue={profile.birthdate || ''} /></label>
            <label>Profile photo<input name="profilephoto" type="file" accept="image/*" /></label>
            <p className="form-hint">Leave password fields blank to keep your current password.</p>
            <label>Current password<input name="oldpassword" type="password" /></label>
            <label>New password<input name="newpassword" type="password" /></label>
            <button className="button" type="submit">Save changes <b>↗</b></button>
            {message && <p className="success">{message}</p>}
            {error && <p className="error">{error}</p>}
          </form>
        </div>
        {activeList && <section className="panel follow-list"><h2>{activeList === 'followers' ? 'Followers' : 'Following'}</h2>{list.length ? list.map((user) => <a href={`/user/${encodeURIComponent(user.username)}`} key={user.user_id}>{user.username}</a>) : <p>No users here yet.</p>}</section>}
      </main>
    </>
  )
}
