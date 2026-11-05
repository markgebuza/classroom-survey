import { describe, expect, it } from 'vitest'
import { EMPTY_FILTERS, filterSurveys, hasActiveFilters, localDateKey } from './filters'
import type { Survey } from './types'

function survey(title: string, status: Survey['status'], created: Date): Survey {
  return {
    id: title,
    title,
    description: null,
    status,
    public_slug: null,
    created_at: created.toISOString(),
    updated_at: created.toISOString(),
  }
}

const surveys = [
  survey('Recursion Check', 'draft', new Date(2026, 7, 17, 9, 0)),
  survey('Pointer Review', 'closed', new Date(2026, 8, 1, 23, 30)),
  survey('Recursion Part 2', 'archived', new Date(2026, 8, 15, 0, 15)),
]

describe('filterSurveys', () => {
  it('returns everything with empty filters', () => {
    expect(filterSurveys(surveys, EMPTY_FILTERS)).toHaveLength(3)
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
  })

  it('searches titles case-insensitively', () => {
    const result = filterSurveys(surveys, { ...EMPTY_FILTERS, search: '  recursion ' })
    expect(result.map((s) => s.title)).toEqual(['Recursion Check', 'Recursion Part 2'])
  })

  it('filters by status', () => {
    const result = filterSurveys(surveys, { ...EMPTY_FILTERS, status: 'closed' })
    expect(result.map((s) => s.title)).toEqual(['Pointer Review'])
  })

  it('filters by inclusive local created-date range', () => {
    const result = filterSurveys(surveys, {
      ...EMPTY_FILTERS,
      createdFrom: '2026-09-01',
      createdTo: '2026-09-15',
    })
    expect(result.map((s) => s.title)).toEqual(['Pointer Review', 'Recursion Part 2'])
  })

  it('combines search, status and dates', () => {
    const filters = {
      search: 'recursion',
      status: 'draft' as const,
      createdFrom: '2026-08-18',
      createdTo: '',
    }
    expect(filterSurveys(surveys, filters)).toHaveLength(0)
    expect(hasActiveFilters(filters)).toBe(true)
  })

  it('uses local dates', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59).toISOString())).toBe('2026-01-05')
  })
})
