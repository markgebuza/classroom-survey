import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import MinimalLayout from '../components/MinimalLayout'
import {
  getPublicSurvey,
  getSurveyStatusBySlug,
  submitSurveyResponse,
  type PublicSurvey,
} from '../lib/api/student'
import { missingQuestionIds, toSubmitAnswers, type SelectedAnswers } from '../lib/answers'
import { MESSAGES, reportError } from '../lib/errors'
import { getAnonymousToken, hasSubmitted, markSubmitted } from '../lib/token'

type PageState = 'loading' | 'loadError' | 'notFound' | 'closed' | 'already' | 'form' | 'success'

function StudentShell({ title = 'Survey', children }: { title?: string; children: ReactNode }) {
  return <MinimalLayout pageTitle={title}>{children}</MinimalLayout>
}

function Notice({ title, message }: { title?: string; message: string }) {
  return (
    <StudentShell title={title ?? message}>
      <div
        role="status"
        className="mt-16 rounded-2xl border border-slate-300 bg-white p-8 text-center"
      >
        {title ? (
          <>
            <h1 className="mb-3 text-3xl font-bold">{title}</h1>
            <p className="text-xl">{message}</p>
          </>
        ) : (
          <h1 className="text-xl font-semibold">{message}</h1>
        )}
      </div>
    </StudentShell>
  )
}

export default function StudentSurveyPage() {
  const { slug = '' } = useParams()
  const [state, setState] = useState<PageState>('loading')
  const [survey, setSurvey] = useState<PublicSurvey | null>(null)
  const [selected, setSelected] = useState<SelectedAnswers>({})
  const [showMissing, setShowMissing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [loadError, setLoadError] = useState('')
  const submittingRef = useRef(false)

  const load = useCallback(async () => {
    setState('loading')
    try {
      const found = await getPublicSurvey(slug)
      if (found) {
        setSurvey(found)
        setState(hasSubmitted(found.id) ? 'already' : 'form')
        return
      }
      let status = null
      try {
        status = await getSurveyStatusBySlug(slug)
      } catch (err) {
        console.error(err)
      }
      setState(status && status !== 'active' ? 'closed' : 'notFound')
    } catch (err) {
      setLoadError(reportError(err))
      setState('loadError')
    }
  }, [slug])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    load()
  }, [load])

  const questionIds = survey?.questions.map((q) => q.id) ?? []
  const missing = showMissing ? missingQuestionIds(questionIds, selected) : []

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!survey || submittingRef.current) return
    setSubmitError('')

    const unanswered = missingQuestionIds(questionIds, selected)
    if (unanswered.length > 0) {
      setShowMissing(true)
      const first = document.getElementById(`question-${unanswered[0]}`)
      first?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
      first?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    try {
      await submitSurveyResponse(
        survey.id,
        getAnonymousToken(),
        toSubmitAnswers(questionIds, selected),
      )
      markSubmitted(survey.id)
      setState('success')
    } catch (err) {
      const message = reportError(err)
      if (message === MESSAGES.duplicate) {
        markSubmitted(survey.id)
        setState('already')
      } else if (message === MESSAGES.closed) {
        setState('closed')
      } else {
        setSubmitError(message)
      }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  switch (state) {
    case 'loading':
      return (
        <StudentShell>
          <LoadingState message="Loading survey..." />
        </StudentShell>
      )
    case 'loadError':
      return (
        <StudentShell>
          <div
            role="alert"
            className="mt-16 rounded-2xl border border-red-300 bg-red-50 p-6 text-center"
          >
            <p className="text-xl text-red-950">{loadError}</p>
            <button type="button" className="btn-primary mt-4 w-full text-lg" onClick={load}>
              Try again
            </button>
          </div>
        </StudentShell>
      )
    case 'notFound':
      return <Notice message={MESSAGES.notFound} />
    case 'closed':
      return <Notice message={MESSAGES.closed} />
    case 'already':
      return <Notice message={MESSAGES.duplicate} />
    case 'success':
      return <Notice title="Thank you!" message="Your response has been recorded." />
  }

  return (
    <StudentShell title={survey!.title}>
      <h1 className="text-3xl font-bold">{survey!.title}</h1>
      {survey!.description && <p className="mt-2 text-lg text-slate-800">{survey!.description}</p>}

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
        {survey!.questions.map((question, index) => {
          const isMissing = missing.includes(question.id)
          return (
            <fieldset
              key={question.id}
              id={`question-${question.id}`}
              aria-describedby={isMissing ? `missing-${question.id}` : undefined}
              className={`rounded-2xl border-2 bg-white p-4 ${isMissing ? 'border-red-700' : 'border-slate-200'}`}
            >
              <legend className="px-1 text-xl font-semibold">
                {index + 1}. {question.question_text}
              </legend>
              {isMissing && (
                <p id={`missing-${question.id}`} className="field-error mb-2 text-base">
                  Please choose an answer.
                </p>
              )}
              <div className="mt-2 space-y-3">
                {question.choices.map((choice) => {
                  const inputId = `choice-${choice.id}`
                  const checked = selected[question.id] === choice.id
                  return (
                    <label
                      key={choice.id}
                      htmlFor={inputId}
                      className={`flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-lg ${
                        checked ? 'border-blue-700 bg-blue-50' : 'border-slate-300 bg-white'
                      }`}
                    >
                      <input
                        id={inputId}
                        type="radio"
                        name={`question-${question.id}`}
                        value={choice.id}
                        checked={checked}
                        onChange={() => setSelected((s) => ({ ...s, [question.id]: choice.id }))}
                        className="h-6 w-6 shrink-0 accent-blue-700"
                      />
                      <span>{choice.choice_text}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )
        })}

        {missing.length > 0 && (
          <p role="alert" className="text-lg font-semibold text-red-800">
            Please answer every question before submitting.
          </p>
        )}
        {submitError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-lg text-red-950">
            {submitError}
          </p>
        )}

        <button type="submit" className="btn-primary min-h-14 w-full text-xl" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
        <p role="status" className="sr-only">
          {submitting ? 'Submitting...' : ''}
        </p>
      </form>
    </StudentShell>
  )
}
