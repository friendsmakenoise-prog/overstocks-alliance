const express = require('express')
const router = express.Router()
const { supabaseAdmin } = require('../../config/supabase')
const { requireAuth } = require('../middleware/auth')
const xss = require('xss')
const validator = require('validator')

// ============================================================
// AUTH ROUTES
// POST /api/auth/signup
// POST /api/auth/me
// ============================================================

/**
 * POST /api/auth/signup
 * Creates a new user account (status: pending)
 * User cannot access anything until admin approves them
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, role, companyName, contactName, phone } = req.body

    // --- Input validation ---
    if (!email || !password || !role || !companyName || !contactName) {
      return res.status(400).json({ error: 'All required fields must be provided' })
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' })
    }

    if (password.length < 12) {
      return res.status(400).json({ error: 'Password must be at least 12 characters' })
    }

    if (!['retailer', 'supplier'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role — must be retailer or supplier' })
    }

    // Sanitise text inputs to prevent XSS
    const safeCompanyName = xss(companyName.trim()).substring(0, 200)
    const safeContactName = xss(contactName.trim()).substring(0, 200)
    const safePhone = phone ? xss(phone.trim()).substring(0, 20) : null

    if (safeCompanyName.length < 2) {
      return res.status(400).json({ error: 'Company name too short' })
    }

    // --- Create Supabase auth user ---
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: false // They must confirm email first
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        return res.status(409).json({ error: 'An account with this email already exists' })
      }
      throw authError
    }

    // --- Generate anonymous handle ---
    const handle = `Seller #${authData.user.id.substring(0, 4).toUpperCase()}`

    // --- Create user profile ---
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email: email.toLowerCase().trim(),
        role,
        status: 'pending',
        company_name: safeCompanyName,
        contact_name: safeContactName,
        phone: safePhone,
        anonymous_handle: handle
      })

    if (profileError) {
      // Clean up auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw profileError
    }

    res.status(201).json({
      message: 'Account created. Please verify your email, then wait for admin approval.',
      userId: authData.user.id
    })
  } catch (err) {
    console.error('Signup error:', err)
    res.status(500).json({ error: 'Failed to create account' })
  }
})

/**
 * GET /api/auth/me
 * Returns the current user's profile (no sensitive fields)
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id, role, status, anonymous_handle, created_at')
      .eq('id', req.user.id)
      .single()

    if (error) throw error

    // Fetch their approved brands
    const { data: permissions } = await supabaseAdmin
      .from('brand_permissions')
      .select('brand_id, brands(id, name, slug)')
      .eq('user_id', req.user.id)
      .is('revoked_at', null)

    res.json({
      ...profile,
      email: req.user.email,
      approvedBrands: permissions?.map(p => p.brands) || []
    })
  } catch (err) {
    console.error('Get profile error:', err)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

module.exports = router
