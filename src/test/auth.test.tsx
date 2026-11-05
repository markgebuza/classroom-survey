import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuthProvider from '../components/AuthProvider'
import { routes } from '../routes'
import { createSupabaseMock } from './supabaseMock'

const mock = vi.hoisted(() => ({ current: null as ReturnType<typeof createSupabaseMock> | null }))

vi.mock('../lib/supabase', async () => {
  const { createSupabaseMock } = await import('./supabaseMock')
  mock.current = createSupabaseMock()
  return { supabase: mock.current.client }
})

function renderAt(path: string) {
  return render(
    <AuthProvider>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
    </AuthProvider>,
  )
}

describe('authentication', () => {
  beforeEach(() => {
    mock.current!.setSession(null)
    mock.current!.client.from.mockReturnValue({
      select: () => ({ order: async () => ({ data: [], error: null }) }),
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it.each([
    '/dashboard',
    '/surveys/new',
    '/surveys/abc/edit',
    '/surveys/abc/present',
    '/surveys/abc/results',
  ])('redirects %s to the login page when logged out', async (path) => {
    renderAt(path)
    expect(await screen.findByRole('heading', { name: 'Instructor Login' })).toBeInTheDocument()
  })

  it('keeps the landing page public', async () => {
    renderAt('/')
    expect(await screen.findByRole('link', { name: 'Instructor Login' })).toBeInTheDocument()
  })

  it('shows a friendly message for bad credentials and re-enables the button', async () => {
    mock.current!.client.auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { message: 'Invalid login credentials', status: 400 },
    })
    renderAt('/login')
    await userEvent.type(await screen.findByLabelText('Email'), 'teacher@example.edu')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Log In' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.')
    expect(screen.getByRole('button', { name: 'Log In' })).toBeEnabled()
  })

  it('returns to the originally requested page after login', async () => {
    mock.current!.client.auth.signInWithPassword.mockImplementationOnce(async () => {
      mock.current!.emit('teacher@example.edu')
      return { data: {}, error: null }
    })
    renderAt('/dashboard')
    await userEvent.type(await screen.findByLabelText('Email'), 'teacher@example.edu')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Log In' }))
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('teacher@example.edu')).toBeInTheDocument()
  })

  it('shows the logged-in email and logs out', async () => {
    mock.current!.setSession('teacher@example.edu')
    renderAt('/dashboard')
    expect(await screen.findByText('teacher@example.edu')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }))
    expect(await screen.findByRole('heading', { name: 'Instructor Login' })).toBeInTheDocument()
  })
})
