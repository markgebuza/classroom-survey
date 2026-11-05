import type { Session } from '@supabase/supabase-js'
import { vi } from 'vitest'

/** Minimal fake of the parts of the Supabase client the app uses. */
export function createSupabaseMock() {
  let session: Session | null = null
  const listeners: Array<(event: string, s: Session | null) => void> = []

  const auth = {
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    onAuthStateChange: vi.fn((cb: (event: string, s: Session | null) => void) => {
      listeners.push(cb)
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
    signInWithPassword: vi.fn(async () => ({ data: {}, error: null as unknown })),
    signOut: vi.fn(async () => {
      session = null
      listeners.forEach((cb) => cb('SIGNED_OUT', null))
      return { error: null }
    }),
  }

  return {
    client: { auth, from: vi.fn(), rpc: vi.fn() },
    setSession(email: string | null) {
      session = email ? ({ user: { id: 'user-1', email } } as unknown as Session) : null
    },
    emit(email: string | null) {
      this.setSession(email)
      listeners.forEach((cb) => cb(email ? 'SIGNED_IN' : 'SIGNED_OUT', session))
    },
  }
}
