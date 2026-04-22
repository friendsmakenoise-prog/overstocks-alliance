const { supabaseAdmin } = require('../../config/supabase')

// ============================================================
// FEE CALCULATION SERVICE
// Calculates platform fee based on order value.
// Tiers are stored in fee_config table (admin-adjustable).
// All amounts in pence to avoid floating point errors.
// ============================================================

/**
 * Calculate the platform fee for a given goods value.
 * Returns fee in pence and the percentage applied.
 *
 * @param {number} goodsValuePence - The goods value in pence (e.g. 10000 = £100)
 * @returns {{ feePence: number, feePercentage: number, tierName: string }}
 */
async function calculatePlatformFee(goodsValuePence) {
  // Fetch active fee tiers from database
  const { data: tiers, error } = await supabaseAdmin
    .from('fee_config')
    .select('*')
    .eq('active', true)
    .order('min_value_pence', { ascending: true })

  if (error) throw new Error(`Failed to fetch fee config: ${error.message}`)

  // Find the matching tier
  const tier = tiers.find(t => {
    const aboveMin = goodsValuePence >= t.min_value_pence
    const belowMax = t.max_value_pence === null || goodsValuePence <= t.max_value_pence
    return aboveMin && belowMax
  })

  if (!tier) {
    throw new Error(`No fee tier found for value: ${goodsValuePence} pence`)
  }

  // Calculate fee — round to nearest penny
  const feePercentage = parseFloat(tier.fee_percentage)
  const feePence = Math.round(goodsValuePence * (feePercentage / 100))

  return {
    feePence,
    feePercentage,
    tierName: tier.tier_name
  }
}

/**
 * Build a full order breakdown for display and Stripe.
 *
 * @param {number} goodsValuePence
 * @param {number} shippingCostPence - 0 if buyer arranges
 * @returns Order breakdown object
 */
async function buildOrderBreakdown(goodsValuePence, shippingCostPence = 0) {
  const { feePence, feePercentage, tierName } = await calculatePlatformFee(goodsValuePence)

  // Seller receives: goods value - platform fee + shipping
  // Platform fee is on goods only — shipping passes 100% to seller
  const sellerPayoutPence = goodsValuePence - feePence + shippingCostPence
  const totalChargePence = goodsValuePence + shippingCostPence

  return {
    goodsValuePence,
    shippingCostPence,
    platformFeePence: feePence,
    platformFeePercentage: feePercentage,
    feeTierName: tierName,
    sellerPayoutPence,
    totalChargePence,
    // Human-readable (for display)
    display: {
      goodsValue:      formatPence(goodsValuePence),
      shippingCost:    formatPence(shippingCostPence),
      platformFee:     formatPence(feePence),
      feePercentage:   `${feePercentage}%`,
      sellerPayout:    formatPence(sellerPayoutPence),
      totalCharge:     formatPence(totalChargePence)
    }
  }
}

function formatPence(pence) {
  return `£${(pence / 100).toFixed(2)}`
}

module.exports = { calculatePlatformFee, buildOrderBreakdown, formatPence }
