import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SurveyListItem } from '../lib/api/surveys'
import * as api from '../lib/api/surveys'
import { AuthContext, type AuthContextValue } from '../lib/auth'
import DashboardPage from '../pages/DashboardPage'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../lib/api/surveys', () => ({
  listSurveys: vi.fn(),
  activateSurvey: vi.fn(),
  archiveSurvey: vi.fn(),
  closeSurvey: vi.fn(),
  deleteSurvey: vi.fn(),
  duplicateSurvey: vi.fn(),
}))

const mocked = vi.mocked(api)

function item(
  id: string,
  title: string,
  status: SurveyListItem['status'],
  responses = 0,
): SurveyListItem {
  return {
    id,
    title,
    description: null,
    status,
    public_slug: status === 'draft' ? null : `slug${id}`,
    created_at: '2026-08-17T12:00:00Z',
    updated_at: '2026-08-17T12:00:00Z',
    response_count: responses,
  }
}

const auth: AuthContextValue = {
  session: null,
  user: { email: 'teacher@example.edu' } as AuthContextValue['user'],
  loading: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
}

function renderDashboard() {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/surveys/:id/present" element={<h1>Present page</h1>} />
          <Route path="/surveys/:id/edit" element={<h1>Editor page</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

function card(title: string) {
  return within(screen.getByRole('heading', { name: title }).closest('li')!)
}

function buttonNames(title: string) {
  const li = screen.getByRole('heading', { name: title }).closest('li')!
  return Array.from(li.querySelectorAll('a, button')).map((el) => el.textContent)
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('shows the first-survey empty state', async () => {
    mocked.listSurveys.mockResolvedValue([])
    renderDashboard()
    expect(await screen.findByText('You have not created any surveys yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create Your First Survey' })).toHaveAttribute(
      'href',
      '/surveys/new',
    )
    expect(screen.getByRole('link', { name: 'New Survey' })).toHaveAttribute('href', '/surveys/new')
  })

  it('shows status-dependent actions and text status badges', async () => {
    mocked.listSurveys.mockResolvedValue([
      item('1', 'Draft one', 'draft'),
      item('2', 'Active one', 'active'),
      item('3', 'Closed one', 'closed'),
      item('4', 'Archived one', 'archived'),
    ])
    renderDashboard()
    await screen.findByText('Draft one')
    expect(buttonNames('Draft one')).toEqual(['Edit', 'Activate', 'Duplicate', 'Archive', 'Delete'])
    expect(buttonNames('Active one')).toEqual(['Present', 'Results', 'Close', 'Duplicate'])
    expect(buttonNames('Closed one')).toEqual(['Results', 'Edit', 'Duplicate', 'Archive', 'Delete'])
    expect(buttonNames('Archived one')).toEqual(['Results', 'Duplicate', 'Delete'])
    expect(card('Closed one').getByText('Closed')).toBeInTheDocument()
    expect(card('Draft one').getByText('Aug 17, 2026')).toBeInTheDocument()
  })

  it('filters by search and shows the no-match empty state', async () => {
    mocked.listSurveys.mockResolvedValue([
      item('1', 'Recursion', 'draft'),
      item('2', 'Pointers', 'closed'),
    ])
    renderDashboard()
    await screen.findByText('Recursion')
    await userEvent.type(screen.getByLabelText('Search'), 'point')
    expect(screen.queryByText('Recursion')).not.toBeInTheDocument()
    expect(screen.getByText('Pointers')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'draft')
    expect(screen.getByText('No surveys match your search.')).toBeInTheDocument()
  })

  it('warns strongly when deleting a survey with responses, then deletes and reloads', async () => {
    mocked.listSurveys
      .mockResolvedValueOnce([item('1', 'Old poll', 'closed', 12)])
      .mockResolvedValue([])
    mocked.deleteSurvey.mockResolvedValue()
    renderDashboard()
    await screen.findByText('Old poll')
    await userEvent.click(card('Old poll').getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete "Old poll"?' })
    expect(dialog).toHaveTextContent('this survey has 12 responses')
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(mocked.deleteSurvey).toHaveBeenCalledWith('1')
    expect(await screen.findByText('You have not created any surveys yet.')).toBeInTheDocument()
  })

  it('closes the confirmation dialog on Escape without acting', async () => {
    mocked.listSurveys.mockResolvedValue([item('1', 'Draft one', 'draft')])
    renderDashboard()
    await screen.findByText('Draft one')
    const archive = card('Draft one').getByRole('button', { name: 'Archive' })
    await userEvent.click(archive)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mocked.archiveSurvey).not.toHaveBeenCalled()
    expect(archive).toHaveFocus()
  })

  it('asks before replacing the active survey, then opens the present page', async () => {
    mocked.listSurveys.mockResolvedValue([
      item('1', 'New poll', 'draft'),
      item('2', 'Live poll', 'active'),
    ])
    mocked.activateSurvey.mockResolvedValue({ id: '1', status: 'active', public_slug: 'abc' })
    renderDashboard()
    await screen.findByText('New poll')
    await userEvent.click(card('New poll').getByRole('button', { name: 'Activate' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('This will close "Live poll"')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Activate' }))
    expect(await screen.findByRole('heading', { name: 'Present page' })).toBeInTheDocument()
  })

  it('activates directly when nothing else is active', async () => {
    mocked.listSurveys.mockResolvedValue([item('1', 'New poll', 'draft')])
    mocked.activateSurvey.mockResolvedValue({ id: '1', status: 'active', public_slug: 'abc' })
    renderDashboard()
    await userEvent.click(await screen.findByRole('button', { name: 'Activate' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Present page' })).toBeInTheDocument()
  })

  it('duplicates and opens the editor of the copy', async () => {
    mocked.listSurveys.mockResolvedValue([item('1', 'Poll', 'closed')])
    mocked.duplicateSurvey.mockResolvedValue('new-id')
    renderDashboard()
    await userEvent.click(await screen.findByRole('button', { name: 'Duplicate' }))
    expect(mocked.duplicateSurvey).toHaveBeenCalledWith('1')
    expect(await screen.findByRole('heading', { name: 'Editor page' })).toBeInTheDocument()
  })

  it('shows a friendly inline error when an action fails', async () => {
    mocked.listSurveys.mockResolvedValue([item('1', 'Poll', 'draft')])
    mocked.activateSurvey.mockRejectedValue({ message: 'SURVEY_HAS_NO_QUESTIONS', code: 'P0001' })
    renderDashboard()
    await userEvent.click(await screen.findByRole('button', { name: 'Activate' }))
    expect(await card('Poll').findByRole('alert')).toHaveTextContent(
      'Add at least one question before activating this survey.',
    )
  })

  it('shows a friendly error with retry when loading fails', async () => {
    mocked.listSurveys.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue([])
    renderDashboard()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('You have not created any surveys yet.')).toBeInTheDocument()
  })
})
