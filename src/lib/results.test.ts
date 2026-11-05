import { describe, expect, it } from 'vitest'
import { chartRows, formatPercent, percentage, pluralize, truncate } from './results'
import type { QuestionResult } from './types'

describe('percentage', () => {
  it('matches the API.md example and the SQL rounding', () => {
    expect(percentage(45, 52)).toBe(86.5)
    expect(percentage(3, 52)).toBe(5.8)
    expect(percentage(2, 52)).toBe(3.8)
    expect(percentage(1, 3)).toBe(33.3)
    expect(percentage(2, 3)).toBe(66.7)
  })

  it('is 0 when there are no answers', () => {
    expect(percentage(0, 0)).toBe(0)
  })
})

describe('formatPercent', () => {
  it('always shows one decimal', () => {
    expect(formatPercent(86.5)).toBe('86.5%')
    expect(formatPercent(50)).toBe('50.0%')
    expect(formatPercent(0)).toBe('0.0%')
    expect(formatPercent(Number.NaN)).toBe('0.0%')
  })
})

describe('pluralize and truncate', () => {
  it('pluralizes counts', () => {
    expect(pluralize(1, 'response')).toBe('1 response')
    expect(pluralize(52, 'response')).toBe('52 responses')
    expect(pluralize(0, 'answer')).toBe('0 answers')
  })

  it('truncates long labels with an ellipsis', () => {
    expect(truncate('short', 10)).toBe('short')
    expect(truncate('a very long choice label', 10)).toBe('a very lo…')
  })
})

describe('chartRows', () => {
  it('builds labelled rows with count and percentage text', () => {
    const question: QuestionResult = {
      question_id: 'q1',
      question_text: 'What is required for recursion?',
      response_count: 52,
      choices: [
        { choice_id: 'c1', choice_text: 'A base case', count: 45, percentage: 86.5 },
        {
          choice_id: 'c2',
          choice_text: 'A pointer that points somewhere far away',
          count: 7,
          percentage: 13.5,
        },
      ],
    }
    const rows = chartRows(question, 20)
    expect(rows[0]).toEqual({
      label: 'A base case',
      fullLabel: 'A base case',
      count: 45,
      percentage: 86.5,
      display: '45 (86.5%)',
    })
    expect(rows[1].label).toBe('A pointer that poin…')
    expect(rows[1].fullLabel).toBe('A pointer that points somewhere far away')
  })
})
