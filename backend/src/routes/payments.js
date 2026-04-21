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

    // Fetch the offer
    const { data: offer, error: offerError } = await supabaseAdmin
      .from('offers')
      .select(`
        *,
        listing:listing_id ( id, title, image_urls ),
        seller_stripe:seller_stripe_accounts!seller_id ( stripe_account_id, charges_enabled )
      `)
      .eq('id', offerId)
      .eq('buyer_id', req.user.id)
      .eq('status', 'accepted')
      .single()

    if (offerError || !offer) {
      return res.status(404).json({ error: 'Offer not found or not ready for payment' })
    }

    // Check seller has connected Stripe
    if (!offer.seller_stripe?.charges_enabled) {
      return res.status(400).json({
        error: 'Seller has not connected their payment account yet. Please check back shortly.',
        code: 'SELLER_NOT_CONNECTED'
      })
    }

    const totalPence = (offer.agreed_price_pence * offer.quantity) + offer.shipping_cost_pence
    const platformFeePence = offer.platform_fee_pence

    // Build line items for checkout
    const lineItems = [
      {
        price_data: {
          currency: 'gbp',
          product_data: {
            name: offer.listing.title,
            description: `${offer.quantity} unit${offer.quantity !== 1 ? 's' : ''} · ${offer.shipping_mode === 'included' ? 'Shipping included' : 'Buyer arranges shipping'}`,
            images: offer.listing.image_urls?.length > 0 ? [offer.listing.image_urls[0]] : []
          },
          unit_amount: offer.agreed_price_pence
        },
        quantity: offer.quantity
      }
    ]

    // Add shipping as separate line item if included
    if (offer.shipping_mode === 'included' && offer.shipping_cost_pence > 0) {
      lineItems.push({
        price_data: {
          currency: 'gbp',
          product_data: { name: 'Shipping' },
          unit_amount: offer.shipping_cost_pence
        },
        quantity: 1
      })
    }

    // Create Stripe checkout session with Connect
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/orders/${offerId}?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/offers?cancelled=true`,
      metadata: {
        offer_id: offerId,
        buyer_id: req.user.id,
        seller_id: offer.seller_id
      },
      payment_intent_data: {
        application_fee_amount: platformFeePence,
        transfer_data: {
          destination: offer.seller_stripe.stripe_account_id
        },
        metadata: {
          offer_id: offerId
        }
      }
    })

    // Save session ID to offer
    await supabaseAdmin
      .from('offers')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', offerId)

    res.json({ checkoutUrl: session.url, sessionId: session.id })
  } catch (err) {
    console.error('Checkout error:', err)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

/**
 * POST /api/payments/connect/onboard
 * Start Stripe Connect onboarding for a seller
 */
router.post('/connect/onboard', requireAuth, async (req, res) => {
  try {
    // Check if seller already has an account
    const { data: existing } = await supabaseAdmin
      .from('seller_stripe_accounts')
      .select('stripe_account_id, onboarding_complete')
      .eq('user_id', req.user.id)
      .single()

    let accountId

    if (existing) {
      accountId = existing.stripe_account_id
    } else {
      // Create a new Express account for this seller
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'GB',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        }
      })
      accountId = account.id

      // Save to database
      await supabaseAdmin
        .from('seller_stripe_accounts')
        .insert({
          user_id: req.user.id,
          stripe_account_id: accountId
        })
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.FRONTEND_URL}/settings/payments?refresh=true`,
      return_url: `${process.env.FRONTEND_URL}/settings/payments?success=true`,
      type: 'account_onboarding'
    })

    res.json({ onboardingUrl: accountLink.url })
  } catch (err) {
    console.error('Connect onboard error:', err)
    res.status(500).json({ error: 'Failed to start payment setup' })
  }
})

/**
 * GET /api/payments/connect/status
 * Check seller's Stripe Connect status
 */
router.get('/connect/status', requireAuth, async (req, res) => {
  try {
    const { data: account } = await supabaseAdmin
      .from('seller_stripe_accounts')
      .select('*')
      .eq('user_id', req.user.id)
      .single()

    if (!account) {
      return res.json({ connected: false })
    }

    // Refresh status from Stripe
    const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id)

    const charges_enabled = stripeAccount.charges_enabled
    const payouts_enabled = stripeAccount.payouts_enabled
    const onboarding_complete = charges_enabled && payouts_enabled

    // Update database with latest status
    await supabaseAdmin
      .from('seller_stripe_accounts')
      .update({ charges_enabled, payouts_enabled, onboarding_complete })
      .eq('user_id', req.user.id)

    res.json({
      connected: true,
      charges_enabled,
      payouts_enabled,
      onboarding_complete
    })
  } catch (err) {
    console.error('Connect status error:', err)
    res.status(500).json({ error: 'Failed to check payment status' })
  }
})

/**
 * POST /api/payments/webhook
 * Handle Stripe webhook events
 * IMPORTANT: This route uses raw body parsing (set up in index.js)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
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
          // Reduce listing quantity
          const { data: listing } = await supabaseAdmin
            .from('listings')
            .select('quantity')
            .eq('id', offer.listing_id)
            .single()

          if (listing) {
            const newQty = listing.quantity - offer.quantity
            await supabaseAdmin
              .from('listings')
              .update({
                quantity: newQty,
                status: newQty <= 0 ? 'sold' : 'active'
              })
              .eq('id', offer.listing_id)
          }
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
