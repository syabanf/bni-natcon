import { useAuthStore } from '../store/auth'
import { WitCredit } from '../components/Layout'

/*
 * The account signed in here belongs to another app.
 *
 * All four roles share one sign-in endpoint, so a door crew or a committee
 * member can type their password into the attendee door and be let straight
 * in. There is nothing here for them: the attendee app refuses their role at
 * every page, and it used to answer by redirecting them to the page that had
 * just refused them — a white screen, no message, no way out but clearing the
 * browser's storage.
 *
 * So: say whose account it is, point at the app it opens, and leave a way
 * back to the sign-in they meant to use.
 */

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || 'http://localhost:5174'
const DOOR_URL = import.meta.env.VITE_DOOR_URL || 'http://localhost:5175/door/login'

const ELSEWHERE = {
  door: {
    title: 'This is a door crew account',
    body: 'Class attendance, goodiebags and pins are handed over in the door app. This one is the attendee pass.',
    label: 'Open the door app',
    url: DOOR_URL,
  },
  admin: {
    title: 'This is a committee account',
    body: 'Master data, the rundown, reports and the draws live in the admin panel. This one is the attendee pass.',
    label: 'Open the admin panel',
    url: ADMIN_URL,
  },
}

export default function WrongApp() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const where = ELSEWHERE[user?.role] || {
    title: 'This account cannot open the attendee app',
    body: 'Ask the committee which app this login belongs to.',
  }

  return (
    <div className="wrong-app">
      <div className="wrong-card">
        <div className="pill red">SIGNED IN AS {user?.role?.toUpperCase() || 'UNKNOWN'}</div>
        <h2>{where.title}</h2>
        <p>{where.body}</p>
        {where.url && (
          <a className="btn" href={where.url}>
            {where.label}
          </a>
        )}
        <button className="btn ghost" onClick={logout}>
          Sign out and use another account
        </button>
        <small>{user?.email}</small>
      </div>
      <WitCredit />
    </div>
  )
}
