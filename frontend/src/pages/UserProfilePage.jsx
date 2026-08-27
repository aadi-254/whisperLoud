import { useEffect, useState } from 'react'
import Header from '../components/Header.jsx'

function photoUrl(value) {
  if (!value || !value.includes('uploads')) return null
  return `/${value.replace(/\\/g, '/').replace(/^\//, '')}`
}

export default function UserProfilePage({ username }) {
  const [profile, setProfile] = useState(null)
  const [activeList, setActiveList] = useState(null)
  const [message, setMessage] = useState('')

  async function loadProfile() {
    const response = await fetch(`/api/users/${encodeURIComponent(username)}`)
    if (!response.ok) throw new Error('Profile not found')
    setProfile(await response.json())
  }

  useEffect(() => {
    loadProfile().catch((error) => setMessage(error.message))
  }, [username])

  async function toggleFollow() {
    const method = profile.isFollowing ? 'DELETE' : 'POST'
    const response = await fetch(`/api/users/${encodeURIComponent(username)}/follow`, { method })
    const data = await response.json()
    if (!response.ok) {
      setMessage(data.error || 'Unable to update follow status')
      return
    }
    await loadProfile()
  }

  if (message && !profile) {
    return <><Header /><main className="feed"><div className="notice">{message}</div></main></>
  }
  if (!profile) return <><Header /><main className="feed"><div className="empty">Loading profile...</div></main></>

  const photo = photoUrl(profile.profilephoto)
  const list = activeList === 'followers' ? profile.followers : profile.following

  return (
    <>
      <Header />
      <main className="profile-page public-profile">
        <div className="kicker">Community profile</div>
        <section className="profile-card panel">
          {photo ? <img className="profile-photo" src={photo} alt={`${profile.username} profile`} /> : <div className="avatar">{profile.username[0].toUpperCase()}</div>}
          <h1>{profile.username}</h1>
          <p>{profile.bio || 'No bio yet.'}</p>
          {!profile.isSelf && <button className="button" onClick={toggleFollow}>{profile.isFollowing ? 'Unfollow' : 'Follow'} <b>{profile.isFollowing ? '−' : '+'}</b></button>}
          <div className={`follow-stats ${profile.isSelf ? 'follow-stats-clickable' : ''}`}>
            {profile.isSelf ? <button onClick={() => setActiveList(activeList === 'followers' ? null : 'followers')}><strong>{profile.followers.length}</strong><span>Followers</span></button> : <div><strong>{profile.followers.length}</strong><span>Followers</span></div>}
            {profile.isSelf ? <button onClick={() => setActiveList(activeList === 'following' ? null : 'following')}><strong>{profile.following.length}</strong><span>Following</span></button> : <div><strong>{profile.following.length}</strong><span>Following</span></div>}
          </div>
        </section>
        {activeList && <section className="panel follow-list"><h2>{activeList === 'followers' ? 'Followers' : 'Following'}</h2>{list.length ? list.map((user) => <a href={`/user/${encodeURIComponent(user.username)}`} key={user.user_id}>{user.username}</a>) : <p>No users here yet.</p>}</section>}
        {message && <p className="error">{message}</p>}
      </main>
    </>
  )
}
