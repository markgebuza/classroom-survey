import type { QuestionResult } from './types'

export interface ChartRow {
  label: string
  fullLabel: string
  count: number
  percentage: number
  display: string
}

/** 86.5 -> "86.5%", 50 -> "50.0%", always one decimal like the database rounding. */
export function formatPercent(value: number): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`
}

/** Same rule as get_survey_results: count / total * 100 rounded to 1 decimal, 0 when total is 0. */
export function percentage(count: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((count / total) * 1000) / 10
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

export function chartRows(question: QuestionResult, maxLabel = 28): ChartRow[] {
  return question.choices.map((choice) => {
    const count = Number(choice.count)
    const pct = Number(choice.percentage)
    return {
      label: truncate(choice.choice_text, maxLabel),
      fullLabel: choice.choice_text,
      count,
      percentage: pct,
      display: `${count} (${formatPercent(pct)})`,
    }
  })
}
