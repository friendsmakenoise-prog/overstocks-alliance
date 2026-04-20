const express = require('express')
const router = express.Router()
const { supabaseAdmin } = require('../../config/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')
const { getUserApprovedBrandIds, userHasBrandPermission } = require('../services/brandPermissions')
const xss = require('xss')

// ============================================================
// LISTINGS ROUTES
// All routes require authentication.
// Every query is filtered through brand permissions.
// seller_id is NEVER returned to non-admin users.
// ============================================================

/**
 * GET /api/listings
 * Returns listings for the user's approved brands only.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    // Step 1: Get this user's approved brand IDs
    const approvedBrandIds = await getUserApprovedBrandIds(req.user.id)

    if (approvedBrandIds.length === 0) {
      return res.json({ listings: [], total: 0 })
    }

    // Step 2: Build query — only active listings for approved brands
    let query = supabaseAdmin
      .from('listings')
      .select(`
        id,
        title,
        description,
        price_pence,
        quantity,
        shipping_mode,
        shipping_cost_pence,
        image_urls,
        status,
        view_count,
        created_at,
        brand_id,
        brands ( id, name, slug )
      `)
      .eq('status', 'active')
      .in('brand_id', approvedBrandIds)
      .order('created_at', { ascending: false })

    // Optional filters from query string
    if (req.query.brand_id) {
      // Validate the user is actually approved for this brand
      if (!approvedBrandIds.includes(req.query.brand_id)) {
        return res.status(403).json({ error: 'Not authorised for this brand' })
      }
      query = query.eq('brand_id', req.query.brand_id)
    }

    if (req.query.min_price) {
      query = query.gte('price_pence', parseInt(req.query.min_price) * 100)
    }

    if (req.query.max_price) {
      query = query.lte('price_pence', parseInt(req.query.max_price) * 100)
    }

    // Pagination
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 24, 100)
    const from = (page - 1) * limit
    query = query.range(from, from + limit - 1)

    const { data: listings, error, count } = await query

    if (error) throw error

    // NOTE: seller_id is deliberately NOT in the select() above.
    // It is never fetched, never returned.

    res.json({
      listings: listings || [],
      page,
      limit,
      total: count
    })
  } catch (err) {
    console.error('Listings fetch error:', err)
    res.status(500).json({ error: 'Failed to fetch listings' })
  }
})

/**
 * GET /api/listings/:id
 * Returns a single listing — only if user is approved for its brand.
 * This re-checks permission on every request (prevents IDOR).
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params

    // Fetch listing first (without seller info)
    const { data: listing, error } = await supabaseAdmin
      .from('listings')
      .select(`
        id,
        title,
        description,
        price_pence,
        quantity,
        shipping_mode,
        shipping_cost_pence,
        image_urls,
        status,
        view_count,
        created_at,
        brand_id,
        brands ( id, name, slug )
      `)
      .eq('id', id)
      .eq('status', 'active')
      .single()

    if (error || !listing) {
      return res.status(404).json({ error: 'Listing not found' })
    }

    // CRITICAL: Re-check brand permission for this specific listing
    // This prevents IDOR — someone guessing a listing ID gets nothing
    const hasPermission = await userHasBrandPermission(req.user.id, listing.brand_id)

    if (!hasPermission) {
      // Return 404 not 403 — don't confirm the listing exists
      return res.status(404).json({ error: 'Listing not found' })
    }

    // Increment view count (fire and forget — don't await)
    supabaseAdmin
      .from('listings')
      .update({ view_count: listing.view_count + 1 })
      .eq('id', id)
      .then()

    res.json({ listing })
  } catch (err) {
    console.error('Listing detail error:', err)
    res.status(500).json({ error: 'Failed to fetch listing' })
  }
})

/**
 * POST /api/listings
 * Create a new listing. Suppliers only.
 */
router.post('/', requireAuth, requireRole('supplier', 'retailer'), async (req, res) => {
  try {
    const {
      title, description, pricePounds, quantity,
      brandId, shippingMode, shippingCostPounds, sku
    } = req.body

    // --- Validate inputs ---
    if (!title || !description || !pricePounds || !brandId || !shippingMode) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    if (!['included', 'buyer_arranges'].includes(shippingMode)) {
      return res.status(400).json({ error: 'Invalid shipping mode' })
    }

    if (shippingMode === 'included' && (shippingCostPounds === undefined || shippingCostPounds < 0)) {
      return res.status(400).json({ error: 'Shipping cost required when shipping is included' })
    }

    const pricePence = Math.round(parseFloat(pricePounds) * 100)
    if (isNaN(pricePence) || pricePence <= 0) {
      return res.status(400).json({ error: 'Invalid price' })
    }

    const qty = parseInt(quantity) || 1
    if (qty < 1 || qty > 10000) {
      return res.status(400).json({ error: 'Quantity must be between 1 and 10,000' })
    }

    // CRITICAL: Verify this supplier is approved for the selected brand
    const hasPermission = await userHasBrandPermission(req.user.id, brandId)
    if (!hasPermission) {
      return res.status(403).json({ error: 'Not authorised to list under this brand' })
    }

    // Sanitise text
    const safeTitle = xss(title.trim()).substring(0, 150)
    const safeDescription = xss(description.trim()).substring(0, 2000)

    const shippingCostPence = shippingMode === 'included'
      ? Math.round(parseFloat(shippingCostPounds) * 100)
      : null

    const { data: listing, error } = await supabaseAdmin
      .from('listings')
      .insert({
        seller_id: req.user.id,
        brand_id: brandId,
        title: safeTitle,
        description: safeDescription,
        price_pence: pricePence,
        quantity: qty,
        shipping_mode: shippingMode,
        shipping_cost_pence: shippingCostPence,
        sku: sku ? xss(sku.trim()).substring(0, 100) : null,
        status: 'pending_review'  // Admin must approve before it goes live
      })
      .select('id, title, status, created_at')
      .single()

    if (error) throw error

    res.status(201).json({
      message: 'Listing submitted for review',
      listing
    })
  } catch (err) {
    console.error('Create listing error:', err)
    res.status(500).json({ error: 'Failed to create listing' })
  }
})

/**
 * POST /api/listings/:id/report
 * Report a listing for moderation.
 */
router.post('/:id/report', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Please provide a reason (min 10 characters)' })
    }

    // Verify user can see this listing (re-checks brand permission)
    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('id, brand_id, reported_count')
      .eq('id', id)
      .single()

    if (!listing) return res.status(404).json({ error: 'Listing not found' })

    const hasPermission = await userHasBrandPermission(req.user.id, listing.brand_id)
    if (!hasPermission) return res.status(404).json({ error: 'Listing not found' })

    const { error } = await supabaseAdmin
      .from('listing_reports')
      .insert({
        listing_id: id,
        reporter_id: req.user.id,
        reason: xss(reason.trim()).substring(0, 500)
      })

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'You have already reported this listing' })
      }
      throw error
    }

    // Increment report count
    await supabaseAdmin
      .from('listings')
      .update({ reported_count: listing.reported_count + 1 })
      .eq('id', id)

    res.json({ message: 'Report submitted. Our team will review this listing.' })
  } catch (err) {
    console.error('Report listing error:', err)
    res.status(500).json({ error: 'Failed to submit report' })
  }
})

module.exports = router
