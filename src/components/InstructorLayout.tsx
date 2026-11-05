import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { reportError } from '../lib/errors'

export default function InstructorLayout({
  title,
  actions,
  children,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
}) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = `${title} – Classroom Survey`
  }, [title])

  async function handleLogout() {
    setError('')
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(reportError(err))
    }
  }

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to main content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/dashboard" className="text-xl font-bold text-slate-900">
            Classroom Survey
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            {user?.email && (
              <span className="text-sm text-slate-700">
                Signed in as <strong>{user.email}</strong>
              </span>
            )}
            <button type="button" onClick={handleLogout} className="btn-secondary">
              Logout
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="mx-auto max-w-5xl px-4 pb-3 text-red-800">
            {error}
          </p>
        )}
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-6 focus:outline-none">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  )
}
