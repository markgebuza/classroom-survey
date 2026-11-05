import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate, type Location } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import { useAuth } from '../lib/auth'
import { reportError } from '../lib/errors'

export default function LoginPage() {
  const { session, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location } | null)?.from
  const destination = from ? `${from.pathname}${from.search}` : '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Instructor Login – Classroom Survey'
  }, [])

  if (loading) return <LoadingState message="Checking your login..." />
  if (session && !pending) return <Navigate to={destination} replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      await signIn(email.trim(), password)
      navigate(destination, { replace: true })
    } catch (err) {
      setError(reportError(err))
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        noValidate
      >
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Instructor Login</h1>

        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input mb-4"
        />

        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input mb-6"
        />

        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-900">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !email.trim() || !password}
          className="btn-primary w-full"
        >
          {pending ? 'Logging in...' : 'Log In'}
        </button>
      </form>
    </main>
  )
}
