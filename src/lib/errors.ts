export const MESSAGES = {
  network: 'Could not reach the server. Check your internet connection and try again.',
  authRequired: 'Your session has expired. Please log in again.',
  invalidLogin: 'Incorrect email or password.',
  notFound: 'Survey not found.',
  closed: 'This survey is no longer accepting responses.',
  duplicate: 'You have already submitted a response to this survey.',
  missingAnswer: 'Please answer every question before submitting.',
  validation: 'This survey has changed since you opened it. Please reload the page and try again.',
  archived: 'Archived surveys cannot be activated. Duplicate it to reuse the questions.',
  noQuestions: 'Add at least one question before activating this survey.',
  unexpected: 'Something went wrong. Please try again.',
} as const

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

function rawCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: unknown }).code)
  }
  return ''
}

/** Maps any Supabase/network/RPC error to a friendly message. Never returns raw DB text. */
export function friendlyError(error: unknown): string {
  const message = rawMessage(error)
  const code = rawCode(error)

  if (message.includes('DUPLICATE_RESPONSE')) return MESSAGES.duplicate
  if (message.includes('SURVEY_NOT_ACTIVE')) return MESSAGES.closed
  if (message.includes('MISSING_REQUIRED_ANSWER')) return MESSAGES.missingAnswer
  if (message.includes('INVALID_QUESTION') || message.includes('INVALID_CHOICE')) {
    return MESSAGES.validation
  }
  // PGRST116: .single() matched no row; 22P02: the id in the URL is not a valid UUID.
  if (message.includes('SURVEY_NOT_FOUND') || code === 'PGRST116' || code === '22P02') {
    return MESSAGES.notFound
  }
  if (message.includes('SURVEY_ARCHIVED')) return MESSAGES.archived
  if (message.includes('SURVEY_HAS_NO_QUESTIONS')) return MESSAGES.noQuestions
  if (message.includes('Invalid login credentials')) return MESSAGES.invalidLogin
  if (code === 'PGRST301' || code === '42501' || /JWT/i.test(message)) return MESSAGES.authRequired
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(message)) return MESSAGES.network
  return MESSAGES.unexpected
}

/** Logs the raw error for debugging and returns the friendly text for the UI. */
export function reportError(error: unknown): string {
  console.error(error)
  return friendlyError(error)
}
