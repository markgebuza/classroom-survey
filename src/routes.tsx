import { lazy } from 'react'
import { createRoutesFromElements, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import StudentSurveyPage from './pages/StudentSurveyPage'

// Instructor pages (and Recharts/qrcode) load on demand so the student page downloads less.
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const SurveyEditorPage = lazy(() => import('./pages/SurveyEditorPage'))
const PresentPage = lazy(() => import('./pages/PresentPage'))
const ResultsPage = lazy(() => import('./pages/ResultsPage'))

export const routes = createRoutesFromElements(
  <>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/s/:slug" element={<StudentSurveyPage />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/surveys/new" element={<SurveyEditorPage />} />
      <Route path="/surveys/:id/edit" element={<SurveyEditorPage />} />
      <Route path="/surveys/:id/present" element={<PresentPage />} />
      <Route path="/surveys/:id/results" element={<ResultsPage />} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </>,
)
