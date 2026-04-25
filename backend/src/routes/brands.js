const express = require('express')
const router = express.Router()
const { supabaseAdmin } = require('../../config/supabase')
const { requireAuth } = require('../middleware/auth')

/**
 * GET /api/brands/public
 * Returns all active brands — authenticated users only.
 * Uses admin client to bypass RLS so all brands are visible
 * regardless of the user's brand permissions.
 * Used by BrandAccessPage to show brands available to apply for.
 */
router.get('/public', requireAuth, async (req, res) => {
  try {
    const { data: brands, error } = await supabaseAdmin
      .from('brands')
      .select('id, name, slug')
      .eq('status', 'active')
      .order('name')

    if (error) throw error
    res.json({ brands })
  } catch (err) {
    console.error('Get public brands error:', err)
    res.status(500).json({ error: 'Failed to fetch brands' })
  }
})

module.exports = router
