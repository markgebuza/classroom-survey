import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorMessage from '../components/ErrorMessage'
import InstructorLayout from '../components/InstructorLayout'
import LoadingState from '../components/LoadingState'
import StatusBadge from '../components/StatusBadge'
import {
  activateSurvey,
  archiveSurvey,
  closeSurvey,
  deleteSurvey,
  duplicateSurvey,
  listSurveys,
  type SurveyListItem,
} from '../lib/api/surveys'
import { reportError } from '../lib/errors'
import {
  EMPTY_FILTERS,
  filterSurveys,
  formatDate,
  hasActiveFilters,
  type SurveyFilters,
} from '../lib/filters'
import type { SurveyStatus } from '../lib/types'

type ConfirmKind = 'delete' | 'archive' | 'close' | 'activate'

interface PendingConfirm {
  kind: ConfirmKind
  survey: SurveyListItem
  otherActive?: SurveyListItem
}

const STATUS_OPTIONS: Array<{ value: SurveyStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
]

function responsesLabel(count: number) {
  return count === 1 ? '1 response' : `${count} responses`
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [surveys, setSurveys] = useState<SurveyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filters, setFilters] = useState<SurveyFilters>(EMPTY_FILTERS)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [cardError, setCardError] = useState<{ id: string; message: string } | null>(null)
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null)
  const [confirmError, setConfirmError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      setSurveys(await listSurveys())
    } catch (err) {
      setLoadError(reportError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    load()
  }, [load])

  const visible = useMemo(() => filterSurveys(surveys, filters), [surveys, filters])

  async function run(survey: SurveyListItem, action: () => Promise<void>) {
    setBusyId(survey.id)
    setCardError(null)
    try {
      await action()
    } catch (err) {
      setCardError({ id: survey.id, message: reportError(err) })
    } finally {
      setBusyId(null)
    }
  }

  function handleActivate(survey: SurveyListItem) {
    const otherActive = surveys.find((s) => s.status === 'active' && s.id !== survey.id)
    if (otherActive) {
      setConfirmError('')
      setConfirm({ kind: 'activate', survey, otherActive })
      return
    }
    run(survey, async () => {
      await activateSurvey(survey.id)
      navigate(`/surveys/${survey.id}/present`)
    })
  }

  function handleDuplicate(survey: SurveyListItem) {
    run(survey, async () => {
      const newId = await duplicateSurvey(survey.id)
      navigate(`/surveys/${newId}/edit`)
    })
  }

  function openConfirm(kind: ConfirmKind, survey: SurveyListItem) {
    setConfirmError('')
    setConfirm({ kind, survey })
  }

  async function handleConfirm() {
    if (!confirm) return
    const { kind, survey } = confirm
    setBusyId(survey.id)
    setConfirmError('')
    try {
      if (kind === 'activate') {
        await activateSurvey(survey.id)
        navigate(`/surveys/${survey.id}/present`)
        return
      }
      if (kind === 'delete') await deleteSurvey(survey.id)
      if (kind === 'archive') await archiveSurvey(survey.id)
      if (kind === 'close') await closeSurvey(survey.id)
      setConfirm(null)
      await load()
    } catch (err) {
      setConfirmError(reportError(err))
    } finally {
      setBusyId(null)
    }
  }

  function renderActions(survey: SurveyListItem) {
    const busy = busyId !== null
    const edit = (
      <Link key="edit" to={`/surveys/${survey.id}/edit`} className="btn-secondary">
        Edit
      </Link>
    )
    const results = (
      <Link key="results" to={`/surveys/${survey.id}/results`} className="btn-secondary">
        Results
      </Link>
    )
    const present = (
      <Link key="present" to={`/surveys/${survey.id}/present`} className="btn-primary">
        Present
      </Link>
    )
    const activate = (
      <button
        key="activate"
        type="button"
        className="btn-primary"
        disabled={busy}
        onClick={() => handleActivate(survey)}
      >
        {busyId === survey.id && !confirm ? 'Working...' : 'Activate'}
      </button>
    )
    const duplicate = (
      <button
        key="duplicate"
        type="button"
        className="btn-secondary"
        disabled={busy}
        onClick={() => handleDuplicate(survey)}
      >
        Duplicate
      </button>
    )
    const archive = (
      <button
        key="archive"
        type="button"
        className="btn-secondary"
        disabled={busy}
        onClick={() => openConfirm('archive', survey)}
      >
        Archive
      </button>
    )
    const close = (
      <button
        key="close"
        type="button"
        className="btn-secondary"
        disabled={busy}
        onClick={() => openConfirm('close', survey)}
      >
        Close
      </button>
    )
    const remove = (
      <button
        key="delete"
        type="button"
        className="btn-danger"
        disabled={busy}
        onClick={() => openConfirm('delete', survey)}
      >
        Delete
      </button>
    )

    switch (survey.status) {
      case 'draft':
        return [edit, activate, duplicate, archive, remove]
      case 'active':
        return [present, results, close, duplicate]
      case 'closed':
        return [results, edit, duplicate, archive, remove]
      case 'archived':
        return [results, duplicate, remove]
    }
  }

  function renderConfirm() {
    if (!confirm) return null
    const { kind, survey, otherActive } = confirm
    const pending = busyId === survey.id
    const common = {
      pending,
      error: confirmError,
      onConfirm: handleConfirm,
      onCancel: () => setConfirm(null),
    }
    if (kind === 'delete') {
      return (
        <ConfirmDialog
          {...common}
          title={`Delete "${survey.title}"?`}
          confirmLabel="Delete"
          pendingLabel="Deleting..."
          danger
        >
          <p>This will permanently delete the survey and all of its responses.</p>
          {survey.response_count > 0 && (
            <p className="rounded-lg border-2 border-red-700 bg-red-50 p-3 font-semibold text-red-900">
              Warning: this survey has {responsesLabel(survey.response_count)}. They will be
              permanently deleted and cannot be recovered. Consider archiving it instead.
            </p>
          )}
        </ConfirmDialog>
      )
    }
    if (kind === 'archive') {
      return (
        <ConfirmDialog
          {...common}
          title={`Archive "${survey.title}"?`}
          confirmLabel="Archive"
          pendingLabel="Archiving..."
        >
          <p>The survey and its results are kept. You can still view results and duplicate it.</p>
        </ConfirmDialog>
      )
    }
    if (kind === 'close') {
      return (
        <ConfirmDialog
          {...common}
          title={`Close "${survey.title}"?`}
          confirmLabel="Close Survey"
          pendingLabel="Closing..."
        >
          <p>Students will no longer be able to submit responses.</p>
        </ConfirmDialog>
      )
    }
    return (
      <ConfirmDialog
        {...common}
        title={`Activate "${survey.title}"?`}
        confirmLabel="Activate"
        pendingLabel="Activating..."
      >
        <p>This will close "{otherActive?.title}". Only one survey can be active at a time.</p>
      </ConfirmDialog>
    )
  }

  function renderBody() {
    if (loading) return <LoadingState message="Loading surveys..." />
    if (loadError) return <ErrorMessage message={loadError} onRetry={load} />
    if (surveys.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-slate-400 bg-white p-10 text-center">
          <p className="text-lg text-slate-800">You have not created any surveys yet.</p>
          <Link to="/surveys/new" className="btn-primary mt-4">
            Create Your First Survey
          </Link>
        </div>
      )
    }
    return (
      <>
        <section
          aria-label="Filter surveys"
          className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label htmlFor="search" className="label">
              Search
            </label>
            <input
              id="search"
              type="search"
              className="input"
              placeholder="Survey title"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="status" className="label">
              Status
            </label>
            <select
              id="status"
              className="input"
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value as SurveyFilters['status'] })
              }
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="created-from" className="label">
              Created from
            </label>
            <input
              id="created-from"
              type="date"
              className="input"
              value={filters.createdFrom}
              onChange={(e) => setFilters({ ...filters, createdFrom: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="created-to" className="label">
              Created to
            </label>
            <input
              id="created-to"
              type="date"
              className="input"
              value={filters.createdTo}
              onChange={(e) => setFilters({ ...filters, createdTo: e.target.value })}
            />
          </div>
        </section>

        {hasActiveFilters(filters) && (
          <p className="mb-4 text-slate-700" aria-live="polite">
            Showing {visible.length} of {surveys.length} surveys.{' '}
            <button
              type="button"
              className="font-semibold text-blue-800 underline"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Clear filters
            </button>
          </p>
        )}

        {visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-400 bg-white p-8 text-center text-lg">
            No surveys match your search.
          </p>
        ) : (
          <ul className="space-y-4">
            {visible.map((survey) => (
              <li
                key={survey.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h2 className="text-xl font-bold text-slate-900">{survey.title}</h2>
                <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-slate-700">
                  <div className="flex items-center gap-2">
                    <dt>Status:</dt>
                    <dd>
                      <StatusBadge status={survey.status} />
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>Created:</dt>
                    <dd>{formatDate(survey.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="sr-only">Responses</dt>
                    <dd>{responsesLabel(survey.response_count)}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">{renderActions(survey)}</div>
                {cardError?.id === survey.id && (
                  <p role="alert" className="field-error mt-3">
                    {cardError.message}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </>
    )
  }

  return (
    <InstructorLayout
      title="Dashboard"
      actions={
        <Link to="/surveys/new" className="btn-primary">
          New Survey
        </Link>
      }
    >
      {renderBody()}
      {renderConfirm()}
    </InstructorLayout>
  )
}
