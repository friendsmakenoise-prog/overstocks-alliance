const express = require('express')
const router = express.Router()
const { supabaseAdmin } = require('../../config/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')
const { grantBrandPermission, revokeBrandPermission } = require('../services/brandPermissions')

// All admin routes require authentication AND admin role
router.use(requireAuth, requireRole('admin'))

// ============================================================
// ADMIN ROUTES
// ============================================================

/**
 * GET /api/admin/users
 * List users with optional status filter
 */
router.get('/users', async (req, res) => {
  try {
    const { status, role } = req.query

    let query = supabaseAdmin
      .from('user_profiles')
      .select(`
        id, email, role, status, company_name,
        contact_name, phone, anonymous_handle,
        created_at, approved_at, rejection_reason
      `)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (role) query = query.eq('role', role)

    const { data: users, error } = await query
    if (error) throw error

    res.json({ users })
  } catch (err) {
    console.error('Admin get users error:', err)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

/**
 * POST /api/admin/users/:id/approve
 * Approve a pending user
 */
router.post('/users/:id/approve', async (req, res) => {
  try {
    const { id } = req.params

    const { data: user, error } = await supabaseAdmin
      .from('user_profiles')
      .update({
        status: 'approved',
        approved_by: req.user.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id, email, status')
      .single()

    if (error || !user) {
      return res.status(404).json({ error: 'User not found or not in pending status' })
    }

    await supabaseAdmin.from('audit_log').insert({
      admin_id: req.user.id,
      action: 'approve_user',
      target_type: 'user',
      target_id: id
    })

    res.json({ message: 'User approved', user })
  } catch (err) {
    console.error('Approve user error:', err)
    res.status(500).json({ error: 'Failed to approve user' })
  }
})

/**
 * POST /api/admin/users/:id/reject
 */
router.post('/users/:id/reject', async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    const { data: user, error } = await supabaseAdmin
      .from('user_profiles')
      .update({
        status: 'rejected',
        rejection_reason: reason || 'Application not approved'
      })
      .eq('id', id)
      .select('id, email, status')
      .single()

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    await supabaseAdmin.from('audit_log').insert({
      admin_id: req.user.id,
      action: 'reject_user',
      target_type: 'user',
      target_id: id,
      metadata: { reason }
    })

    res.json({ message: 'User rejected', user })
  } catch (err) {
    console.error('Reject user error:', err)
    res.status(500).json({ error: 'Failed to reject user' })
  }
})

/**
 * POST /api/admin/users/:id/suspend
 */
router.post('/users/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params

    // Prevent admins suspending themselves
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot suspend your own account' })
    }

    const { data: user, error } = await supabaseAdmin
      .from('user_profiles')
      .update({ status: 'suspended' })
      .eq('id', id)
      .select('id, email, status')
      .single()

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' })
    }

    await supabaseAdmin.from('audit_log').insert({
      admin_id: req.user.id,
      action: 'suspend_user',
      target_type: 'user',
      target_id: id
    })

    res.json({ message: 'User suspended', user })
  } catch (err) {
    console.error('Suspend user error:', err)
    res.status(500).json({ error: 'Failed to suspend user' })
  }
})

// ============================================================
// BRAND MANAGEMENT
// ============================================================

/**
 * GET /api/admin/brands
 */
router.get('/brands', async (req, res) => {
  try {
    const { data: brands, error } = await supabaseAdmin
      .from('brands')
      .select('*')
      .order('name')

    if (error) throw error
    res.json({ brands })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch brands' })
  }
})

/**
 * POST /api/admin/brands
 * Create a new brand
 */
router.post('/brands', async (req, res) => {
  try {
    const { name } = req.body

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Brand name required (min 2 characters)' })
    }

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')

    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .insert({ name: name.trim(), slug, created_by: req.user.id })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A brand with this name already exists' })
      }
      throw error
    }

    await supabaseAdmin.from('audit_log').insert({
      admin_id: req.user.id,
      action: 'create_brand',
      target_type: 'brand',
      target_id: brand.id,
      metadata: { name: brand.name }
    })

    res.status(201).json({ brand })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create brand' })
  }
})

// ============================================================
// BRAND PERMISSION MANAGEMENT
// ============================================================

/**
 * GET /api/admin/users/:id/permissions
 */
router.get('/users/:id/permissions', async (req, res) => {
  try {
    const { data: permissions, error } = await supabaseAdmin
      .from('brand_permissions')
      .select('*, brands(id, name, slug)')
      .eq('user_id', req.params.id)

    if (error) throw error
    res.json({ permissions })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch permissions' })
  }
})

/**
 * POST /api/admin/users/:id/permissions/grant
 */
router.post('/users/:id/permissions/grant', async (req, res) => {
  try {
    const { brandId } = req.body
    if (!brandId) return res.status(400).json({ error: 'brandId required' })

    const result = await grantBrandPermission(req.params.id, brandId, req.user.id)

    if (result.alreadyGranted) {
      return res.status(409).json({ error: 'Permission already granted' })
    }

    res.json({ message: 'Brand permission granted', permission: result.permission })
  } catch (err) {
    res.status(500).json({ error: 'Failed to grant permission' })
  }
})

/**
 * POST /api/admin/users/:id/permissions/revoke
 */
router.post('/users/:id/permissions/revoke', async (req, res) => {
  try {
    const { brandId } = req.body
    if (!brandId) return res.status(400).json({ error: 'brandId required' })

    const result = await revokeBrandPermission(req.params.id, brandId, req.user.id)
    res.json({ message: 'Brand permission revoked', permission: result.permission })
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke permission' })
  }
})

// ============================================================
// LISTING MODERATION
// ============================================================

/**
 * GET /api/admin/listings
 * All listings (including pending review) with seller info visible
 */
router.get('/listings', async (req, res) => {
  try {
    const { status } = req.query

    let query = supabaseAdmin
      .from('listings')
      .select(`
        id, title, price_pence, quantity, status,
        shipping_mode, shipping_cost_pence,
        reported_count, created_at,
        brands(id, name),
        seller:seller_id ( id, company_name, anonymous_handle, email )
      `)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data: listings, error } = await query
    if (error) throw error

    res.json({ listings })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch listings' })
  }
})

/**
 * POST /api/admin/listings/:id/approve
 */
router.post('/listings/:id/approve', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('listings')
      .update({ status: 'active' })
      .eq('id', req.params.id)
      .eq('status', 'pending_review')
      .select('id, title, status')
      .single()

    if (error || !data) return res.status(404).json({ error: 'Listing not found' })

    await supabaseAdmin.from('audit_log').insert({
      admin_id: req.user.id,
      action: 'approve_listing',
      target_type: 'listing',
      target_id: req.params.id
    })

    res.json({ message: 'Listing approved and now live', listing: data })
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve listing' })
  }
})

/**
 * POST /api/admin/listings/:id/remove
 */
router.post('/listings/:id/remove', async (req, res) => {
  try {
    const { reason } = req.body

    const { data, error } = await supabaseAdmin
      .from('listings')
      .update({ status: 'removed' })
      .eq('id', req.params.id)
      .select('id, title')
      .single()

    if (error || !data) return res.status(404).json({ error: 'Listing not found' })

    await supabaseAdmin.from('audit_log').insert({
      admin_id: req.user.id,
      action: 'remove_listing',
      target_type: 'listing',
      target_id: req.params.id,
      metadata: { reason }
    })

    res.json({ message: 'Listing removed', listing: data })
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove listing' })
  }
})

/**
 * GET /api/admin/reports
 * Reported listings awaiting review
 */
router.get('/reports', async (req, res) => {
  try {
    const { data: reports, error } = await supabaseAdmin
      .from('listing_reports')
      .select(`
        id, reason, created_at, resolved,
        listing:listing_id ( id, title, status, brands(name) ),
        reporter:reporter_id ( id, anonymous_handle )
      `)
      .eq('resolved', false)
      .order('created_at', { ascending: true })

    if (error) throw error
    res.json({ reports })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' })
  }
})

module.exports = router
