import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../lib/api/surveys'
import { AuthContext, type AuthContextValue } from '../lib/auth'
import type { SurveyWithQuestions } from '../lib/types'
import SurveyEditorPage from '../pages/SurveyEditorPage'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../lib/api/surveys', () => ({
  activateSurvey: vi.fn(),
  countResponses: vi.fn(),
  createSurvey: vi.fn(),
  getOtherActiveSurvey: vi.fn(),
  getSurvey: vi.fn(),
  replaceSurveyQuestions: vi.fn(),
  updateSurvey: vi.fn(),
}))

const mocked = vi.mocked(api)

const auth: AuthContextValue = {
  session: null,
  user: { email: 'teacher@example.edu' } as AuthContextValue['user'],
  loading: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
}

function renderEditor(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/surveys/new', element: <SurveyEditorPage /> },
      { path: '/surveys/:id/edit', element: <SurveyEditorPage /> },
      { path: '/surveys/:id/present', element: <h1>Present page</h1> },
      { path: '/dashboard', element: <h1>Dashboard page</h1> },
    ],
    { initialEntries: [path] },
  )
  render(
    <AuthContext.Provider value={auth}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
  return router
}

function existingSurvey(status: SurveyWithQuestions['status']): SurveyWithQuestions {
  return {
    id: 's1',
    title: 'Recursion Check',
    description: 'Quick check',
    status,
    public_slug: null,
    created_at: '2026-08-17T12:00:00Z',
    updated_at: '2026-08-17T12:00:00Z',
    questions: [
      {
        id: 'q1',
        survey_id: 's1',
        question_text: 'What is required?',
        question_type: 'multiple_choice',
        position: 1,
        choices: [
          { id: 'c1', question_id: 'q1', choice_text: 'A base case', position: 1 },
          { id: 'c2', question_id: 'q1', choice_text: 'A loop', position: 2 },
        ],
      },
    ],
  }
}

describe('SurveyEditorPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocked.countResponses.mockResolvedValue(0)
    mocked.createSurvey.mockResolvedValue({ ...existingSurvey('draft'), id: 'new-id' })
    mocked.replaceSurveyQuestions.mockResolvedValue()
    mocked.getOtherActiveSurvey.mockResolvedValue(null)
  })

  it('shows validation errors next to the fields and saves nothing', async () => {
    renderEditor('/surveys/new')
    await userEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(screen.getByText('Enter a survey title.')).toBeInTheDocument()
    expect(screen.getByText('Enter the question text.')).toBeInTheDocument()
    expect(screen.getAllByText('Enter the choice text or delete this choice.')).toHaveLength(2)
    expect(screen.getByLabelText(/Survey Title/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/Survey Title/)).toHaveFocus()
    expect(mocked.createSurvey).not.toHaveBeenCalled()
  })

  it('creates a survey with 2 multiple-choice and 1 true/false question in the right order', async () => {
    const router = renderEditor('/surveys/new')
    await userEvent.type(screen.getByLabelText(/Survey Title/), 'Recursion Check')
    await userEvent.type(screen.getByLabelText('Question text'), 'First?')
    await userEvent.type(screen.getByLabelText('Question 1, choice 1'), 'A')
    await userEvent.type(screen.getByLabelText('Question 1, choice 2'), 'B')

    await userEvent.click(screen.getByRole('button', { name: '+ Add Question' }))
    const texts = screen.getAllByLabelText('Question text')
    expect(texts[1]).toHaveFocus()
    await userEvent.type(texts[1], 'Second?')
    await userEvent.type(screen.getByLabelText('Question 2, choice 1'), 'C')
    await userEvent.type(screen.getByLabelText('Question 2, choice 2'), 'D')
    await userEvent.click(screen.getAllByRole('button', { name: '+ Add Choice' })[1])
    await userEvent.type(screen.getByLabelText('Question 2, choice 3'), 'E')

    await userEvent.click(screen.getByRole('button', { name: '+ Add Question' }))
    await userEvent.type(screen.getAllByLabelText('Question text')[2], 'Base case needed?')
    await userEvent.selectOptions(screen.getAllByLabelText('Type')[2], 'true_false')

    // Reorder: move question 2 up, then choice "E" to the top. Edits must survive.
    await userEvent.click(screen.getByRole('button', { name: 'Move question 2 up' }))
    expect(screen.getByRole('button', { name: 'Move question 1 down' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Move question 1 choice 3 up' }))
    await userEvent.click(screen.getByRole('button', { name: 'Move question 1 choice 2 up' }))

    await userEvent.click(screen.getByRole('button', { name: 'Save Draft' }))

    expect(mocked.createSurvey).toHaveBeenCalledWith({
      title: 'Recursion Check',
      description: null,
    })
    expect(mocked.replaceSurveyQuestions).toHaveBeenCalledWith('new-id', [
      {
        text: 'Second?',
        type: 'multiple_choice',
        choices: [{ text: 'E' }, { text: 'C' }, { text: 'D' }],
      },
      { text: 'First?', type: 'multiple_choice', choices: [{ text: 'A' }, { text: 'B' }] },
      {
        text: 'Base case needed?',
        type: 'true_false',
        choices: [{ text: 'True' }, { text: 'False' }],
      },
    ])
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/surveys/new-id/edit')
    expect(mocked.getSurvey).not.toHaveBeenCalled()
  })

  it('confirms before replacing typed choices when switching to True/False', async () => {
    renderEditor('/surveys/new')
    await userEvent.type(screen.getByLabelText('Question 1, choice 1'), 'Custom')
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'true_false')
    const dialog = screen.getByRole('dialog', { name: 'Switch to True / False?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByLabelText('Question 1, choice 1')).toHaveValue('Custom')

    await userEvent.selectOptions(screen.getByLabelText('Type'), 'true_false')
    await userEvent.click(screen.getByRole('button', { name: 'Switch type' }))
    expect(screen.queryByLabelText('Question 1, choice 1')).not.toBeInTheDocument()
    expect(screen.getByText('True')).toBeInTheDocument()
    expect(screen.getByText('False')).toBeInTheDocument()
  })

  it('confirms before deleting a question', async () => {
    renderEditor('/surveys/new')
    await userEvent.click(screen.getByRole('button', { name: '+ Add Question' }))
    expect(screen.getAllByLabelText('Question text')).toHaveLength(2)
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete Question' })[0])
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Question' }),
    )
    expect(screen.getAllByLabelText('Question text')).toHaveLength(1)
  })

  it('deletes a choice but never below two choices', async () => {
    renderEditor('/surveys/new')
    expect(screen.getByRole('button', { name: 'Delete question 1 choice 1' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '+ Add Choice' }))
    await userEvent.type(screen.getByLabelText('Question 1, choice 3'), 'Extra')
    await userEvent.click(screen.getByRole('button', { name: 'Delete question 1 choice 3' }))
    expect(screen.queryByLabelText('Question 1, choice 3')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Add Choice' })).toHaveFocus()
  })

  it('opens an active survey read-only', async () => {
    mocked.getSurvey.mockResolvedValue(existingSurvey('active'))
    renderEditor('/surveys/s1/edit')
    expect(
      await screen.findByText('This survey is active. Close this survey to edit it.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Survey Title/)).toBeDisabled()
    expect(screen.getByLabelText('Question text')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save Draft' })).not.toBeInTheDocument()
  })

  it('locks questions of a survey with responses but still saves the title', async () => {
    mocked.getSurvey.mockResolvedValue(existingSurvey('closed'))
    mocked.countResponses.mockResolvedValue(5)
    mocked.updateSurvey.mockResolvedValue(existingSurvey('closed'))
    renderEditor('/surveys/s1/edit')
    expect(await screen.findByText('This survey already has responses.')).toBeInTheDocument()
    expect(screen.getByLabelText('Question text')).toBeDisabled()
    const title = screen.getByLabelText(/Survey Title/)
    await userEvent.clear(title)
    await userEvent.type(title, 'Renamed')
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(mocked.updateSurvey).toHaveBeenCalledWith('s1', {
      title: 'Renamed',
      description: 'Quick check',
    })
    expect(mocked.replaceSurveyQuestions).not.toHaveBeenCalled()
  })

  it('saves, activates and opens the present page; confirms when another survey is active', async () => {
    mocked.getSurvey.mockResolvedValue(existingSurvey('draft'))
    mocked.updateSurvey.mockResolvedValue(existingSurvey('draft'))
    mocked.getOtherActiveSurvey.mockResolvedValue({ id: 'other', title: 'Live poll' })
    mocked.activateSurvey.mockResolvedValue({ id: 's1', status: 'active', public_slug: 'abc' })
    renderEditor('/surveys/s1/edit')
    await userEvent.click(await screen.findByRole('button', { name: 'Activate' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('This will close "Live poll"')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Activate' }))
    expect(await screen.findByRole('heading', { name: 'Present page' })).toBeInTheDocument()
    expect(mocked.replaceSurveyQuestions).toHaveBeenCalledTimes(1)
    expect(mocked.activateSurvey).toHaveBeenCalledWith('s1')
  })

  it('warns before leaving with unsaved changes', async () => {
    mocked.getSurvey.mockResolvedValue(existingSurvey('draft'))
    renderEditor('/surveys/s1/edit')
    const title = await screen.findByLabelText(/Survey Title/)
    await userEvent.type(title, '!')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Back to Dashboard' }))
    expect(screen.getByRole('dialog', { name: 'Leave without saving?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(title).toHaveValue('Recursion Check!')
    await userEvent.click(screen.getByRole('link', { name: 'Back to Dashboard' }))
    await userEvent.click(screen.getByRole('button', { name: 'Leave page' }))
    expect(await screen.findByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument()
  })

  it('shows a friendly error when saving fails', async () => {
    mocked.getSurvey.mockResolvedValue(existingSurvey('draft'))
    mocked.updateSurvey.mockRejectedValue(new TypeError('Failed to fetch'))
    renderEditor('/surveys/s1/edit')
    await userEvent.click(await screen.findByRole('button', { name: 'Save Draft' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.')
  })
})
