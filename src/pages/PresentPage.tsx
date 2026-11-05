import { toDataURL } from 'qrcode'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorMessage from '../components/ErrorMessage'
import LoadingState from '../components/LoadingState'
import MinimalLayout from '../components/MinimalLayout'
import StatusBadge from '../components/StatusBadge'
import {
  activateSurvey,
  closeSurvey,
  countResponses,
  getOtherActiveSurvey,
  getSurvey,
} from '../lib/api/surveys'
import { reportError } from '../lib/errors'
import type { Survey } from '../lib/types'
import { publicSurveyUrl, qrFileName } from '../lib/urls'

export const POLL_INTERVAL_MS = 5000

type Confirm = { kind: 'close' } | { kind: 'activate'; otherTitle: string }

export default function PresentPage() {
  const { id = '' } = useParams()
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [count, setCount] = useState<number | null>(null)
  const [countError, setCountError] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState('')
  const [fullscreen, setFullscreen] = useState(false)

  const isActive = survey?.status === 'active' && Boolean(survey.public_slug)
  const url = isActive ? publicSurveyUrl(survey!.public_slug!) : ''

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      setSurvey(await getSurvey(id))
    } catch (err) {
      setLoadError(reportError(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    load()
  }, [load])

  useEffect(() => {
    if (!url) return
    let cancelled = false
    toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 1024,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((dataUrl) => !cancelled && setQrDataUrl(dataUrl))
      .catch((err) => !cancelled && setActionError(reportError(err)))
    return () => {
      cancelled = true
    }
  }, [url])

  useEffect(() => {
    if (!isActive) return
    let cancelled = false
    const poll = async () => {
      try {
        const latest = await countResponses(id)
        if (!cancelled) {
          setCount(latest)
          setCountError(false)
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) setCountError(true)
      }
    }
    poll()
    const timer = window.setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [id, isActive])

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch (err) {
      console.error(err)
    }
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url)
      setCopyStatus('Copied!')
    } catch (err) {
      console.error(err)
      setCopyStatus('Could not copy. Select the address and copy it manually.')
    }
  }

  async function requestActivate() {
    setActionError('')
    try {
      const other = await getOtherActiveSurvey(id)
      if (other) setConfirm({ kind: 'activate', otherTitle: other.title })
      else await runAction(() => activateSurvey(id))
    } catch (err) {
      setActionError(reportError(err))
    }
  }

  async function runAction(action: () => Promise<unknown>) {
    setPending(true)
    setActionError('')
    try {
      await action()
      setConfirm(null)
      setCount(null)
      setQrDataUrl('')
      await load()
    } catch (err) {
      setActionError(reportError(err))
    } finally {
      setPending(false)
    }
  }

  function handleConfirm() {
    if (!confirm) return
    runAction(() => (confirm.kind === 'close' ? closeSurvey(id) : activateSurvey(id)))
  }

  if (loading && !survey) {
    return (
      <MinimalLayout pageTitle="Present">
        <LoadingState message="Loading survey..." />
      </MinimalLayout>
    )
  }
  if (loadError || !survey) {
    return (
      <MinimalLayout pageTitle="Present">
        <h1 className="sr-only">Present survey</h1>
        <ErrorMessage message={loadError || 'Survey not found.'} onRetry={load} />
        <Link to="/dashboard" className="btn-secondary mt-4">
          Back to Dashboard
        </Link>
      </MinimalLayout>
    )
  }

  return (
    <MinimalLayout pageTitle={`Present: ${survey.title}`} wide>
      <h1 className="max-w-6xl text-3xl font-bold sm:text-5xl lg:text-6xl">{survey.title}</h1>

      {isActive ? (
        <>
          <div className="my-6 flex w-full justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code that opens ${url}`}
                className="aspect-square w-[min(60vh,90vw)] max-w-full border-4 border-slate-950"
              />
            ) : (
              <div
                role="status"
                className="flex aspect-square w-[min(60vh,90vw)] items-center justify-center border-4 border-dashed border-slate-400 text-xl"
              >
                Generating QR code...
              </div>
            )}
          </div>

          <p
            className="font-mono text-2xl font-bold break-all sm:text-4xl"
            aria-label="Survey address"
          >
            {url}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            <button type="button" className="btn-secondary" onClick={copyUrl}>
              Copy link
            </button>
            <span role="status" aria-live="polite" className="text-slate-800">
              {copyStatus}
            </span>
          </div>

          <div className="mt-6" aria-live="polite">
            {count === null ? (
              <p className="text-2xl text-slate-700">Counting responses...</p>
            ) : count === 0 ? (
              <p className="text-2xl sm:text-3xl">
                No responses yet. Display the QR code so students can join.
              </p>
            ) : (
              <p className="text-3xl font-bold sm:text-5xl">Responses: {count}</p>
            )}
            {countError && (
              <p className="mt-2 text-lg text-amber-900">
                Could not refresh the response count. Retrying...
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="my-10 max-w-xl space-y-4 text-xl">
          <p className="flex items-center justify-center gap-2">
            Status: <StatusBadge status={survey.status} />
          </p>
          <p>This survey is not active, so students can't open it.</p>
          {(survey.status === 'draft' || survey.status === 'closed') && (
            <button
              type="button"
              className="btn-primary text-xl"
              disabled={pending}
              onClick={requestActivate}
            >
              {pending ? 'Activating...' : 'Activate Survey'}
            </button>
          )}
        </div>
      )}

      {actionError && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-lg text-red-900">
          {actionError}
        </p>
      )}

      <nav aria-label="Survey actions" className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to={`/surveys/${id}/results`} className="btn-primary text-lg">
          View Results
        </Link>
        {isActive && (
          <>
            <button
              type="button"
              className="btn-secondary text-lg"
              disabled={pending}
              onClick={() => setConfirm({ kind: 'close' })}
            >
              Close Survey
            </button>
            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download={qrFileName(survey.public_slug!)}
                className="btn-secondary text-lg"
              >
                Download QR
              </a>
            )}
          </>
        )}
        <button
          type="button"
          className="btn-secondary text-lg"
          onClick={toggleFullscreen}
          aria-pressed={fullscreen}
        >
          {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
        <Link to="/dashboard" className="btn-secondary text-lg">
          Back to Dashboard
        </Link>
      </nav>

      {confirm?.kind === 'close' && (
        <ConfirmDialog
          title={`Close "${survey.title}"?`}
          confirmLabel="Close Survey"
          pendingLabel="Closing..."
          pending={pending}
          error={actionError}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        >
          <p>Students will no longer be able to submit responses.</p>
        </ConfirmDialog>
      )}
      {confirm?.kind === 'activate' && (
        <ConfirmDialog
          title={`Activate "${survey.title}"?`}
          confirmLabel="Activate"
          pendingLabel="Activating..."
          pending={pending}
          error={actionError}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        >
          <p>This will close "{confirm.otherTitle}". Only one survey can be active at a time.</p>
        </ConfirmDialog>
      )}
    </MinimalLayout>
  )
}
