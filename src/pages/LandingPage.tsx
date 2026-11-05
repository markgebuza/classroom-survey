import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Classroom Survey</h1>
        <p className="mt-3 text-lg text-slate-700">Quick in-class understanding checks</p>
        <Link
          to="/login"
          className="mt-8 inline-block rounded-lg bg-blue-700 px-6 py-3 text-lg font-semibold text-white hover:bg-blue-800"
        >
          Instructor Login
        </Link>
      </div>
    </main>
  )
}
