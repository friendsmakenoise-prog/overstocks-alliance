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

/**
 * GET /api/brands/my-retailers
 * Supplier: get all retailers approved for any brand the supplier distributes
 * Returns company info for account management — clearly marked not for trading use
 */
router.get('/my-retailers', requireAuth, async (req, res) => {
  try {
    // Get brands this supplier distributes
    const { data: distributions } = await supabaseAdmin
      .from('supplier_brand_distributions')
      .select('brand_id, brand:brand_id(id, name)')
      .eq('supplier_id', req.user.id)
      .eq('verified', true)

    const brandIds = (distributions || []).map(d => d.brand_id).filter(Boolean)

    if (brandIds.length === 0) {
      return res.json({ retailers: [], brands: [] })
    }

    // Get all active permissions for these brands
    const { data: permissions } = await supabaseAdmin
      .from('brand_permissions')
      .select(`
        brand_id,
        brand:brand_id ( id, name ),
        user:user_id (
          id, company_name, contact_name, email, phone, website,
          anonymous_handle, status, created_at, approved_at
        )
      `)
      .in('brand_id', brandIds)
      .is('revoked_at', null)
      .eq('user:user_id.role', 'retailer')
      .eq('user:user_id.status', 'approved')

    // Group by retailer, collect their brands
    const retailerMap = {}
    for (const perm of permissions || []) {
      if (!perm.user) continue
      const uid = perm.user.id
      if (!retailerMap[uid]) {
        retailerMap[uid] = { ...perm.user, brands: [] }
      }
      if (perm.brand) {
        retailerMap[uid].brands.push(perm.brand)
      }
    }

    const brands = (distributions || []).map(d => d.brand).filter(Boolean)

    res.json({
      retailers: Object.values(retailerMap),
      brands
    })
  } catch (err) {
    console.error('My retailers error:', err)
    res.status(500).json({ error: 'Failed to fetch retailers' })
  }
})

module.exports = router
