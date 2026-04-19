const { createClient } = require('@supabase/supabase-js')

// Service role client — has full database access, bypasses RLS
// Used ONLY in backend — NEVER expose this key to the frontend
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

module.exports = { supabaseAdmin }
