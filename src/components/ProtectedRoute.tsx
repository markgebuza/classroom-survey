import { Suspense } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import LoadingState from './LoadingState'

export default function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingState message="Checking your login..." />
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  return (
    <Suspense fallback={<LoadingState message="Loading..." />}>
      <Outlet />
    </Suspense>
  )
}
