import type { SurveyWithQuestions } from './types'

export interface ExportResponse {
  id: string
  submitted_at: string
  answers: { question_id: string; choice_id: string | null }[]
}

const FORMULA_PREFIX = /^[=+\-@\t\r]/
const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/
// Text Excel would turn into a date, number or boolean when opening a CSV (e.g. 1/2 -> 2-Jan).
const SPREADSHEET_COERCES = /^(?:(?=.*\d)[$€£¥]?[\d.][\d\s.,:/%-]*(?:\s?[ap]\.?m\.?)?|true|false)$/i

/**
 * One CSV cell: neutralises spreadsheet formulas (OWASP CSV injection: a leading = + - @, tab or
 * carriage return gets a ' prefix), writes text that a spreadsheet would convert as ="text" so it
 * is shown exactly as typed (DECISIONS.md D23), and applies RFC 4180 quoting.
 */
export function escapeCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value)
  if (FORMULA_PREFIX.test(text)) text = `'${text}`
  else if (typeof value === 'string' && SPREADSHEET_COERCES.test(text)) text = `="${text}"`
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n') + '\r\n'
}

export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  return slug || 'survey'
}

function localDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function csvFileName(title: string, exportedAt: Date): string {
  return `${slugify(title)}-results-${localDate(exportedAt)}.csv`
}

/**
 * Layout (DECISIONS.md D11): header row, one row per response, a blank line, then a
 * "Survey summary" section, so row 1 stays a real header for sorting/filtering.
 */
export function buildResultsCsv(
  survey: SurveyWithQuestions,
  responses: ExportResponse[],
  exportedAt: Date,
): string {
  const questions = [...survey.questions].sort((a, b) => a.position - b.position)
  const choiceText = new Map<string, string>()
  questions.forEach((q) => q.choices.forEach((c) => choiceText.set(c.id, c.choice_text)))

  const sorted = [...responses].sort((a, b) => a.submitted_at.localeCompare(b.submitted_at))
  const header = ['response_id', 'submitted_at', ...questions.map((q) => q.question_text)]
  const dataRows = sorted.map((response) => {
    const byQuestion = new Map(response.answers.map((a) => [a.question_id, a.choice_id]))
    return [
      response.id,
      new Date(response.submitted_at).toISOString(),
      ...questions.map((q) => {
        const choiceId = byQuestion.get(q.id)
        return choiceId ? (choiceText.get(choiceId) ?? '') : ''
      }),
    ]
  })

  const summary = [
    [],
    ['Survey summary'],
    ['field', 'value'],
    ['title', survey.title],
    ['description', survey.description ?? ''],
    ['status', survey.status],
    ['survey_id', survey.id],
    ['created_at', new Date(survey.created_at).toISOString()],
    ['exported_at', exportedAt.toISOString()],
    ['response_count', responses.length],
    ['question_count', questions.length],
  ]

  return toCsv([header, ...dataRows, ...summary])
}

/** UTF-8 BOM so Excel detects the encoding (accented characters, emoji). */
export const UTF8_BOM = '﻿'

export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob([UTF8_BOM + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
