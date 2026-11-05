import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDialog from '../components/ConfirmDialog'
import InstructorLayout from '../components/InstructorLayout'
import { AuthContext, type AuthContextValue } from '../lib/auth'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

describe('ConfirmDialog keyboard behaviour', () => {
  it('is a labelled modal that traps Tab and Shift+Tab', async () => {
    render(
      <ConfirmDialog
        title="Delete it?"
        confirmLabel="Delete"
        danger
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      >
        <p>Body text</p>
      </ConfirmDialog>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Delete it?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('Body text')
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const confirm = screen.getByRole('button', { name: 'Delete' })
    expect(cancel).toHaveFocus()
    await userEvent.tab()
    expect(confirm).toHaveFocus()
    await userEvent.tab()
    expect(cancel).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(confirm).toHaveFocus()
  })

  it('ignores Escape while an action is pending', async () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        title="Closing"
        confirmLabel="Close"
        pending
        onConfirm={vi.fn()}
        onCancel={onCancel}
      >
        <p>Body</p>
      </ConfirmDialog>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Working...' })).toBeDisabled()
  })
})

describe('InstructorLayout', () => {
  it('has a skip link as the first focusable element, one h1, and sets the page title', async () => {
    const auth = {
      session: null,
      user: { email: 't@example.edu' },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    } as unknown as AuthContextValue
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter>
          <InstructorLayout title="Dashboard">
            <p>content</p>
          </InstructorLayout>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    )
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(document.title).toBe('Dashboard – Classroom Survey')
  })
})
