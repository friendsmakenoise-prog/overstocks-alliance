const { supabaseAdmin } = require('../../config/supabase')

// ============================================================
// BRAND PERMISSION SERVICE
// Central logic for all brand-based access control.
// Every listing query must go through this.
// ============================================================

/**
 * Get the list of brand IDs a user is approved for.
 * This is called before every listing query.
 */
async function getUserApprovedBrandIds(userId) {
  const { data, error } = await supabaseAdmin
    .from('brand_permissions')
    .select('brand_id')
    .eq('user_id', userId)
    .is('revoked_at', null)

  if (error) throw new Error(`Failed to fetch brand permissions: ${error.message}`)

  return data.map(row => row.brand_id)
}

/**
 * Check if a user has permission for a specific brand.
 * Used to validate listing creation and listing detail page access.
 */
async function userHasBrandPermission(userId, brandId) {
  const { data, error } = await supabaseAdmin
    .from('brand_permissions')
    .select('id')
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .is('revoked_at', null)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    throw new Error(`Permission check failed: ${error.message}`)
  }

  return !!data
}

/**
 * Grant a brand permission to a user.
 * Admin only — validated at route level.
 */
async function grantBrandPermission(userId, brandId, adminId) {
  // Check if permission already exists (even if revoked)
  const { data: existing } = await supabaseAdmin
    .from('brand_permissions')
    .select('id, revoked_at')
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .single()

  if (existing) {
    if (!existing.revoked_at) {
      return { alreadyGranted: true }
    }
    // Re-activate a previously revoked permission
    const { data, error } = await supabaseAdmin
      .from('brand_permissions')
      .update({ revoked_at: null, revoked_by: null, granted_by: adminId, granted_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throw new Error(`Failed to re-grant permission: ${error.message}`)
    return { permission: data }
  }

  // Create new permission
  const { data, error } = await supabaseAdmin
    .from('brand_permissions')
    .insert({ user_id: userId, brand_id: brandId, granted_by: adminId })
    .select()
    .single()

  if (error) throw new Error(`Failed to grant permission: ${error.message}`)

  // Write to audit log
  await supabaseAdmin.from('audit_log').insert({
    admin_id: adminId,
    action: 'grant_brand_permission',
    target_type: 'brand_permission',
    target_id: data.id,
    metadata: { user_id: userId, brand_id: brandId }
  })

  return { permission: data }
}

/**
 * Revoke a brand permission from a user.
 * Admin only.
 */
async function revokeBrandPermission(userId, brandId, adminId) {
  const { data, error } = await supabaseAdmin
    .from('brand_permissions')
    .update({ revoked_at: new Date().toISOString(), revoked_by: adminId })
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .is('revoked_at', null)
    .select()
    .single()

  if (error) throw new Error(`Failed to revoke permission: ${error.message}`)

  await supabaseAdmin.from('audit_log').insert({
    admin_id: adminId,
    action: 'revoke_brand_permission',
    target_type: 'brand_permission',
    target_id: data.id,
    metadata: { user_id: userId, brand_id: brandId }
  })

  return { permission: data }
}

module.exports = {
  getUserApprovedBrandIds,
  userHasBrandPermission,
  grantBrandPermission,
  revokeBrandPermission
}
