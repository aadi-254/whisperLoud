import { useState } from 'react'
import Header from '../components/Header.jsx'

export default function LoginPage() {
  const [signup, setSignup] = useState(new URLSearchParams(location.search).has('signup'))
  const [message, setMessage] = useState('')
  async function submit(event) { event.preventDefault(); const body = Object.fromEntries(new FormData(event.target)); const response = await fetch(signup ? '/signup' : '/signin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (response.redirected) location.href = response.url; else { const data = await response.json(); setMessage(data.message || data.error || 'Something went wrong.') } }
  return <><Header /><main className="auth-page"><div className="auth-intro"><div className="kicker">The room is open</div><h1>{signup ? <>Bring your<br /><em>own voice.</em></> : <>Welcome<br /><em>back.</em></>}</h1><p>{signup ? 'Create an account and add your signal to the room.' : 'Pick up where the conversation left off.'}</p></div><form className="panel auth-form" onSubmit={submit}><h2>{signup ? 'Create account' : 'Sign in'}</h2>{signup && <label>Username<input name="username" required /></label>}<label>Email<input name="email" type="email" required /></label><label>Password<input name="password" type="password" required /></label><button className="button" type="submit">{signup ? 'Create account' : 'Sign in'} <b>→</b></button>{message && <p className="error">{message}</p>}<button className="link-button" type="button" onClick={() => setSignup(!signup)}>{signup ? 'Already a member? Sign in' : 'New here? Create an account'}</button></form></main></>
}
