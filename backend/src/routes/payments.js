const express = require('express')
const router = express.Router()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { supabaseAdmin } = require('../../config/supabase')
const { requireAuth } = require('../middleware/auth')

// ============================================================
// STRIPE PAYMENTS ROUTES
// ============================================================

/**
 * POST /api/payments/checkout
 * Create a Stripe checkout session for an accepted offer
 */
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const { offerId } = req.body
    if (!offerId) return res.status(400).json({ error: 'offerId required' })

    // Fetch offer without the problematic join first
    const { data: offer, error: offerError } = await supabaseAdmin
      .from('offers')
      .select('*')
      .eq('id', offerId)
      .eq('buyer_id', req.user.id)
      .eq('status', 'accepted')
      .single()

    if (offerError || !offer) {
      console.error('Offer lookup failed:', offerError)
      return res.status(404).json({ error: 'Offer not found or not ready for payment' })
    }

    // Fetch listing separately
    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('id, title, image_urls')
      .eq('id', offer.listing_id)
      .single()

    // Fetch seller Stripe account separately
    const { data: sellerStripe } = await supabaseAdmin
      .from('seller_stripe_accounts')
      .select('stripe_account_id, charges_enabled')
      .eq('user_id', offer.seller_id)
      .single()

    // Check seller has connected Stripe
    if (!sellerStripe?.charges_enabled) {
      return res.status(400).json({
        error: 'Seller has not connected their payment account yet.',
        code: 'SELLER_NOT_CONNECTED'
      })
    }

    // Use agreed_price if set, fall back to offered_price (for direct purchases)
    const unitPricePence = offer.agreed_price_pence || offer.offered_price_pence
    const platformFeePence = offer.platform_fee_pence || 0
    const shippingPence = offer.shipping_cost_pence || 0

    // Total buyer pays = goods + shipping
    // Seller receives = goods - platform fee + shipping
    // Platform keeps = platform fee only
    const totalBuyerPays = (unitPricePence * offer.quantity) + shippingPence

    if (!unitPricePence || unitPricePence <= 0) {
      return res.status(400).json({ error: 'Invalid offer price' })
    }

    // Build line items
    const lineItems = [
      {
        price_data: {
          currency: 'gbp',
          product_data: {
            name: listing?.title || 'Stock listing',
            description: `${offer.quantity} unit${offer.quantity !== 1 ? 's' : ''} · ${offer.shipping_mode === 'included' ? 'Shipping included' : 'Buyer arranges shipping'}`,
            images: listing?.image_urls?.length > 0 ? [listing.image_urls[0]] : []
          },
          unit_amount: unitPricePence
        },
        quantity: offer.quantity
      }
    ]

    // Add shipping as separate line item if included
    if (offer.shipping_mode === 'included' && shippingPence > 0) {
      lineItems.push({
        price_data: {
          currency: 'gbp',
          product_data: { name: 'Shipping' },
          unit_amount: shippingPence
        },
        quantity: 1
      })
    }

    // Create Stripe checkout session
    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/orders/${offerId}?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/offers?cancelled=true`,
      metadata: {
        offer_id: offerId,
        buyer_id: req.user.id,
        seller_id: offer.seller_id
      }
    }

    // Only add Connect fee splitting if platform fee > 0
    if (platformFeePence > 0) {
      sessionConfig.payment_intent_data = {
        application_fee_amount: platformFeePence,
        transfer_data: {
          destination: sellerStripe.stripe_account_id
        },
        metadata: { offer_id: offerId }
      }
    } else {
      sessionConfig.payment_intent_data = {
        transfer_data: {
          destination: sellerStripe.stripe_account_id
        },
        metadata: { offer_id: offerId }
      }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig)

    // Save session ID to offer
    await supabaseAdmin
      .from('offers')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', offerId)

    res.json({ checkoutUrl: session.url, sessionId: session.id })
  } catch (err) {
    console.error('Checkout error:', err.message, err.raw || '')
    res.status(500).json({ error: 'Failed to create checkout session', detail: err.message })
  }
})

/**
 * POST /api/payments/connect/onboard
 * Start Stripe Connect onboarding for a seller
 */
router.post('/connect/onboard', requireAuth, async (req, res) => {
  try {
    const { data: existing } = await supabaseAdmin
      .from('seller_stripe_accounts')
      .select('stripe_account_id, onboarding_complete')
      .eq('user_id', req.user.id)
      .single()

    let accountId

    if (existing) {
      accountId = existing.stripe_account_id
    } else {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'GB',
        email: req.user.email,
        business_type: 'company',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        settings: {
          payouts: { schedule: { interval: 'manual' } }
        }
      })
      accountId = account.id

      await supabaseAdmin
        .from('seller_stripe_accounts')
        .insert({ user_id: req.user.id, stripe_account_id: accountId })
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.FRONTEND_URL}/settings/payments?refresh=true`,
      return_url: `${process.env.FRONTEND_URL}/settings/payments?success=true`,
      type: 'account_onboarding'
    })

    res.json({ onboardingUrl: accountLink.url })
  } catch (err) {
    console.error('Connect onboard error:', err.message)
    res.status(500).json({ error: 'Failed to start payment setup', detail: err.message })
  }
})

/**
 * GET /api/payments/connect/status
 */
router.get('/connect/status', requireAuth, async (req, res) => {
  try {
    const { data: account } = await supabaseAdmin
      .from('seller_stripe_accounts')
      .select('*')
      .eq('user_id', req.user.id)
      .single()

    if (!account) return res.json({ connected: false })

    const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id)
    const charges_enabled = stripeAccount.charges_enabled
    const payouts_enabled = stripeAccount.payouts_enabled
    const onboarding_complete = charges_enabled && payouts_enabled

    await supabaseAdmin
      .from('seller_stripe_accounts')
      .update({ charges_enabled, payouts_enabled, onboarding_complete })
      .eq('user_id', req.user.id)

    res.json({ connected: true, charges_enabled, payouts_enabled, onboarding_complete })
  } catch (err) {
    console.error('Connect status error:', err.message)
    res.status(500).json({ error: 'Failed to check payment status' })
  }
})

/**
 * POST /api/payments/webhook
 * Handle Stripe webhook events
 */
router.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  const sig = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(
      req.body, sig, process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature error:', err.message)
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const offerId = session.metadata?.offer_id
        if (!offerId) break

        // Mark offer as paid
        const { data: offer } = await supabaseAdmin
          .from('offers')
          .update({
            status: 'paid',
            stripe_payment_intent_id: session.payment_intent,
            stripe_checkout_session_id: session.id
          })
          .eq('id', offerId)
          .select('listing_id, quantity')
          .single()

        if (offer) {
          // Reduce listing quantity and update status
          const { data: listing } = await supabaseAdmin
            .from('listings')
            .select('quantity')
            .eq('id', offer.listing_id)
            .single()

          if (listing) {
            const newQty = Math.max(1, listing.quantity - offer.quantity)
            await supabaseAdmin
              .from('listings')
              .update({
                quantity: newQty,
                status: newQty <= offer.quantity ? 'sold' : 'active'
              })
              .eq('id', offer.listing_id)
          }

          // Clear any other pending/accepted offers on this listing
          // now that a sale has completed
          await supabaseAdmin
            .from('offers')
            .update({ status: 'cancelled' })
            .eq('listing_id', offer.listing_id)
            .in('status', ['pending', 'countered', 'accepted'])
            .neq('id', offerId)
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object
        const offerId = intent.metadata?.offer_id
        if (offerId) {
          await supabaseAdmin
            .from('offers')
            .update({ status: 'cancelled' })
            .eq('id', offerId)
            .eq('status', 'accepted')
        }
        break
      }
    }

    res.json({ received: true })
  } catch (err) {
    console.error('Webhook processing error:', err)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

module.exports = router
