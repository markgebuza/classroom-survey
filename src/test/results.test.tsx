import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../lib/api/surveys'
import { AuthContext, type AuthContextValue } from '../lib/auth'
import type { SurveyResults, SurveyWithQuestions } from '../lib/types'
import ResultsPage from '../pages/ResultsPage'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../lib/api/surveys', () => ({
  getSurvey: vi.fn(),
  getSurveyResults: vi.fn(),
  listResponsesWithAnswers: vi.fn(),
}))

const mocked = vi.mocked(api)

const auth: AuthContextValue = {
  session: null,
  user: { email: 'teacher@example.edu' } as AuthContextValue['user'],
  loading: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
}

function survey(status: SurveyWithQuestions['status']): SurveyWithQuestions {
  return {
    id: 's1',
    title: 'Recursion Check',
    description: null,
    status,
    public_slug: 'abc',
    created_at: '2026-08-17T12:00:00Z',
    updated_at: '2026-08-17T12:00:00Z',
    questions: [],
  }
}

const results: SurveyResults = {
  survey_id: 's1',
  response_count: 52,
  questions: [
    {
      question_id: 'q1',
      question_text: 'What is required for recursion?',
      response_count: 52,
      choices: [
        { choice_id: 'c1', choice_text: 'A base case', count: 45, percentage: 86.5 },
        { choice_id: 'c2', choice_text: 'A pointer', count: 3, percentage: 5.8 },
        { choice_id: 'c3', choice_text: 'A loop', count: 2, percentage: 3.8 },
        { choice_id: 'c4', choice_text: 'A compiler', count: 2, percentage: 3.8 },
      ],
    },
    {
      question_id: 'q2',
      question_text: 'Added later',
      response_count: 0,
      choices: [
        { choice_id: 't', choice_text: 'True', count: 0, percentage: 0 },
        { choice_id: 'f', choice_text: 'False', count: 0, percentage: 0 },
      ],
    },
  ],
}

function renderResults() {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/surveys/s1/results']}>
        <Routes>
          <Route path="/surveys/:id/results" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('ResultsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('shows totals and a visible count + percentage for every choice', async () => {
    mocked.getSurvey.mockResolvedValue(survey('closed'))
    mocked.getSurveyResults.mockResolvedValue(results)
    renderResults()
    expect(screen.getByText('Loading results...')).toBeInTheDocument()
    expect(await screen.findByText('52 responses')).toBeInTheDocument()
    expect(screen.getByText('Closed')).toBeInTheDocument()

    const q1 = screen.getByRole('table', { name: 'Answers for question 1' })
    const baseCase = within(q1).getByRole('row', { name: /A base case/ })
    expect(baseCase).toHaveTextContent('45')
    expect(baseCase).toHaveTextContent('86.5%')
    expect(within(q1).getAllByRole('row')).toHaveLength(5)
    expect(screen.getByText('No answers')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Present QR' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    )
  })

  it('works for archived surveys and offers Present QR only for active ones', async () => {
    mocked.getSurvey.mockResolvedValueOnce(survey('archived'))
    mocked.getSurveyResults.mockResolvedValue(results)
    const { unmount } = renderResults()
    expect(await screen.findByText('Archived')).toBeInTheDocument()
    unmount()

    mocked.getSurvey.mockResolvedValueOnce(survey('active'))
    renderResults()
    expect(await screen.findByRole('link', { name: 'Present QR' })).toHaveAttribute(
      'href',
      '/surveys/s1/present',
    )
  })

  it('refreshes from the database', async () => {
    mocked.getSurvey.mockResolvedValue(survey('active'))
    mocked.getSurveyResults
      .mockResolvedValueOnce({ ...results, response_count: 0 })
      .mockResolvedValue(results)
    renderResults()
    expect(await screen.findByText('0 responses')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByText('52 responses')).toBeInTheDocument()
    expect(mocked.getSurveyResults).toHaveBeenCalledTimes(2)
  })

  it('exports a UTF-8 CSV with BOM named after the survey', async () => {
    const full: SurveyWithQuestions = {
      ...survey('closed'),
      questions: [
        {
          id: 'q1',
          survey_id: 's1',
          question_text: 'Café?',
          question_type: 'true_false',
          position: 1,
          choices: [
            { id: 't', question_id: 'q1', choice_text: 'True', position: 1 },
            { id: 'f', question_id: 'q1', choice_text: 'False', position: 2 },
          ],
        },
      ],
    }
    mocked.getSurvey.mockResolvedValue(full)
    mocked.getSurveyResults.mockResolvedValue(results)
    mocked.listResponsesWithAnswers.mockResolvedValue([
      {
        id: 'r1',
        submitted_at: '2026-08-17T12:09:00Z',
        answers: [{ question_id: 'q1', choice_id: 'f' }],
      },
    ])
    let blob: Blob | null = null
    let fileName = ''
    URL.createObjectURL = vi.fn((b: Blob) => {
      blob = b
      return 'blob:csv'
    })
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      fileName = this.download
    })

    renderResults()
    await userEvent.click(await screen.findByRole('button', { name: 'Export CSV' }))
    await vi.waitFor(() => expect(click).toHaveBeenCalled())

    expect(fileName).toMatch(/^recursion-check-results-\d{4}-\d{2}-\d{2}\.csv$/)
    const bytes = new Uint8Array(await blob!.arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain(
      'response_id,submitted_at,Café?\r\nr1,2026-08-17T12:09:00.000Z,False\r\n',
    )
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:csv')
  })

  it('shows a friendly error with retry', async () => {
    mocked.getSurvey.mockResolvedValue(survey('closed'))
    mocked.getSurveyResults.mockRejectedValueOnce({ message: 'permission denied', code: '42501' })
    mocked.getSurveyResults.mockResolvedValue(results)
    renderResults()
    expect(await screen.findByRole('alert')).toHaveTextContent('Your session has expired.')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('52 responses')).toBeInTheDocument()
  })
})
