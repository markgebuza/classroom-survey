import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../lib/api/student'
import type { PublicSurvey } from '../lib/api/student'
import { markSubmitted, TOKEN_KEY } from '../lib/token'
import StudentSurveyPage from '../pages/StudentSurveyPage'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../lib/api/student', () => ({
  getPublicSurvey: vi.fn(),
  getSurveyStatusBySlug: vi.fn(),
  submitSurveyResponse: vi.fn(),
}))

const mocked = vi.mocked(api)

// token.ts keeps submitted ids in memory for the page's lifetime, so every test uses a new id.
let nextId = 0
let survey: PublicSurvey

const baseSurvey: PublicSurvey = {
  id: 's0',
  title: 'Recursion Check',
  description: 'Quick understanding check',
  questions: [
    {
      id: 'q1',
      question_text: 'What is required for recursion?',
      question_type: 'multiple_choice',
      position: 1,
      choices: [
        { id: 'c1', choice_text: 'A base case', position: 1 },
        { id: 'c2', choice_text: 'A pointer', position: 2 },
      ],
    },
    {
      id: 'q2',
      question_text: 'Every recursive function needs a stopping condition.',
      question_type: 'true_false',
      position: 2,
      choices: [
        { id: 't', choice_text: 'True', position: 1 },
        { id: 'f', choice_text: 'False', position: 2 },
      ],
    },
  ],
}

function renderStudent(slug = 'x7kf2qab') {
  return render(
    <MemoryRouter initialEntries={[`/s/${slug}`]}>
      <Routes>
        <Route path="/s/:slug" element={<StudentSurveyPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('StudentSurveyPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
    survey = { ...baseSurvey, id: `s${++nextId}` }
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders the survey with one fieldset per question and labelled radios', async () => {
    mocked.getPublicSurvey.mockResolvedValue(survey)
    renderStudent()
    expect(await screen.findByRole('heading', { name: 'Recursion Check' })).toBeInTheDocument()
    expect(mocked.getPublicSurvey).toHaveBeenCalledWith('x7kf2qab')
    expect(
      screen.getByRole('group', { name: '1. What is required for recursion?' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'True' })).toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  })

  it('requires every question and highlights the unanswered one', async () => {
    mocked.getPublicSurvey.mockResolvedValue(survey)
    renderStudent()
    await userEvent.click(await screen.findByRole('radio', { name: 'A base case' }))
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByText('Please choose an answer.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please answer every question before submitting.',
    )
    expect(screen.getByRole('radio', { name: 'True' })).toHaveFocus()
    expect(mocked.submitSurveyResponse).not.toHaveBeenCalled()
  })

  it('submits once with the browser token and shows the thank-you screen', async () => {
    let resolve: (v: { success: boolean; response_id: string }) => void = () => {}
    mocked.getPublicSurvey.mockResolvedValue(survey)
    mocked.submitSurveyResponse.mockImplementation(() => new Promise((r) => (resolve = r)))
    renderStudent()
    await userEvent.click(await screen.findByRole('radio', { name: 'A pointer' }))
    await userEvent.click(screen.getByRole('radio', { name: 'False' }))
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))

    const button = screen.getByRole('button', { name: 'Submitting...' })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(mocked.submitSurveyResponse).toHaveBeenCalledTimes(1)
    expect(mocked.submitSurveyResponse).toHaveBeenCalledWith(
      survey.id,
      localStorage.getItem(TOKEN_KEY),
      [
        { question_id: 'q1', choice_id: 'c2' },
        { question_id: 'q2', choice_id: 'f' },
      ],
    )

    resolve({ success: true, response_id: 'r1' })
    expect(await screen.findByText('Thank you!')).toBeInTheDocument()
    expect(screen.getByText('Your response has been recorded.')).toBeInTheDocument()
  })

  it('shows the already-submitted message for DUPLICATE_RESPONSE and remembers it', async () => {
    mocked.getPublicSurvey.mockResolvedValue(survey)
    mocked.submitSurveyResponse.mockRejectedValue({ message: 'DUPLICATE_RESPONSE', code: 'P0001' })
    const { unmount } = renderStudent()
    await userEvent.click(await screen.findByRole('radio', { name: 'A base case' }))
    await userEvent.click(screen.getByRole('radio', { name: 'True' }))
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(
      await screen.findByText('You have already submitted a response to this survey.'),
    ).toBeInTheDocument()
    unmount()

    renderStudent()
    expect(
      await screen.findByText('You have already submitted a response to this survey.'),
    ).toBeInTheDocument()
  })

  it('shows the returning-student message immediately without the form', async () => {
    markSubmitted(survey.id)
    mocked.getPublicSurvey.mockResolvedValue(survey)
    renderStudent()
    expect(
      await screen.findByText('You have already submitted a response to this survey.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument()
  })

  it('shows the closed message when the survey closes before submitting', async () => {
    mocked.getPublicSurvey.mockResolvedValue(survey)
    mocked.submitSurveyResponse.mockRejectedValue({ message: 'SURVEY_NOT_ACTIVE', code: 'P0001' })
    renderStudent()
    await userEvent.click(await screen.findByRole('radio', { name: 'A base case' }))
    await userEvent.click(screen.getByRole('radio', { name: 'True' }))
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(
      await screen.findByText('This survey is no longer accepting responses.'),
    ).toBeInTheDocument()
  })

  it('shows a friendly error (never the raw one) and lets the student retry', async () => {
    mocked.getPublicSurvey.mockResolvedValue(survey)
    mocked.submitSurveyResponse
      .mockRejectedValueOnce({
        message: 'insert or update on table "answers" violates foreign key',
        code: '23503',
      })
      .mockResolvedValue({ success: true, response_id: 'r1' })
    renderStudent()
    await userEvent.click(await screen.findByRole('radio', { name: 'A base case' }))
    await userEvent.click(screen.getByRole('radio', { name: 'True' }))
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Something went wrong. Please try again.')
    expect(alert).not.toHaveTextContent('foreign key')
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Thank you!')).toBeInTheDocument()
  })

  it('distinguishes closed surveys from unknown slugs', async () => {
    mocked.getPublicSurvey.mockResolvedValue(null)
    mocked.getSurveyStatusBySlug.mockResolvedValueOnce('closed')
    const { unmount } = renderStudent('old')
    expect(
      await screen.findByText('This survey is no longer accepting responses.'),
    ).toBeInTheDocument()
    unmount()

    mocked.getSurveyStatusBySlug.mockResolvedValueOnce(null)
    renderStudent('nope')
    expect(await screen.findByText('Survey not found.')).toBeInTheDocument()
  })

  it('treats a failing status lookup as not found', async () => {
    mocked.getPublicSurvey.mockResolvedValue(null)
    mocked.getSurveyStatusBySlug.mockRejectedValue(new Error('function does not exist'))
    renderStudent('x')
    expect(await screen.findByText('Survey not found.')).toBeInTheDocument()
  })

  it('shows a network error with retry when loading fails', async () => {
    mocked.getPublicSurvey
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(survey)
    renderStudent()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Recursion Check' })).toBeInTheDocument()
  })
})
