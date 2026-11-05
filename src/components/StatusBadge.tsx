import type { SurveyStatus } from '../lib/types'

const STYLES: Record<SurveyStatus, string> = {
  draft: 'border-slate-400 bg-slate-100 text-slate-900',
  active: 'border-green-700 bg-green-100 text-green-900',
  closed: 'border-amber-700 bg-amber-100 text-amber-900',
  archived: 'border-slate-500 bg-white text-slate-700',
}

const STATUS_LABELS: Record<SurveyStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
  archived: 'Archived',
}

export default function StatusBadge({ status }: { status: SurveyStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-3 py-0.5 text-sm font-semibold ${STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
