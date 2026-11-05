import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorMessage from '../components/ErrorMessage'
import InstructorLayout from '../components/InstructorLayout'
import LoadingState from '../components/LoadingState'
import StatusBadge from '../components/StatusBadge'
import {
  activateSurvey,
  countResponses,
  createSurvey,
  getOtherActiveSurvey,
  getSurvey,
  replaceSurveyQuestions,
  updateSurvey,
} from '../lib/api/surveys'
import {
  changeType,
  draftFromSurvey,
  draftSnapshot,
  emptyDraft,
  errorKeys,
  hasCustomChoices,
  moveItem,
  newChoice,
  newQuestion,
  validateDraft,
  type DraftQuestion,
  type DraftSurvey,
  type EditorErrors,
} from '../lib/editor'
import { reportError } from '../lib/errors'
import type { QuestionType, SurveyStatus } from '../lib/types'

type PendingConfirm =
  | { kind: 'deleteQuestion'; key: string; number: number }
  | { kind: 'changeType'; key: string; type: QuestionType }
  | { kind: 'activate'; otherTitle: string }

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const FIRST_INVALID = '__first-invalid__'

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="field-error">
      {message}
    </p>
  )
}

export default function SurveyEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [surveyId, setSurveyId] = useState<string | null>(id ?? null)
  const [status, setStatus] = useState<SurveyStatus>('draft')
  const [responseCount, setResponseCount] = useState(0)
  const [draft, setDraft] = useState<DraftSurvey>(() => emptyDraft())
  const [savedSnapshot, setSavedSnapshot] = useState(() => draftSnapshot(draft))
  const [loading, setLoading] = useState(Boolean(id))
  const [loadError, setLoadError] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null)
  const [activating, setActivating] = useState(false)

  const loadedIdRef = useRef<string | null>(null)
  const focusRef = useRef<string | null>(null)
  const dirtyRef = useRef(false)
  const allowNavigationRef = useRef(false)

  const readOnly = status === 'active' || status === 'archived'
  const structureLocked = readOnly || responseCount > 0
  const dirty = !readOnly && draftSnapshot(draft) !== savedSnapshot
  const busy = saveState === 'saving' || activating

  const allErrors = validateDraft(draft)
  const errors: EditorErrors = structureLocked
    ? allErrors[errorKeys.title]
      ? { [errorKeys.title]: allErrors[errorKeys.title] }
      : {}
    : allErrors
  const visibleErrors = showErrors ? errors : {}

  const load = useCallback(async (surveyIdToLoad: string) => {
    setLoading(true)
    setLoadError('')
    try {
      const [survey, count] = await Promise.all([
        getSurvey(surveyIdToLoad),
        countResponses(surveyIdToLoad),
      ])
      const loaded = draftFromSurvey(survey)
      loadedIdRef.current = surveyIdToLoad
      setSurveyId(surveyIdToLoad)
      setStatus(survey.status)
      setResponseCount(count)
      setDraft(loaded)
      setSavedSnapshot(draftSnapshot(loaded))
    } catch (err) {
      setLoadError(reportError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // After the first save of a new survey the URL changes to /edit; the data is already here.
    if (!id || id === loadedIdRef.current) return
    load(id)
  }, [id, load])

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  useEffect(() => {
    allowNavigationRef.current = false
  }, [id])

  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // Move keyboard focus after reorder/delete/validation (runs after every render).
  useEffect(() => {
    const target = focusRef.current
    if (!target) return
    focusRef.current = null
    const element =
      target === FIRST_INVALID
        ? document.querySelector<HTMLElement>('[aria-invalid="true"]')
        : document.getElementById(target)
    element?.focus()
  })

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        dirtyRef.current &&
        !allowNavigationRef.current &&
        currentLocation.pathname !== nextLocation.pathname,
      [],
    ),
  )

  function navigateAway(path: string) {
    allowNavigationRef.current = true
    navigate(path, { replace: path.endsWith('/edit') })
  }

  // ---- draft updates -------------------------------------------------------

  function edited(next: (d: DraftSurvey) => DraftSurvey) {
    setDraft(next)
    if (saveState !== 'saving') setSaveState('idle')
  }

  function updateQuestion(key: string, update: (q: DraftQuestion) => DraftQuestion) {
    edited((d) => ({ ...d, questions: d.questions.map((q) => (q.key === key ? update(q) : q)) }))
  }

  function moveQuestion(index: number, delta: -1 | 1) {
    const key = draft.questions[index].key
    const target = index + delta
    const atEdge = delta === -1 ? target === 0 : target === draft.questions.length - 1
    focusRef.current = `q-${atEdge ? (delta === -1 ? 'down' : 'up') : delta === -1 ? 'up' : 'down'}-${key}`
    edited((d) => ({ ...d, questions: moveItem(d.questions, index, delta) }))
  }

  function moveChoice(question: DraftQuestion, index: number, delta: -1 | 1) {
    const key = question.choices[index].key
    const target = index + delta
    const atEdge = delta === -1 ? target === 0 : target === question.choices.length - 1
    focusRef.current = `c-${atEdge ? (delta === -1 ? 'down' : 'up') : delta === -1 ? 'up' : 'down'}-${key}`
    updateQuestion(question.key, (q) => ({ ...q, choices: moveItem(q.choices, index, delta) }))
  }

  function addQuestion() {
    const question = newQuestion()
    focusRef.current = `q-text-${question.key}`
    edited((d) => ({ ...d, questions: [...d.questions, question] }))
  }

  function addChoice(question: DraftQuestion) {
    const choice = newChoice()
    focusRef.current = `c-text-${choice.key}`
    updateQuestion(question.key, (q) => ({ ...q, choices: [...q.choices, choice] }))
  }

  function deleteChoice(question: DraftQuestion, choiceKey: string) {
    focusRef.current = `add-choice-${question.key}`
    updateQuestion(question.key, (q) => ({
      ...q,
      choices: q.choices.filter((c) => c.key !== choiceKey),
    }))
  }

  function requestTypeChange(question: DraftQuestion, type: QuestionType) {
    if (type === 'true_false' && hasCustomChoices(question)) {
      setConfirm({ kind: 'changeType', key: question.key, type })
      return
    }
    updateQuestion(question.key, (q) => changeType(q, type))
  }

  // ---- save / activate -----------------------------------------------------

  async function save(): Promise<string | null> {
    setShowErrors(true)
    if (Object.keys(errors).length > 0) {
      focusRef.current = FIRST_INVALID
      setSaveState('error')
      setSaveMessage('Please fix the highlighted fields.')
      return null
    }

    const saving = draft
    setSaveState('saving')
    setSaveMessage('')
    try {
      const title = saving.title.trim()
      const description = saving.description.trim() || null
      let currentId = surveyId

      const latestCount = currentId && !structureLocked ? await countResponses(currentId) : 0
      if (latestCount > 0) {
        setResponseCount(latestCount)
        setSaveState('error')
        setSaveMessage(
          'This survey received responses since you opened it, so its questions can no longer be changed. Reload the page to continue.',
        )
        return null
      }

      if (currentId) {
        await updateSurvey(currentId, { title, description })
      } else {
        const created = await createSurvey({ title, description })
        currentId = created.id
        loadedIdRef.current = currentId
        setSurveyId(currentId)
      }
      if (!structureLocked) {
        await replaceSurveyQuestions(
          currentId,
          saving.questions.map((q) => ({
            text: q.text,
            type: q.type,
            choices: q.choices.map((c) => ({ text: c.text })),
          })),
        )
      }
      setSavedSnapshot(draftSnapshot(saving))
      setSaveState('saved')
      if (!id) navigateAway(`/surveys/${currentId}/edit`)
      return currentId
    } catch (err) {
      setSaveState('error')
      setSaveMessage(reportError(err))
      return null
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    await save()
  }

  async function activate() {
    setConfirm(null)
    setActivating(true)
    const savedId = await save()
    if (!savedId) {
      setActivating(false)
      return
    }
    try {
      await activateSurvey(savedId)
      navigateAway(`/surveys/${savedId}/present`)
    } catch (err) {
      setSaveState('error')
      setSaveMessage(reportError(err))
      setActivating(false)
    }
  }

  async function handleActivateClick() {
    setShowErrors(true)
    if (Object.keys(errors).length > 0) {
      focusRef.current = FIRST_INVALID
      setSaveState('error')
      setSaveMessage('Please fix the highlighted fields.')
      return
    }
    try {
      const other = await getOtherActiveSurvey(surveyId)
      if (other) {
        setConfirm({ kind: 'activate', otherTitle: other.title })
        return
      }
    } catch (err) {
      setSaveState('error')
      setSaveMessage(reportError(err))
      return
    }
    await activate()
  }

  function handleConfirm() {
    if (!confirm) return
    if (confirm.kind === 'deleteQuestion') {
      focusRef.current = 'add-question'
      edited((d) => ({ ...d, questions: d.questions.filter((q) => q.key !== confirm.key) }))
      setConfirm(null)
    } else if (confirm.kind === 'changeType') {
      updateQuestion(confirm.key, (q) => changeType(q, confirm.type))
      setConfirm(null)
    } else {
      activate()
    }
  }

  // ---- rendering -----------------------------------------------------------

  function inputProps(errorKey: string, errorId: string) {
    const invalid = Boolean(visibleErrors[errorKey])
    return { 'aria-invalid': invalid, 'aria-describedby': invalid ? errorId : undefined }
  }

  function renderQuestion(question: DraftQuestion, index: number) {
    const n = index + 1
    const last = draft.questions.length - 1
    return (
      <section
        key={question.key}
        aria-labelledby={`q-heading-${question.key}`}
        className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm"
      >
        <h2 id={`q-heading-${question.key}`} className="text-lg font-bold text-slate-900">
          Question {n}
        </h2>

        <label htmlFor={`q-text-${question.key}`} className="label mt-3">
          Question text
        </label>
        <input
          id={`q-text-${question.key}`}
          className="input"
          value={question.text}
          onChange={(e) => updateQuestion(question.key, (q) => ({ ...q, text: e.target.value }))}
          {...inputProps(errorKeys.question(question.key), `q-error-${question.key}`)}
        />
        <FieldError
          id={`q-error-${question.key}`}
          message={visibleErrors[errorKeys.question(question.key)]}
        />

        <label htmlFor={`q-type-${question.key}`} className="label mt-4">
          Type
        </label>
        <select
          id={`q-type-${question.key}`}
          className="input sm:max-w-xs"
          value={question.type}
          onChange={(e) => requestTypeChange(question, e.target.value as QuestionType)}
        >
          <option value="multiple_choice">Multiple Choice</option>
          <option value="true_false">True / False</option>
        </select>

        <fieldset className="mt-4">
          <legend className="label">Choices</legend>
          {question.type === 'true_false' ? (
            <>
              <ul className="space-y-2">
                {question.choices.map((choice) => (
                  <li
                    key={choice.key}
                    className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2"
                  >
                    {choice.text}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-slate-700">
                True / False questions always use the choices "True" and "False".
              </p>
            </>
          ) : (
            <>
              <ol className="space-y-2">
                {question.choices.map((choice, cIndex) => {
                  const cn = cIndex + 1
                  const errorId = `c-error-${choice.key}`
                  return (
                    <li key={choice.key}>
                      <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor={`c-text-${choice.key}`} className="sr-only">
                          Question {n}, choice {cn}
                        </label>
                        <input
                          id={`c-text-${choice.key}`}
                          className="input min-w-0 flex-1"
                          placeholder={`Choice ${cn}`}
                          value={choice.text}
                          onChange={(e) =>
                            updateQuestion(question.key, (q) => ({
                              ...q,
                              choices: q.choices.map((c) =>
                                c.key === choice.key ? { ...c, text: e.target.value } : c,
                              ),
                            }))
                          }
                          {...inputProps(errorKeys.choice(choice.key), errorId)}
                        />
                        <button
                          id={`c-up-${choice.key}`}
                          type="button"
                          className="btn-secondary"
                          aria-label={`Move question ${n} choice ${cn} up`}
                          disabled={cIndex === 0}
                          onClick={() => moveChoice(question, cIndex, -1)}
                        >
                          ↑
                        </button>
                        <button
                          id={`c-down-${choice.key}`}
                          type="button"
                          className="btn-secondary"
                          aria-label={`Move question ${n} choice ${cn} down`}
                          disabled={cIndex === question.choices.length - 1}
                          onClick={() => moveChoice(question, cIndex, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          aria-label={`Delete question ${n} choice ${cn}`}
                          disabled={question.choices.length <= 2}
                          title={
                            question.choices.length <= 2
                              ? 'A question needs at least two choices'
                              : undefined
                          }
                          onClick={() => deleteChoice(question, choice.key)}
                        >
                          Delete
                        </button>
                      </div>
                      <FieldError
                        id={errorId}
                        message={visibleErrors[errorKeys.choice(choice.key)]}
                      />
                    </li>
                  )
                })}
              </ol>
              <FieldError
                id={`choices-error-${question.key}`}
                message={visibleErrors[errorKeys.choices(question.key)]}
              />
              <button
                id={`add-choice-${question.key}`}
                type="button"
                className="btn-secondary mt-3"
                onClick={() => addChoice(question)}
              >
                + Add Choice
              </button>
            </>
          )}
        </fieldset>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          <button
            id={`q-up-${question.key}`}
            type="button"
            className="btn-secondary"
            aria-label={`Move question ${n} up`}
            disabled={index === 0}
            onClick={() => moveQuestion(index, -1)}
          >
            ↑ Move up
          </button>
          <button
            id={`q-down-${question.key}`}
            type="button"
            className="btn-secondary"
            aria-label={`Move question ${n} down`}
            disabled={index === last}
            onClick={() => moveQuestion(index, 1)}
          >
            ↓ Move down
          </button>
          <button
            type="button"
            className="btn-secondary text-red-800"
            onClick={() => setConfirm({ kind: 'deleteQuestion', key: question.key, number: n })}
          >
            Delete Question
          </button>
        </div>
      </section>
    )
  }

  function renderNotice() {
    if (status === 'active') {
      return (
        <div className="mb-6 rounded-lg border-2 border-green-700 bg-green-50 p-4 text-green-950">
          <p className="font-semibold">This survey is active. Close this survey to edit it.</p>
          <Link to={`/surveys/${surveyId}/present`} className="btn-secondary mt-3">
            Go to Present page
          </Link>
        </div>
      )
    }
    if (status === 'archived') {
      return (
        <p className="mb-6 rounded-lg border-2 border-slate-500 bg-slate-50 p-4 font-semibold">
          Archived surveys can't be edited. Duplicate it from the dashboard to reuse the questions.
        </p>
      )
    }
    if (responseCount > 0) {
      return (
        <p className="mb-6 rounded-lg border-2 border-amber-700 bg-amber-50 p-4 text-amber-950">
          <strong>This survey already has responses.</strong> Its questions and choices can't be
          changed, because that would delete the answers students gave. You can still edit the title
          and description. To change the questions, duplicate the survey from the dashboard.
        </p>
      )
    }
    return null
  }

  function renderConfirm() {
    if (blocker.state === 'blocked') {
      return (
        <ConfirmDialog
          title="Leave without saving?"
          confirmLabel="Leave page"
          danger
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        >
          <p>You have unsaved changes. They will be lost if you leave this page.</p>
        </ConfirmDialog>
      )
    }
    if (!confirm) return null
    if (confirm.kind === 'deleteQuestion') {
      return (
        <ConfirmDialog
          title={`Delete question ${confirm.number}?`}
          confirmLabel="Delete Question"
          danger
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        >
          <p>This removes the question and its choices from the survey.</p>
        </ConfirmDialog>
      )
    }
    if (confirm.kind === 'changeType') {
      return (
        <ConfirmDialog
          title="Switch to True / False?"
          confirmLabel="Switch type"
          danger
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        >
          <p>The choices you typed will be replaced with "True" and "False".</p>
        </ConfirmDialog>
      )
    }
    return (
      <ConfirmDialog
        title="Activate this survey?"
        confirmLabel="Activate"
        pending={activating}
        pendingLabel="Activating..."
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      >
        <p>This will close "{confirm.otherTitle}". Only one survey can be active at a time.</p>
      </ConfirmDialog>
    )
  }

  function saveStatusText() {
    if (saveState === 'saving') return activating ? 'Saving and activating...' : 'Saving...'
    if (saveState === 'error') return ''
    if (dirty) return 'Unsaved changes'
    if (saveState === 'saved') return 'Saved'
    return ''
  }

  const title = id ? 'Edit Survey' : 'New Survey'
  const backLink = (
    <Link to="/dashboard" className="btn-secondary">
      Back to Dashboard
    </Link>
  )

  if (loading) {
    return (
      <InstructorLayout title={title} actions={backLink}>
        <LoadingState message="Loading survey..." />
      </InstructorLayout>
    )
  }
  if (loadError) {
    return (
      <InstructorLayout title={title} actions={backLink}>
        <ErrorMessage message={loadError} onRetry={() => id && load(id)} />
      </InstructorLayout>
    )
  }

  return (
    <InstructorLayout title={title} actions={backLink}>
      {surveyId && (
        <p className="-mt-3 mb-4 flex items-center gap-2 text-slate-700">
          Status: <StatusBadge status={status} />
        </p>
      )}
      {renderNotice()}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <fieldset disabled={readOnly || busy} className="space-y-4">
          <div>
            <label htmlFor="survey-title" className="label">
              Survey Title <span aria-hidden="true">*</span>
            </label>
            <input
              id="survey-title"
              className="input"
              required
              value={draft.title}
              onChange={(e) => edited((d) => ({ ...d, title: e.target.value }))}
              {...inputProps(errorKeys.title, 'title-error')}
            />
            <FieldError id="title-error" message={visibleErrors[errorKeys.title]} />
          </div>
          <div>
            <label htmlFor="survey-description" className="label">
              Description <span className="font-normal text-slate-700">(optional)</span>
            </label>
            <textarea
              id="survey-description"
              className="input"
              rows={2}
              value={draft.description}
              onChange={(e) => edited((d) => ({ ...d, description: e.target.value }))}
            />
          </div>
        </fieldset>

        <fieldset disabled={structureLocked || busy} className="space-y-4">
          <legend className="sr-only">Questions</legend>
          {draft.questions.map(renderQuestion)}
          <FieldError id="questions-error" message={visibleErrors[errorKeys.questions]} />
          <button id="add-question" type="button" className="btn-secondary" onClick={addQuestion}>
            + Add Question
          </button>
        </fieldset>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-300 pt-6">
            <button type="submit" className="btn-secondary" disabled={busy}>
              {status === 'closed' ? 'Save Changes' : 'Save Draft'}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={handleActivateClick}
            >
              {activating ? 'Activating...' : 'Activate'}
            </button>
            <span role="status" aria-live="polite" className="font-medium text-slate-700">
              {saveStatusText()}
            </span>
          </div>
        )}
        {saveState === 'error' && saveMessage && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-900">
            {saveMessage}
          </p>
        )}
      </form>

      {renderConfirm()}
    </InstructorLayout>
  )
}
