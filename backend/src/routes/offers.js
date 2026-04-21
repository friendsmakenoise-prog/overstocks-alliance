const express = require('express')
const router = express.Router()
const { supabaseAdmin } = require('../../config/supabase')
const { requireAuth } = require('../middleware/auth')
const { userHasBrandPermission } = require('../services/brandPermissions')
const { buildOrderBreakdown } = require('../services/fees')
const xss = require('xss')

// ============================================================
// OFFERS ROUTES
// ============================================================

/**
 * GET /api/offers
 * Get all offers for the current user (as buyer or seller)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data: offers, error } = await supabaseAdmin
      .from('offers')
      .select(`
        id, offer_type, quantity, offered_price_pence,
        counter_price_pence, counter_message, countered_at,
        agreed_price_pence, platform_fee_pence, platform_fee_pct,
        seller_payout_pence, shipping_mode, shipping_cost_pence,
        message, status, expires_at, created_at, updated_at,
        listing:listing_id ( id, title, image_urls, brands(name) ),
        buyer:buyer_id ( id, anonymous_handle ),
        seller:seller_id ( id, anonymous_handle )
      `)
      .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json({ offers })
  } catch (err) {
    console.error('Get offers error:', err)
    res.status(500).json({ error: 'Failed to fetch offers' })
  }
})

/**
 * POST /api/offers
 * Create a new offer or direct purchase
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      listingId, offerType, quantity,
      offeredPricePounds, message
    } = req.body

    if (!listingId || !offerType || !quantity || !offeredPricePounds) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    if (!['direct', 'offer'].includes(offerType)) {
      return res.status(400).json({ error: 'Invalid offer type' })
    }

    // Fetch the listing
    const { data: listing, error: listingError } = await supabaseAdmin
      .from('listings')
      .select('id, seller_id, brand_id, price_pence, quantity, status, shipping_mode, shipping_cost_pence')
      .eq('id', listingId)
      .eq('status', 'active')
      .single()

    if (listingError || !listing) {
      return res.status(404).json({ error: 'Listing not found or no longer available' })
    }

    // Can't buy your own listing
    if (listing.seller_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot make an offer on your own listing' })
    }

    // Check buyer has brand permission
    const hasPermission = await userHasBrandPermission(req.user.id, listing.brand_id)
    if (!hasPermission) {
      return res.status(403).json({ error: 'Not authorised for this brand' })
    }

    const qty = parseInt(quantity)
    if (qty < 1 || qty > listing.quantity) {
      return res.status(400).json({ error: `Quantity must be between 1 and ${listing.quantity}` })
    }

    const offeredPricePence = Math.round(parseFloat(offeredPricePounds) * 100)
    if (isNaN(offeredPricePence) || offeredPricePence <= 0) {
      return res.status(400).json({ error: 'Invalid price' })
    }

    // Direct purchase must be at listed price and full quantity
    if (offerType === 'direct') {
      if (offeredPricePence !== listing.price_pence) {
        return res.status(400).json({ error: 'Direct purchase must be at listed price' })
      }
      if (qty !== listing.quantity) {
        return res.status(400).json({ error: 'Direct purchase must be for full quantity. Use offer for partial quantities.' })
      }
    }

    // Calculate fees on offered price
    const breakdown = await buildOrderBreakdown(
      offeredPricePence * qty,
      listing.shipping_mode === 'included' ? (listing.shipping_cost_pence || 0) : 0
    )

    const { data: offer, error } = await supabaseAdmin
      .from('offers')
      .insert({
        listing_id: listingId,
        buyer_id: req.user.id,
        seller_id: listing.seller_id,
        brand_id: listing.brand_id,
        offer_type: offerType,
        quantity: qty,
        offered_price_pence: offeredPricePence,
        message: message ? xss(message.trim()).substring(0, 300) : null,
        shipping_mode: listing.shipping_mode,
        shipping_cost_pence: listing.shipping_mode === 'included' ? (listing.shipping_cost_pence || 0) : 0,
        platform_fee_pence: breakdown.platformFeePence,
        platform_fee_pct: breakdown.platformFeePercentage,
        seller_payout_pence: breakdown.sellerPayoutPence,
        // Direct purchases are auto-accepted
        status: offerType === 'direct' ? 'accepted' : 'pending',
        agreed_price_pence: offerType === 'direct' ? offeredPricePence : null
      })
      .select()
      .single()

    if (error) throw error

    res.status(201).json({
      message: offerType === 'direct' ? 'Purchase ready for checkout' : 'Offer sent to seller',
      offer
    })
  } catch (err) {
    console.error('Create offer error:', err)
    res.status(500).json({ error: 'Failed to create offer' })
  }
})

/**
 * POST /api/offers/:id/counter
 * Seller makes a counter-offer (one time only)
 */
router.post('/:id/counter', requireAuth, async (req, res) => {
  try {
    const { counterPricePounds, counterMessage } = req.body

    if (!counterPricePounds) {
      return res.status(400).json({ error: 'Counter price required' })
    }

    const counterPricePence = Math.round(parseFloat(counterPricePounds) * 100)
    if (isNaN(counterPricePence) || counterPricePence <= 0) {
      return res.status(400).json({ error: 'Invalid counter price' })
    }

    // Fetch offer and verify seller
    const { data: offer, error: fetchError } = await supabaseAdmin
      .from('offers')
      .select('*')
      .eq('id', req.params.id)
      .eq('seller_id', req.user.id)
      .eq('status', 'pending')
      .single()

    if (fetchError || !offer) {
      return res.status(404).json({ error: 'Offer not found or cannot be countered' })
    }

    // Recalculate fees on counter price
    const breakdown = await buildOrderBreakdown(
      counterPricePence * offer.quantity,
      offer.shipping_cost_pence
    )

    const { data: updated, error } = await supabaseAdmin
      .from('offers')
      .update({
        status: 'countered',
        counter_price_pence: counterPricePence,
        counter_message: counterMessage ? xss(counterMessage.trim()).substring(0, 300) : null,
        countered_at: new Date().toISOString(),
        platform_fee_pence: breakdown.platformFeePence,
        platform_fee_pct: breakdown.platformFeePercentage,
        seller_payout_pence: breakdown.sellerPayoutPence
      })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json({ message: 'Counter-offer sent', offer: updated })
  } catch (err) {
    console.error('Counter offer error:', err)
    res.status(500).json({ error: 'Failed to send counter-offer' })
  }
})

/**
 * POST /api/offers/:id/accept
 * Buyer accepts a counter-offer, OR seller accepts original offer
 */
router.post('/:id/accept', requireAuth, async (req, res) => {
  try {
    const { data: offer, error: fetchError } = await supabaseAdmin
      .from('offers')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (fetchError || !offer) {
      return res.status(404).json({ error: 'Offer not found' })
    }

    // Seller accepts original offer
    const sellerAccepting = offer.seller_id === req.user.id && offer.status === 'pending'
    // Buyer accepts counter-offer
    const buyerAccepting = offer.buyer_id === req.user.id && offer.status === 'countered'

    if (!sellerAccepting && !buyerAccepting) {
      return res.status(400).json({ error: 'You cannot accept this offer' })
    }

    const agreedPrice = buyerAccepting
      ? offer.counter_price_pence
      : offer.offered_price_pence

    // Recalculate fees on agreed price
    const breakdown = await buildOrderBreakdown(
      agreedPrice * offer.quantity,
      offer.shipping_cost_pence
    )

    const { data: updated, error } = await supabaseAdmin
      .from('offers')
      .update({
        status: 'accepted',
        agreed_price_pence: agreedPrice,
        platform_fee_pence: breakdown.platformFeePence,
        platform_fee_pct: breakdown.platformFeePercentage,
        seller_payout_pence: breakdown.sellerPayoutPence
      })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json({ message: 'Offer accepted — proceed to checkout', offer: updated })
  } catch (err) {
    console.error('Accept offer error:', err)
    res.status(500).json({ error: 'Failed to accept offer' })
  }
})

/**
 * POST /api/offers/:id/decline
 * Either party declines
 */
router.post('/:id/decline', requireAuth, async (req, res) => {
  try {
    const { data: offer, error: fetchError } = await supabaseAdmin
      .from('offers')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (fetchError || !offer) {
      return res.status(404).json({ error: 'Offer not found' })
    }

    const canDecline =
      (offer.seller_id === req.user.id && offer.status === 'pending') ||
      (offer.buyer_id === req.user.id && offer.status === 'countered')

    if (!canDecline) {
      return res.status(400).json({ error: 'You cannot decline this offer' })
    }

    const { data: updated, error } = await supabaseAdmin
      .from('offers')
      .update({ status: 'declined' })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json({ message: 'Offer declined', offer: updated })
  } catch (err) {
    console.error('Decline offer error:', err)
    res.status(500).json({ error: 'Failed to decline offer' })
  }
})

/**
 * GET /api/offers/:id/messages
 * Get messages for a paid offer
 */
router.get('/:id/messages', requireAuth, async (req, res) => {
  try {
    // Verify user is party to this offer and it's paid
    const { data: offer, error: offerError } = await supabaseAdmin
      .from('offers')
      .select('id, buyer_id, seller_id, status')
      .eq('id', req.params.id)
      .single()

    if (offerError || !offer) {
      return res.status(404).json({ error: 'Offer not found' })
    }

    if (offer.buyer_id !== req.user.id && offer.seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorised' })
    }

    if (offer.status !== 'paid') {
      return res.status(403).json({ error: 'Messages are only available after payment' })
    }

    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select(`
        id, content, created_at,
        sender:sender_id ( id, anonymous_handle )
      `)
      .eq('offer_id', req.params.id)
      .order('created_at', { ascending: true })

    if (error) throw error
    res.json({ messages })
  } catch (err) {
    console.error('Get messages error:', err)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

/**
 * POST /api/offers/:id/messages
 * Send a message on a paid offer
 */
router.post('/:id/messages', requireAuth, async (req, res) => {
  try {
    const { content } = req.body

    if (!content || content.trim().length < 1) {
      return res.status(400).json({ error: 'Message cannot be empty' })
    }

    // Verify paid offer and user is a party
    const { data: offer, error: offerError } = await supabaseAdmin
      .from('offers')
      .select('id, buyer_id, seller_id, status')
      .eq('id', req.params.id)
      .single()

    if (offerError || !offer) return res.status(404).json({ error: 'Offer not found' })
    if (offer.buyer_id !== req.user.id && offer.seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorised' })
    }
    if (offer.status !== 'paid') {
      return res.status(403).json({ error: 'Messages only available after payment' })
    }

    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .insert({
        offer_id: req.params.id,
        sender_id: req.user.id,
        content: xss(content.trim()).substring(0, 1000)
      })
      .select(`id, content, created_at, sender:sender_id ( id, anonymous_handle )`)
      .single()

    if (error) throw error
    res.status(201).json({ message })
  } catch (err) {
    console.error('Send message error:', err)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

module.exports = router
