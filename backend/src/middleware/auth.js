const { createClient } = require('@supabase/supabase-js')

// ============================================================
// AUTH MIDDLEWARE
// Verifies the user's session token on every protected request.
// Attaches user profile to req.user so routes can use it.
// ============================================================

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authentication token provided' })
    }

    const token = authHeader.split(' ')[1]

    // Create a client scoped to this user's token
    const supabaseUser = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Verify the token with Supabase auth
    const { data: { user }, error } = await supabaseUser.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired session' })
    }

    // Fetch the user's profile (role, status, etc.)
    const { data: profile, error: profileError } = await supabaseUser
      .from('user_profiles')
      .select('id, role, status, anonymous_handle')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return res.status(401).json({ error: 'User profile not found' })
    }

    // Block suspended or pending users from all protected routes
    if (profile.status === 'pending') {
      return res.status(403).json({
        error: 'Account pending approval',
        code: 'ACCOUNT_PENDING'
      })
    }

    if (profile.status === 'suspended' || profile.status === 'rejected') {
      return res.status(403).json({
        error: 'Account access denied',
        code: 'ACCOUNT_SUSPENDED'
      })
    }

    // Attach user info to request for use in route handlers
    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role,
      status: profile.status,
      anonymousHandle: profile.anonymous_handle
    }

    next()
  } catch (err) {
    console.error('Auth middleware error:', err)
    res.status(500).json({ error: 'Authentication check failed' })
  }
}

// Middleware: require a specific role
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role
      })
    }
    next()
  }
}

module.exports = { requireAuth, requireRole }
