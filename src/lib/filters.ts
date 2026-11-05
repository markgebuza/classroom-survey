import type { Survey, SurveyStatus } from './types'

export interface SurveyFilters {
  search: string
  status: SurveyStatus | 'all'
  /** Inclusive local dates in yyyy-mm-dd form (value of <input type="date">), or ''. */
  createdFrom: string
  createdTo: string
}

export const EMPTY_FILTERS: SurveyFilters = {
  search: '',
  status: 'all',
  createdFrom: '',
  createdTo: '',
}

export function localDateKey(iso: string): string {
  const date = new Date(iso)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function filterSurveys<T extends Survey>(surveys: T[], filters: SurveyFilters): T[] {
  const search = filters.search.trim().toLowerCase()
  return surveys.filter((survey) => {
    if (search && !survey.title.toLowerCase().includes(search)) return false
    if (filters.status !== 'all' && survey.status !== filters.status) return false
    const created = localDateKey(survey.created_at)
    if (filters.createdFrom && created < filters.createdFrom) return false
    if (filters.createdTo && created > filters.createdTo) return false
    return true
  })
}

export function hasActiveFilters(filters: SurveyFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    filters.createdFrom !== '' ||
    filters.createdTo !== ''
  )
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
