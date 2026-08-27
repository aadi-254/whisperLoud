import { useEffect, useState } from 'react'
import Header from '../components/Header.jsx'

function imageUrl(value) {
  if (!value) return null
  return `/${value.replace(/\\/g, '/').replace(/^\//, '')}`
}

export default function DashboardPage() {
  const [posts, setPosts] = useState([])
  const [error, setError] = useState('')
  const [openComments, setOpenComments] = useState({})

  useEffect(() => {
    fetch('/loadMorePosts?offset=0')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setPosts(data.posts || []))
      .catch(() => setError('Please sign in to view the room.'))
  }, [])

  async function vote(thoughtId, voteType) {
    const response = await fetch('/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thought_id: thoughtId, vote_type: voteType }),
    })
    const data = await response.json()

    if (!response.ok || !data.success) {
      setError(data.message || data.error || 'Unable to vote.')
      return
    }

    setPosts((current) => current.map((post) => (
      post.thought_id === thoughtId
        ? { ...post, [`${voteType}s`]: data.new_count }
        : post
    )))
  }

  async function addComment(event, thoughtId) {
    event.preventDefault()
    const form = event.currentTarget
    const commentText = new FormData(form).get('comment_text')
    const response = await fetch('/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thought_id: thoughtId, comment_text: commentText }),
    })
    const data = await response.json()

    if (!response.ok || !data.success) {
      setError(data.error || 'Unable to add comment.')
      return
    }

    setPosts((current) => current.map((post) => (
      post.thought_id === thoughtId
        ? { ...post, comments: [...(post.comments || []), { username: data.username || 'You', text: commentText }] }
        : post
    )))
    form.reset()
  }

  return (
    <>
      <Header />
      <main className="feed">
        <div className="feed-heading">
          <div>
            <div className="kicker">The room / latest signals</div>
            <h1>Open thoughts.</h1>
          </div>
          <a className="button" href="/createpost">Write a thought <b>+</b></a>
        </div>

        {error && <div className="notice">{error}</div>}

        {posts.map((post) => {
          const image = imageUrl(post.image_url)
          const commentsVisible = openComments[post.thought_id]

          return (
            <article className="post panel" key={post.thought_id}>
              <div className="post-meta">
                <a className="post-author" href={`/user/${encodeURIComponent(post.p_username || post.username)}`}>
                  {post.p_username || post.username}
                </a>
                <span>{new Date(post.created_at).toLocaleDateString()}</span>
              </div>
              <p>{post.content}</p>
              {image && <img className="post-image" src={image} alt="Attached to this thought" onError={(event) => { event.currentTarget.hidden = true }} />}
              <div className="post-actions">
                <button onClick={() => vote(post.thought_id, 'upvote')}>Like {post.upvotes || 0}</button>
                <button onClick={() => vote(post.thought_id, 'downvote')}>Dislike {post.downvotes || 0}</button>
                <button onClick={() => setOpenComments((current) => ({ ...current, [post.thought_id]: !commentsVisible }))}>
                  {commentsVisible ? 'Hide replies' : `Replies ${post.comments?.length || 0}`}
                </button>
              </div>

              {commentsVisible && (
                <div className="comments">
                  {post.comments?.map((comment, index) => (
                    <p key={`${post.thought_id}-${index}`}><strong>{comment.username}</strong> {comment.text}</p>
                  ))}
                  <form className="comment-form" onSubmit={(event) => addComment(event, post.thought_id)}>
                    <input name="comment_text" required maxLength="500" placeholder="Add a reply..." />
                    <button type="submit">Reply</button>
                  </form>
                </div>
              )}
            </article>
          )
        })}

        {!error && posts.length === 0 && <div className="empty">The room is quiet. Be the first to say something.</div>}
      </main>
    </>
  )
}
