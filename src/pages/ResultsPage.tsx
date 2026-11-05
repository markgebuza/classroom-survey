import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ErrorMessage from '../components/ErrorMessage'
import InstructorLayout from '../components/InstructorLayout'
import LoadingState from '../components/LoadingState'
import ResultsChart from '../components/ResultsChart'
import StatusBadge from '../components/StatusBadge'
import { getSurvey, getSurveyResults, listResponsesWithAnswers } from '../lib/api/surveys'
import { buildResultsCsv, csvFileName, downloadCsv } from '../lib/csv'
import { reportError } from '../lib/errors'
import { chartRows, formatPercent, pluralize } from '../lib/results'
import type { Survey, SurveyResults } from '../lib/types'

export default function ResultsPage() {
  const { id = '' } = useParams()
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [results, setResults] = useState<SurveyResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [loadedSurvey, loadedResults] = await Promise.all([getSurvey(id), getSurveyResults(id)])
      setSurvey(loadedSurvey)
      setResults(loadedResults)
      setUpdatedAt(new Date())
    } catch (err) {
      setError(reportError(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    load()
  }, [load])

  async function handleExport() {
    setExporting(true)
    setExportError('')
    try {
      const [fullSurvey, responses] = await Promise.all([
        getSurvey(id),
        listResponsesWithAnswers(id),
      ])
      const exportedAt = new Date()
      downloadCsv(
        csvFileName(fullSurvey.title, exportedAt),
        buildResultsCsv(fullSurvey, responses, exportedAt),
      )
    } catch (err) {
      setExportError(reportError(err))
    } finally {
      setExporting(false)
    }
  }

  const actions = (
    <>
      <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
        {loading && results ? 'Refreshing...' : 'Refresh'}
      </button>
      <button
        type="button"
        className="btn-secondary"
        onClick={handleExport}
        disabled={exporting || !survey}
      >
        {exporting ? 'Exporting...' : 'Export CSV'}
      </button>
      {survey?.status === 'active' && (
        <Link to={`/surveys/${id}/present`} className="btn-secondary">
          Present QR
        </Link>
      )}
      <Link to="/dashboard" className="btn-secondary">
        Back to Dashboard
      </Link>
    </>
  )

  function renderBody() {
    if (loading && !results) return <LoadingState message="Loading results..." />
    if (error && !results) return <ErrorMessage message={error} onRetry={load} />
    if (!survey || !results) return null
    return (
      <>
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-lg">
          <h2 className="text-2xl font-bold text-slate-900">{survey.title}</h2>
          <StatusBadge status={survey.status} />
          <p className="font-semibold" aria-live="polite">
            {pluralize(results.response_count, 'response')}
          </p>
          {updatedAt && (
            <p className="text-sm text-slate-700">Updated {updatedAt.toLocaleTimeString()}</p>
          )}
        </div>
        {(error || exportError) && (
          <div className="mb-4">
            <ErrorMessage message={error || exportError} />
          </div>
        )}
        {results.response_count === 0 && (
          <p className="mb-6 rounded-xl border border-dashed border-slate-400 bg-white p-6 text-center text-lg">
            No responses yet.
            {survey.status === 'active' && ' Display the QR code so students can join.'}
          </p>
        )}
        <ol className="space-y-6">
          {results.questions.map((question, index) => {
            const rows = chartRows(question)
            return (
              <li
                key={question.question_id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <section aria-labelledby={`result-${question.question_id}`}>
                  <h3 id={`result-${question.question_id}`} className="text-xl font-bold">
                    {index + 1}. {question.question_text}
                  </h3>
                  <p className="mb-3 text-slate-700">
                    {pluralize(question.response_count, 'answer')}
                  </p>
                  {question.response_count === 0 ? (
                    <p className="font-semibold text-slate-800">No answers</p>
                  ) : (
                    <ResultsChart rows={rows} />
                  )}
                  <table className="mt-3 w-full text-left">
                    <caption className="sr-only">Answers for question {index + 1}</caption>
                    <thead>
                      <tr className="border-b border-slate-300 text-slate-700">
                        <th scope="col" className="py-1 pr-2 font-semibold">
                          Choice
                        </th>
                        <th scope="col" className="py-1 pr-2 text-right font-semibold">
                          Count
                        </th>
                        <th scope="col" className="py-1 text-right font-semibold">
                          Percent
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, rowIndex) => (
                        <tr
                          key={question.choices[rowIndex].choice_id}
                          className="border-b border-slate-100"
                        >
                          <th scope="row" className="py-1 pr-2 font-normal">
                            {row.fullLabel}
                          </th>
                          <td className="py-1 pr-2 text-right tabular-nums">{row.count}</td>
                          <td className="py-1 text-right tabular-nums">
                            {formatPercent(row.percentage)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </li>
            )
          })}
        </ol>
      </>
    )
  }

  return (
    <InstructorLayout title="Results" actions={actions}>
      {renderBody()}
    </InstructorLayout>
  )
}
