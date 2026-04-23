const express = require('express')
const router = express.Router()
const { supabaseAdmin } = require('../../config/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

// ============================================================
// BRAND REVIEW ROUTES
// ============================================================

/**
 * GET /api/brand-reviews/mine
 * Supplier: get eligibility reviews assigned to them
 */
router.get('/mine', requireAuth, requireRole('supplier'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('brand_eligibility_reviews')
      .select(`
        id, status, supplier_notes, requested_at, responded_at, expires_at,
        brand:brand_id ( id, name ),
        applicant:applicant_id ( id, anonymous_handle, role ),
        application:brand_application_id ( id, status )
      `)
      .eq('supplier_id', req.user.id)
      .order('requested_at', { ascending: false })

    if (error) throw error
    res.json({ reviews: data })
  } catch (err) {
    console.error('Get reviews error:', err)
    res.status(500).json({ error: 'Failed to fetch reviews' })
  }
})

/**
 * POST /api/brand-reviews/:id/respond
 * Supplier responds to an eligibility review
 */
router.post('/:id/respond', requireAuth, requireRole('supplier'), async (req, res) => {
  try {
    const { decision, notes } = req.body

    if (!['approved', 'declined'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be approved or declined' })
    }

    const { data: review, error: fetchError } = await supabaseAdmin
      .from('brand_eligibility_reviews')
      .select('*')
      .eq('id', req.params.id)
      .eq('supplier_id', req.user.id)
      .eq('status', 'pending')
      .single()

    if (fetchError || !review) {
      return res.status(404).json({ error: 'Review not found or already responded' })
    }

    const { data: updated, error } = await supabaseAdmin
      .from('brand_eligibility_reviews')
      .update({
        status: decision,
        supplier_notes: notes || null,
        responded_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error

    // Update application status to show supplier has responded
    await supabaseAdmin
      .from('brand_applications')
      .update({ status: 'reviewing' })
      .eq('id', review.brand_application_id)

    // Log for admin audit
    await supabaseAdmin.from('audit_log').insert({
      admin_id: req.user.id,
      action: `supplier_brand_review_${decision}`,
      target_type: 'brand_eligibility_review',
      target_id: req.params.id,
      metadata: { brand_id: review.brand_id, applicant_id: review.applicant_id, notes }
    })

    res.json({ review: updated, message: `Response recorded — admin has been notified` })
  } catch (err) {
    console.error('Respond to review error:', err)
    res.status(500).json({ error: 'Failed to submit response' })
  }
})

/**
 * GET /api/brand-reviews/admin/applications
 * Admin: get all brand applications with supplier review status
 */
router.get('/admin/applications', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { status } = req.query

    let query = supabaseAdmin
      .from('brand_applications')
      .select(`
        id, is_other, brand_name_text, status, applied_at, review_notes,
        brand:brand_id ( id, name ),
        user:user_id ( id, email, company_name, contact_name, role, anonymous_handle, status ),
        eligibility_reviews:brand_eligibility_reviews (
          id, status, supplier_notes, responded_at,
          supplier:supplier_id ( id, anonymous_handle, company_name )
        )
      `)
      .order('applied_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    res.json({ applications: data })
  } catch (err) {
    console.error('Get applications error:', err)
    res.status(500).json({ error: 'Failed to fetch applications' })
  }
})

/**
 * POST /api/brand-reviews/admin/request-review
 * Admin sends an application to a supplier for their input
 */
router.post('/admin/request-review', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { applicationId, supplierId } = req.body

    if (!applicationId || !supplierId) {
      return res.status(400).json({ error: 'applicationId and supplierId required' })
    }

    // Fetch the application
    const { data: application, error: appError } = await supabaseAdmin
      .from('brand_applications')
      .select('*, user:user_id(id, anonymous_handle), brand:brand_id(id, name)')
      .eq('id', applicationId)
      .single()

    if (appError || !application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    if (!application.brand_id) {
      return res.status(400).json({ error: 'Cannot send review for an unregistered brand' })
    }

    // Check supplier exists and has this brand in their distribution
    const { data: supplier } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, company_name')
      .eq('id', supplierId)
      .eq('role', 'supplier')
      .single()

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' })
    }

    // Check for existing pending review
    const { data: existing } = await supabaseAdmin
      .from('brand_eligibility_reviews')
      .select('id, status')
      .eq('brand_application_id', applicationId)
      .eq('supplier_id', supplierId)
      .single()

    if (existing && existing.status === 'pending') {
      return res.status(409).json({ error: 'A review request has already been sent to this supplier' })
    }

    // Create the review request
    const { data: review, error } = await supabaseAdmin
      .from('brand_eligibility_reviews')
      .insert({
        brand_application_id: applicationId,
        supplier_id: supplierId,
        brand_id: application.brand_id,
        applicant_id: application.user_id,
        requested_by: req.user.id
      })
      .select()
      .single()

    if (error) throw error

    // Update application status
    await supabaseAdmin
      .from('brand_applications')
      .update({ status: 'reviewing' })
      .eq('id', applicationId)

    // Send email to supplier via Supabase
    await sendSupplierReviewEmail(supplier, application)

    await supabaseAdmin.from('audit_log').insert({
      admin_id: req.user.id,
      action: 'sent_brand_eligibility_review',
      target_type: 'brand_eligibility_review',
      target_id: review.id,
      metadata: { supplier_id: supplierId, brand_id: application.brand_id, applicant_id: application.user_id }
    })

    res.json({ review, message: 'Review request sent to supplier' })
  } catch (err) {
    console.error('Request review error:', err)
    res.status(500).json({ error: 'Failed to send review request' })
  }
})

/**
 * POST /api/brand-reviews/admin/applications/:id/decide
 * Admin approves or declines a brand application
 */
router.post('/admin/applications/:id/decide', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { decision, notes } = req.body

    if (!['approved', 'declined'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be approved or declined' })
    }

    const { data: application, error: fetchError } = await supabaseAdmin
      .from('brand_applications')
      .select('*, user:user_id(id), brand:brand_id(id, name)')
      .eq('id', req.params.id)
      .single()

    if (fetchError || !application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    // Update application status
    const { error: updateError } = await supabaseAdmin
      .from('brand_applications')
      .update({
        status: decision,
        reviewed_at: new Date().toISOString(),
        reviewed_by: req.user.id,
        review_notes: notes || null
      })
      .eq('id', req.params.id)

    if (updateError) throw updateError

    // If approved and it's a real brand, grant the permission
    if (decision === 'approved' && application.brand_id) {
      const { grantBrandPermission } = require('../services/brandPermissions')
      await grantBrandPermission(application.user_id, application.brand_id, req.user.id)
    }

    await supabaseAdmin.from('audit_log').insert({
      admin_id: req.user.id,
      action: `brand_application_${decision}`,
      target_type: 'brand_application',
      target_id: req.params.id,
      metadata: { user_id: application.user_id, brand_id: application.brand_id, notes }
    })

    res.json({ message: `Application ${decision}`, application })
  } catch (err) {
    console.error('Decide application error:', err)
    res.status(500).json({ error: 'Failed to process decision' })
  }
})

/**
 * GET /api/brand-reviews/admin/suppliers-for-brand/:brandId
 * Admin: get suppliers who distribute a specific brand
 */
router.get('/admin/suppliers-for-brand/:brandId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('supplier_brand_distributions')
      .select(`
        id, verified,
        supplier:supplier_id ( id, company_name, email, anonymous_handle, status )
      `)
      .eq('brand_id', req.params.brandId)

    if (error) throw error
    res.json({ suppliers: data })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch suppliers' })
  }
})

// ── Email helper ──────────────────────────────────────────────
async function sendSupplierReviewEmail(supplier, application) {
  try {
    // Use Supabase's email function via admin API
    // In production replace with Resend/SendGrid for more control
    const frontendUrl = process.env.FRONTEND_URL || 'https://overstocks-alliance.vercel.app'
    console.log(`EMAIL: Sending review request to ${supplier.email} for brand ${application.brand?.name}`)
    // TODO: integrate with email provider (Resend recommended)
    // For now logs the intent — email setup covered in next iteration
  } catch (err) {
    console.error('Email send error:', err)
    // Don't fail the request if email fails
  }
}

module.exports = router
