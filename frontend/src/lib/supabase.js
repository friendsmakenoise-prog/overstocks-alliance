import { createClient } from '@supabase/supabase-js'

// These are public keys — safe to use in frontend code
// The anon key has no special permissions — all access control
// is enforced by Row Level Security policies in the database
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://znokvmygtiybhjvltzwq.supabase.co'
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpub2t2bXlndGl5Ymhqdmx0endxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjQyMTEsImV4cCI6MjA5MjIwMDIxMX0.1BOXsxNdsfLu2d45Ht3JTKqvqB2iPws9TLRDTVaAJkY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
