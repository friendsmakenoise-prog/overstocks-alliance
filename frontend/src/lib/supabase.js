import { createClient } from '@supabase/supabase-js'

// Public (anon) key — safe to use in the frontend
// Real access control is enforced by Row Level Security in the database
export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
)
