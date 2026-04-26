const express = require('express')
const router = express.Router()
const { supabaseAdmin } = require('../../config/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')
const { grantBrandPermission, revokeBrandPermission } = require('../services/brandPermissions')
const email = require('../services/email')

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
        contact_name, phone, website, trading_address,
        anonymous_handle, created_at, approved_at, rejection_reason
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
 * GET /api/admin/users/:id
 * Single user — used by AdminUserPage
 */
router.get('/users/:id', async (req, res) => {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('user_profiles')
      .select(`
        id, email, role, status, company_name,
        contact_name, phone, website, trading_address,
        anonymous_handle, created_at, approved_at, rejection_reason
      `)
      .eq('id', req.params.id)
      .single()

    if (error || !user) return res.status(404).json({ error: 'User not found' })
    res.json({ user })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

/**
 * POST /api/admin/users/:id/approve
 * Approve a pending user and confirm their email simultaneously
 */
router.post('/users/:id/approve', async (req, res) => {
  try {
    const { id } = req.params

    // Step 1: Confirm their email via Supabase auth admin API
    // This allows them to log in immediately without a separate email confirmation
    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      email_confirm: true
    })

    if (confirmError) {
      console.error('Email confirmation error:', confirmError)
      // Don't block approval if this fails — log it and continue
    }

    // Step 2: Update their profile status to approved
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

    // ── Email: notify user their account is approved
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('email, company_name, anonymous_handle')
      .eq('id', id)
      .single()
    if (profile?.email) {
      email.sendAccountApproved({
        email: profile.email,
        companyName: profile.company_name,
        anonymousHandle: profile.anonymous_handle
      }).catch(e => console.error('Email error:', e))
    }

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
      .order('granted_at', { ascending: false })

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
    const { status, seller_id } = req.query

    let query = supabaseAdmin
      .from('listings')
      .select(`
        id, title, price_pence, quantity, status,
        shipping_mode, shipping_cost_pence,
        image_urls, reported_count, created_at,
        brands(id, name),
        seller:seller_id ( id, company_name, anonymous_handle, email )
      `)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (seller_id) query = query.eq('seller_id', seller_id)

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
      .select('id, title, seller_id, status')
      .single()

    if (error || !data) return res.status(404).json({ error: 'Listing not found' })

    await supabaseAdmin.from('audit_log').insert({
      admin_id: req.user.id,
      action: 'approve_listing',
      target_type: 'listing',
      target_id: req.params.id
    })

    // ── Email: notify seller listing is live
    const { data: seller } = await supabaseAdmin
      .from('user_profiles')
      .select('email')
      .eq('id', data.seller_id)
      .single()
    if (seller?.email) {
      email.sendListingApproved({
        email: seller.email,
        listingTitle: data.title
      }).catch(e => console.error('Email error:', e))
    }

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
      .select('id, title, seller_id')
      .single()

    if (error || !data) return res.status(404).json({ error: 'Listing not found' })

    await supabaseAdmin.from('audit_log').insert({
      admin_id: req.user.id,
      action: 'remove_listing',
      target_type: 'listing',
      target_id: req.params.id,
      metadata: { reason }
    })

    // ── Email: notify seller listing was removed
    const { data: seller } = await supabaseAdmin
      .from('user_profiles')
      .select('email')
      .eq('id', data.seller_id)
      .single()
    if (seller?.email) {
      email.sendListingRemoved({
        email: seller.email,
        listingTitle: data.title,
        reason: reason || null
      }).catch(e => console.error('Email error:', e))
    }

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

/**
 * POST /api/admin/reports/:id/resolve
 * Mark a report as resolved (dismiss without action)
 */
router.post('/reports/:id/resolve', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('listing_reports')
      .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: req.user.id })
      .eq('id', req.params.id)

    if (error) throw error

    await supabaseAdmin.from('audit_log').insert({
      admin_id: req.user.id,
      action: 'resolve_report',
      target_type: 'listing_report',
      target_id: req.params.id
    })

    res.json({ message: 'Report resolved' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve report' })
  }
})

module.exports = router
