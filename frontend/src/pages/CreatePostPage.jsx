import { useState } from 'react'
import Header from '../components/Header.jsx'

export default function CreatePostPage() {
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setUploading(true)

    try {
      const response = await fetch('/createPost', {
        method: 'POST',
        body: new FormData(event.currentTarget),
      })

      if (response.redirected) {
        location.href = response.url
        return
      }

      setError(await response.text() || 'Unable to publish thought.')
    } catch {
      setError('The server could not be reached.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Header />
      <main className="form-page">
        <div className="kicker">New signal</div>
        <h1>Put it<br /><em>out there.</em></h1>
        <form className="panel compose" onSubmit={submit} encType="multipart/form-data">
          <textarea name="postDescription" required placeholder="What is on your mind?" />
          <label className="file-label">
            Add an image
            <input name="postphoto" type="file" accept="image/*" />
          </label>
          <button className="button" type="submit" disabled={uploading}>
            {uploading ? 'Publishing...' : 'Publish thought'} <b>↗</b>
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </main>
    </>
  )
}
