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
    // Get brands from distributions, fall back to permissions
    const { data: distributions } = await supabaseAdmin
      .from('supplier_brand_distributions')
      .select('brand_id, brand:brand_id(id, name)')
      .eq('supplier_id', req.user.id)

    let brandIds = (distributions || []).map(d => d.brand_id).filter(Boolean)

    if (brandIds.length === 0) {
      const { data: perms } = await supabaseAdmin
        .from('brand_permissions')
        .select('brand_id')
        .eq('user_id', req.user.id)
        .is('revoked_at', null)
      brandIds = (perms || []).map(p => p.brand_id).filter(Boolean)
    }

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

/**
 * GET /api/brands/my-listings
 * Supplier: get ALL listings for brands they distribute,
 * regardless of who created the listing.
 */
router.get('/my-listings', requireAuth, async (req, res) => {
  try {
    // Get brands from distributions first
    const { data: distributions } = await supabaseAdmin
      .from('supplier_brand_distributions')
      .select('brand_id, brand:brand_id(id, name)')
      .eq('supplier_id', req.user.id)

    let brandIds = (distributions || []).map(d => d.brand_id).filter(Boolean)
    let brandData = (distributions || []).map(d => d.brand).filter(Boolean)

    // Fallback: if no distributions, use brand_permissions
    // (covers suppliers approved before the distributions flow existed)
    if (brandIds.length === 0) {
      const { data: perms } = await supabaseAdmin
        .from('brand_permissions')
        .select('brand_id, brand:brand_id(id, name)')
        .eq('user_id', req.user.id)
        .is('revoked_at', null)

      brandIds = (perms || []).map(p => p.brand_id).filter(Boolean)
      brandData = (perms || []).map(p => p.brand).filter(Boolean)
    }

    if (brandIds.length === 0) {
      return res.json({ listings: [], brands: [] })
    }

    // Build query filters
    const { status, brand_id, search } = req.query
    let query = supabaseAdmin
      .from('listings')
      .select(`
        id, title, description, price_pence, quantity,
        shipping_mode, shipping_cost_pence, image_urls,
        status, open_to_all, created_at, updated_at,
        brand:brand_id ( id, name )
      `)
      .in('brand_id', brandIds)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (brand_id) query = query.eq('brand_id', brand_id)

    const { data: listings, error } = await query
    if (error) throw error

    // Filter search client-side to avoid complex SQL
    const filtered = search
      ? (listings || []).filter(l =>
          l.title?.toLowerCase().includes(search.toLowerCase()) ||
          l.brand?.name?.toLowerCase().includes(search.toLowerCase())
        )
      : (listings || [])

    const brands = brandData

    res.json({ listings: filtered, brands })
  } catch (err) {
    console.error('Supplier brand listings error:', err)
    res.status(500).json({ error: 'Failed to fetch brand listings' })
  }
})

/**
 * POST /api/brands/listings/:id/toggle-open
 * Supplier: toggle open_to_all on any listing for their brand.
 * Verifies the listing's brand is in their distributions.
 */
router.post('/listings/:id/toggle-open', requireAuth, async (req, res) => {
  try {
    // Fetch the listing
    const { data: listing, error: fetchError } = await supabaseAdmin
      .from('listings')
      .select('id, brand_id, open_to_all, status')
      .eq('id', req.params.id)
      .single()

    if (fetchError || !listing) {
      return res.status(404).json({ error: 'Listing not found' })
    }

    // Verify this supplier distributes this brand
    // Check distributions first, fall back to permissions
    let authorised = false

    const { data: dist } = await supabaseAdmin
      .from('supplier_brand_distributions')
      .select('id')
      .eq('supplier_id', req.user.id)
      .eq('brand_id', listing.brand_id)
      .single()

    if (dist) {
      authorised = true
    } else {
      // Fallback: check brand_permissions
      const { data: perm } = await supabaseAdmin
        .from('brand_permissions')
        .select('id')
        .eq('user_id', req.user.id)
        .eq('brand_id', listing.brand_id)
        .is('revoked_at', null)
        .single()
      if (perm) authorised = true
    }

    if (!authorised) {
      return res.status(403).json({ error: 'Not authorised — this brand is not in your distribution list' })
    }

    const newValue = !listing.open_to_all

    const { error: updateError } = await supabaseAdmin
      .from('listings')
      .update({ open_to_all: newValue })
      .eq('id', req.params.id)

    if (updateError) throw updateError

    await supabaseAdmin.from('audit_log').insert({
      admin_id: req.user.id,
      action: newValue ? 'supplier_set_open_to_all' : 'supplier_removed_open_to_all',
      target_type: 'listing',
      target_id: req.params.id,
      metadata: { brand_id: listing.brand_id }
    })

    res.json({ open_to_all: newValue, message: newValue ? 'Listing opened to all retailers' : 'Listing restricted to authorised dealers' })
  } catch (err) {
    console.error('Toggle open to all error:', err)
    res.status(500).json({ error: 'Failed to update listing' })
  }
})

module.exports = router
