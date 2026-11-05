export const TOKEN_KEY = 'classroom-survey.anonymous-token'
export const SUBMITTED_KEY = 'classroom-survey.submitted-surveys'

let memoryToken: string | null = null
const memorySubmitted = new Set<string>()

/**
 * crypto.randomUUID only exists in secure contexts (HTTPS or localhost). A phone opening the dev
 * server over http://192.168.x.x has no randomUUID, so fall back to getRandomValues.
 */
export function randomToken(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** One random token per browser, kept in localStorage (or memory if storage is blocked). */
export function getAnonymousToken(): string {
  try {
    let token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      token = randomToken()
      localStorage.setItem(TOKEN_KEY, token)
    }
    return token
  } catch {
    memoryToken ??= randomToken()
    return memoryToken
  }
}

function readSubmitted(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SUBMITTED_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function hasSubmitted(surveyId: string): boolean {
  return memorySubmitted.has(surveyId) || readSubmitted().includes(surveyId)
}

export function markSubmitted(surveyId: string): void {
  memorySubmitted.add(surveyId)
  try {
    const ids = readSubmitted()
    if (!ids.includes(surveyId))
      localStorage.setItem(SUBMITTED_KEY, JSON.stringify([...ids, surveyId]))
  } catch {
    // Storage blocked (e.g. some private modes): the in-memory set and the database still protect.
  }
}
