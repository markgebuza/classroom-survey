import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd())
  if (command === 'build' && (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY)) {
    // Vite inlines env vars at build time; without them the bundle only contains the
    // "Missing Supabase configuration" error from src/lib/supabase.ts.
    console.warn(
      '\nWARNING: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. The built app will only show a configuration error. Set them in .env.local or in the Cloudflare Pages build settings.\n',
    )
  }

  return {
    plugins: [react(), tailwindcss()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  }
})
