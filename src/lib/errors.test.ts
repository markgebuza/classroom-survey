import { describe, expect, it } from 'vitest'
import { friendlyError, MESSAGES } from './errors'

describe('friendlyError', () => {
  it.each([
    [{ message: 'DUPLICATE_RESPONSE', code: 'P0001' }, MESSAGES.duplicate],
    [{ message: 'SURVEY_NOT_ACTIVE', code: 'P0001' }, MESSAGES.closed],
    [{ message: 'MISSING_REQUIRED_ANSWER', code: 'P0001' }, MESSAGES.missingAnswer],
    [{ message: 'INVALID_QUESTION', code: 'P0001' }, MESSAGES.validation],
    [{ message: 'INVALID_CHOICE', code: 'P0001' }, MESSAGES.validation],
    [{ message: 'SURVEY_NOT_FOUND', code: 'P0001' }, MESSAGES.notFound],
    [
      { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
      MESSAGES.notFound,
    ],
    [{ message: 'invalid input syntax for type uuid: "abc"', code: '22P02' }, MESSAGES.notFound],
    [{ message: 'SURVEY_ARCHIVED', code: 'P0001' }, MESSAGES.archived],
    [{ message: 'SURVEY_HAS_NO_QUESTIONS', code: 'P0001' }, MESSAGES.noQuestions],
    [{ message: 'Invalid login credentials', status: 400 }, MESSAGES.invalidLogin],
    [{ message: 'permission denied for table responses', code: '42501' }, MESSAGES.authRequired],
    [{ message: 'JWT expired', code: 'PGRST301' }, MESSAGES.authRequired],
    [new TypeError('Failed to fetch'), MESSAGES.network],
    [
      { message: 'duplicate key value violates unique constraint "x"', code: '23505' },
      MESSAGES.unexpected,
    ],
    ['something odd', MESSAGES.unexpected],
  ])('maps %j to a friendly message', (error, expected) => {
    expect(friendlyError(error)).toBe(expected)
  })
})
