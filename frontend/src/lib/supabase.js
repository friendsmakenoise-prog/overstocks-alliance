import { createClient } from '@supabase/supabase-js'

// ============================================================
// SUPABASE CLIENT
// Public anon key — safe to use in frontend code.
// All access control is enforced by Row Level Security.
// ============================================================

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://znokvmygtiybhjvltzwq.supabase.co'
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpub2t2bXlndGl5Ymhqdmx0endxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjQyMTEsImV4cCI6MjA5MjIwMDIxMX0.1BOXsxNdsfLu2d45Ht3JTKqvqB2iPws9TLRDTVaAJkY'

// Clear expired Supabase sessions before initialising the client.
// Supabase stores sessions in localStorage under a key starting with 'sb-'.
// If the token is expired and can't be refreshed, it causes the app
// to hang indefinitely. We detect and clear it before it causes problems.
try {
  const keys = Object.keys(localStorage)
  for (const key of keys) {
    if (key.startsWith('sb-')) {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const parsed = JSON.parse(raw)
        const session = parsed?.session || parsed
        const expiresAt = session?.expires_at

        if (expiresAt) {
          const now = Math.floor(Date.now() / 1000)
          // Add a 60 second buffer — clear tokens expiring very soon too
          if (expiresAt < now + 60) {
            localStorage.removeItem(key)
            console.log('Cleared expired Supabase session')
          }
        }
      } catch {
        // Corrupt entry — remove it
        localStorage.removeItem(key)
      }
    }
  }
} catch {
  // localStorage not available (e.g. Safari private mode) — that's fine
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})
