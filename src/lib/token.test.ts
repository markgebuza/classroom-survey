import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getAnonymousToken,
  hasSubmitted,
  markSubmitted,
  randomToken,
  SUBMITTED_KEY,
  TOKEN_KEY,
} from './token'

describe('anonymous token', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('creates one token per browser and reuses it', () => {
    const first = getAnonymousToken()
    expect(first).toMatch(/^[0-9a-f-]{32,36}$/)
    expect(localStorage.getItem(TOKEN_KEY)).toBe(first)
    expect(getAnonymousToken()).toBe(first)
  })

  it('falls back to an in-memory token when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const token = getAnonymousToken()
    expect(token).toBeTruthy()
    expect(getAnonymousToken()).toBe(token)
  })

  it('works without crypto.randomUUID (insecure http context)', () => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      expect(randomToken()).toMatch(/^[0-9a-f]{32}$/)
    } finally {
      delete (crypto as { randomUUID?: unknown }).randomUUID
    }
  })
})

describe('submitted surveys', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('remembers submitted survey ids', () => {
    expect(hasSubmitted('s1')).toBe(false)
    markSubmitted('s1')
    markSubmitted('s1')
    expect(hasSubmitted('s1')).toBe(true)
    expect(JSON.parse(localStorage.getItem(SUBMITTED_KEY)!)).toEqual(['s1'])
  })

  it('ignores corrupted storage', () => {
    localStorage.setItem(SUBMITTED_KEY, '{not json')
    expect(hasSubmitted('s2')).toBe(false)
  })

  it('still remembers in memory when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    markSubmitted('s3')
    expect(hasSubmitted('s3')).toBe(true)
  })
})
