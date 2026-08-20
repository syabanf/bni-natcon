import { Component } from 'react'

/*
 * The last line between a crash and a white screen.
 *
 * A React render error unmounts the whole tree, and what an attendee sees is
 * a blank page: no message, no button, nothing to tell the committee at the
 * help desk. This catches it and says what happened, with the two escapes
 * that actually fix things on a phone — reload, and sign out (which clears
 * the stored session that a bad shape may be coming from).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    // Kept for the console: whoever is helping at the desk can read it out.
    console.error('The app stopped:', error)
  }

  signOut = () => {
    try {
      localStorage.removeItem('natcon-auth')
    } catch {
      /* private mode, quota — reloading is still worth a try */
    }
    location.href = '/login'
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="wrong-app">
        <div className="wrong-card">
          <div className="pill red">SOMETHING BROKE</div>
          <h2>This screen stopped working</h2>
          <p>
            Nothing you did is lost — your pass, your booth stamps and your class are on the
            server. Reload to try again, or sign in once more.
          </p>
          <button className="btn" onClick={() => location.reload()}>
            Reload the app
          </button>
          <button className="btn ghost" onClick={this.signOut}>
            Sign out and start over
          </button>
          <small>{String(this.state.error?.message || this.state.error)}</small>
        </div>
      </div>
    )
  }
}
