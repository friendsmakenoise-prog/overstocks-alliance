const express = require('express')
const router = express.Router()
const { supabaseAdmin } = require('../../config/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')
const email = require('../services/email')

// ============================================================
// BRAND FAMILY MATCHING HELPER
// Finds all brands that start with a given name prefix.
// e.g. "Roland" matches "Roland", "Roland — Keys", "Roland Gold"
// ============================================================
async function findBrandFamily(brandName) {
  const { data: allBrands } = await supabaseAdmin
    .from('brands')
    .select('id, name')
    .eq('status', 'active')

  const nameLower = brandName.toLowerCase()
  return (allBrands || []).filter(b => {
    const bLower = b.name.toLowerCase()
    return bLower === nameLower ||
      bLower.startsWith(nameLower + ' ') ||
      bLower.startsWith(nameLower + ' —') ||
      bLower.startsWith(nameLower + ' -') ||
      bLower.startsWith(nameLower + '-') ||
      bLower.startsWith(nameLower + ':')
  })
}

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
        applicant:applicant_id ( id, anonymous_handle, role, company_name ),
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
    const { decision, notes, brandDecisions } = req.body
    // brandDecisions is an optional array of { applicationId, approved }
    // for when the supplier is reviewing a family of brands

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

    // Update main review
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

    // If per-brand decisions provided, update individual applications
    if (brandDecisions && Array.isArray(brandDecisions) && brandDecisions.length > 0) {
      for (const bd of brandDecisions) {
        await supabaseAdmin
          .from('brand_applications')
          .update({
            status: 'reviewing',
            review_notes: bd.approved
              ? `Supplier recommends: approved`
              : `Supplier recommends: declined`
          })
          .eq('id', bd.applicationId)
          .eq('user_id', review.applicant_id)
      }
    } else {
      // Single decision — update the linked application
      await supabaseAdmin
        .from('brand_applications')
        .update({ status: 'reviewing' })
        .eq('id', review.brand_application_id)
    }

    await supabaseAdmin.from('audit_log').insert({
      admin_id: req.user.id,
      action: `supplier_brand_review_${decision}`,
      target_type: 'brand_eligibility_review',
      target_id: req.params.id,
      metadata: { brand_id: review.brand_id, applicant_id: review.applicant_id, notes, brandDecisions }
    })

    res.json({ review: updated, message: 'Response recorded — admin has been notified' })
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

    // Send email to supplier
    await email.sendBrandReviewRequest({
      email: supplier.email,
      brandName: application.brand?.name || 'Unknown brand',
      applicantRole: application.user_id ? 'member' : 'applicant',
      reviewId: review.id
    })

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
 * POST /api/brand-reviews/admin/applications/:id/link-brand
 * Admin: link an "Other" application to a real brand (or brand family)
 */
router.post('/admin/applications/:id/link-brand', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { brandId, useFamily } = req.body
    if (!brandId) return res.status(400).json({ error: 'brandId required' })

    const { data: brand, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('id, name')
      .eq('id', brandId)
      .single()

    if (brandError || !brand) return res.status(404).json({ error: 'Brand not found' })

    // Fetch the original application to get user_id and brand_name_text
    const { data: application, error: appError } = await supabaseAdmin
      .from('brand_applications')
      .select('*, user:user_id(id, role)')
      .eq('id', req.params.id)
      .single()

    if (appError || !application) return res.status(404).json({ error: 'Application not found' })

    // Update the original application
    await supabaseAdmin
      .from('brand_applications')
      .update({ brand_id: brandId, brand_name_text: null, is_other: false })
      .eq('id', req.params.id)

    const linkedBrands = [brand]

    // If useFamily, find all sub-brands and create applications for them too
    if (useFamily) {
      const family = await findBrandFamily(brand.name)
      const siblings = family.filter(b => b.id !== brandId)

      for (const sibling of siblings) {
        // Check not already applied
        const { data: existing } = await supabaseAdmin
          .from('brand_applications')
          .select('id')
          .eq('user_id', application.user.id)
          .eq('brand_id', sibling.id)
          .single()

        if (!existing) {
          await supabaseAdmin.from('brand_applications').insert({
            user_id: application.user.id,
            brand_id: sibling.id,
            is_other: false,
            review_notes: `Family match from "${brand.name}"`
          })
          linkedBrands.push(sibling)
        }
      }
    }

    await supabaseAdmin.from('audit_log').insert({
      admin_id: req.user.id,
      action: 'link_application_to_brand',
      target_type: 'brand_application',
      target_id: req.params.id,
      metadata: { brand_id: brandId, brand_name: brand.name, family_count: linkedBrands.length }
    })

    res.json({
      message: useFamily && linkedBrands.length > 1
        ? `Linked to ${brand.name} and ${linkedBrands.length - 1} related brand${linkedBrands.length - 1 !== 1 ? 's' : ''}`
        : `Application linked to ${brand.name}`,
      linkedBrands
    })
  } catch (err) {
    console.error('Link brand error:', err)
    res.status(500).json({ error: 'Failed to link brand' })
  }
})

/**
 * GET /api/brand-reviews/mine/family/:applicantId
 * Supplier: get all brand applications from an applicant for brands they distribute
 * Used when reviewing a brand family (e.g. all Roland tiers for one applicant)
 */
router.get('/mine/family/:applicantId', requireAuth, requireRole('supplier'), async (req, res) => {
  try {
    // Get all brands this supplier distributes
    const { data: distributions } = await supabaseAdmin
      .from('supplier_brand_distributions')
      .select('brand_id')
      .eq('supplier_id', req.user.id)

    const brandIds = (distributions || []).map(d => d.brand_id).filter(Boolean)

    if (brandIds.length === 0) return res.json({ applications: [] })

    // Get all pending applications from this applicant for those brands
    const { data: applications, error } = await supabaseAdmin
      .from('brand_applications')
      .select('id, status, review_notes, applied_at, brand:brand_id(id, name)')
      .eq('user_id', req.params.applicantId)
      .in('brand_id', brandIds)
      .in('status', ['pending', 'reviewing'])
      .order('applied_at', { ascending: true })

    if (error) throw error
    res.json({ applications: applications || [] })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch family applications' })
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

module.exports = router
