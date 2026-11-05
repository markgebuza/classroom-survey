import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../lib/api/surveys'
import type { SurveyWithQuestions } from '../lib/types'
import { publicSurveyUrl, qrFileName } from '../lib/urls'
import PresentPage, { POLL_INTERVAL_MS } from '../pages/PresentPage'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('qrcode', () => ({ toDataURL: vi.fn(async () => 'data:image/png;base64,QR') }))
vi.mock('../lib/api/surveys', () => ({
  activateSurvey: vi.fn(),
  closeSurvey: vi.fn(),
  countResponses: vi.fn(),
  getOtherActiveSurvey: vi.fn(),
  getSurvey: vi.fn(),
}))

const mocked = vi.mocked(api)

function survey(status: SurveyWithQuestions['status']): SurveyWithQuestions {
  return {
    id: 's1',
    title: 'Recursion Check',
    description: null,
    status,
    public_slug: status === 'draft' ? null : 'x7kf2qab',
    created_at: '2026-08-17T12:00:00Z',
    updated_at: '2026-08-17T12:00:00Z',
    questions: [],
  }
}

function renderPresent() {
  return render(
    <MemoryRouter initialEntries={['/surveys/s1/present']}>
      <Routes>
        <Route path="/surveys/:id/present" element={<PresentPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('publicSurveyUrl', () => {
  it('prefers VITE_PUBLIC_SITE_URL and strips trailing slashes', () => {
    expect(publicSurveyUrl('abc', 'https://survey.example/', 'http://localhost:5173')).toBe(
      'https://survey.example/s/abc',
    )
  })

  it('falls back to the current origin when unset or empty', () => {
    expect(publicSurveyUrl('abc', undefined, 'http://localhost:5173')).toBe(
      'http://localhost:5173/s/abc',
    )
    expect(publicSurveyUrl('abc', '', 'http://localhost:5173')).toBe('http://localhost:5173/s/abc')
  })

  it('names the QR download after the slug', () => {
    expect(qrFileName('x7kf2q')).toBe('x7kf2q-qr.png')
  })
})

describe('PresentPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows title, QR code, readable URL, download link and the empty-count message', async () => {
    mocked.getSurvey.mockResolvedValue(survey('active'))
    mocked.countResponses.mockResolvedValue(0)
    renderPresent()
    expect(await screen.findByRole('heading', { name: 'Recursion Check' })).toBeInTheDocument()
    const url = `${window.location.origin}/s/x7kf2qab`
    expect(await screen.findByAltText(`QR code that opens ${url}`)).toHaveAttribute(
      'src',
      'data:image/png;base64,QR',
    )
    expect(screen.getByText(url)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download QR' })).toHaveAttribute(
      'download',
      'x7kf2qab-qr.png',
    )
    expect(
      await screen.findByText('No responses yet. Display the QR code so students can join.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Results' })).toHaveAttribute(
      'href',
      '/surveys/s1/results',
    )
  })

  it('polls the response count every 5 seconds', async () => {
    vi.useFakeTimers()
    mocked.getSurvey.mockResolvedValue(survey('active'))
    mocked.countResponses.mockResolvedValueOnce(3).mockResolvedValue(7)
    renderPresent()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText('Responses: 3')).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    })
    expect(screen.getByText('Responses: 7')).toBeInTheDocument()
    expect(mocked.countResponses).toHaveBeenCalledTimes(2)
  })

  it('closes the survey after confirmation', async () => {
    mocked.getSurvey.mockResolvedValueOnce(survey('active')).mockResolvedValue(survey('closed'))
    mocked.countResponses.mockResolvedValue(4)
    mocked.closeSurvey.mockResolvedValue()
    renderPresent()
    await userEvent.click(await screen.findByRole('button', { name: 'Close Survey' }))
    const dialog = screen.getByRole('dialog', { name: 'Close "Recursion Check"?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close Survey' }))
    expect(mocked.closeSurvey).toHaveBeenCalledWith('s1')
    expect(
      await screen.findByText("This survey is not active, so students can't open it."),
    ).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('offers activation for a survey that is not active', async () => {
    mocked.getSurvey.mockResolvedValueOnce(survey('draft')).mockResolvedValue(survey('active'))
    mocked.getOtherActiveSurvey.mockResolvedValue(null)
    mocked.activateSurvey.mockResolvedValue({ id: 's1', status: 'active', public_slug: 'x7kf2qab' })
    mocked.countResponses.mockResolvedValue(0)
    renderPresent()
    await userEvent.click(await screen.findByRole('button', { name: 'Activate Survey' }))
    expect(mocked.activateSurvey).toHaveBeenCalledWith('s1')
    expect(await screen.findByRole('link', { name: 'Download QR' })).toBeInTheDocument()
  })

  it('copies the link', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    mocked.getSurvey.mockResolvedValue(survey('active'))
    mocked.countResponses.mockResolvedValue(0)
    renderPresent()
    await user.click(await screen.findByRole('button', { name: 'Copy link' }))
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/x7kf2qab`)
    expect(screen.getByText('Copied!')).toBeInTheDocument()
  })
})
