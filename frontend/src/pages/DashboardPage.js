import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { getCounterpartyCodename, getMyCodename } from '../lib/codenames'

function formatPrice(pence) {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

const STATUS_CONFIG = {
  pending:   { label: 'Awaiting your response', urgent: true,  color: 'var(--amber)',  bg: 'var(--amber-bg)' },
  countered: { label: 'Counter received',        urgent: true,  color: 'var(--amber)',  bg: 'var(--amber-bg)' },
  accepted:  { label: 'Ready to pay',            urgent: true,  color: 'var(--green)',  bg: 'var(--green-bg)' },
  paid:      { label: 'Paid',                    urgent: false, color: 'var(--green)',  bg: 'var(--green-bg)' },
  declined:  { label: 'Declined',                urgent: false, color: 'var(--muted)',  bg: 'var(--surface)'  },
  cancelled: { label: 'Cancelled',               urgent: false, color: 'var(--muted)',  bg: 'var(--surface)'  },
  expired:   { label: 'Expired',                 urgent: false, color: 'var(--muted)',  bg: 'var(--surface)'  },
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [offers, setOffers] = useState([])
  const [myListings, setMyListings] = useState([])
  const [brandReviews, setBrandReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [counterForm, setCounterForm] = useState({ offerId: null, price: '', message: '' })
  const [checkoutLoading, setCheckoutLoading] = useState(null)
  const [error, setError] = useState('')

  // Profile is guaranteed to exist here — ProtectedRoute waits for it
  useEffect(() => { loadAll() }, [profile?.id])

  async function loadAll() {
    setLoading(true)
    try {
      const promises = [api.getOffers(), api.getListings()]
      if (profile?.role === 'supplier') {
        promises.push(api.getMyBrandReviews())
      }
      const [offersData, listingsData, reviewsData] = await Promise.all(promises)
      setOffers(offersData.offers || [])
      setMyListings(listingsData.listings || [])
      if (reviewsData) setBrandReviews(reviewsData.reviews || [])
    } catch (err) {
      setError('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept(offerId) {
    setActionLoading(offerId)
    try {
      await api.acceptOffer(offerId)
      await loadAll()
    } catch (err) { setError(err.message) }
    finally { setActionLoading(null) }
  }

  async function handleDecline(offerId) {
    setActionLoading(offerId)
    try {
      await api.declineOffer(offerId)
      await loadAll()
    } catch (err) { setError(err.message) }
    finally { setActionLoading(null) }
  }

  async function handleCounter(e) {
    e.preventDefault()
    setActionLoading(counterForm.offerId)
    try {
      await api.counterOffer(counterForm.offerId, {
        counterPricePounds: counterForm.price,
        counterMessage: counterForm.message
      })
      setCounterForm({ offerId: null, price: '', message: '' })
      await loadAll()
    } catch (err) { setError(err.message) }
    finally { setActionLoading(null) }
  }

  async function handleCheckout(offerId) {
    setCheckoutLoading(offerId)
    try {
      const data = await api.createCheckout(offerId)
      window.location.href = data.checkoutUrl
    } catch (err) {
      setError(err.message.includes('not connected')
        ? 'The seller has not yet connected their payment account. Please try again shortly.'
        : err.message)
      setCheckoutLoading(null)
    }
  }

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  // Categorise offers
  const needsAction = offers.filter(o => {
    const isSeller = o.seller?.id === profile?.id
    const isBuyer  = o.buyer?.id  === profile?.id
    return (
      (isSeller && o.status === 'pending') ||
      (isBuyer  && o.status === 'countered') ||
      (isBuyer  && o.status === 'accepted')
    )
  })

  const activeOffers = offers.filter(o =>
    ['pending', 'countered', 'accepted'].includes(o.status) &&
    !needsAction.includes(o)
  )

  const recentOrders = offers.filter(o => o.status === 'paid').slice(0, 5)

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 4 }}>
            Welcome back, {profile?.anonymous_handle}
          </h1>
          <p style={{ color: 'var(--slate)', fontSize: 14 }}>
            {needsAction.length > 0
              ? `You have ${needsAction.length} item${needsAction.length !== 1 ? 's' : ''} needing your attention`
              : 'Everything is up to date'}
          </p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'Needs attention', value: needsAction.length, urgent: needsAction.length > 0, onClick: () => {} },
            { label: 'Active offers',   value: activeOffers.length, onClick: () => {} },
            { label: 'Completed orders',value: recentOrders.length, onClick: () => navigate('/offers') },
            { label: 'My listings',     value: myListings.length,   onClick: () => navigate('/my-listings') },
          ].map((card, i) => (
            <button key={i} onClick={card.onClick} style={{
              background: card.urgent ? 'var(--amber-bg)' : 'var(--color-background-secondary, #f7f9fc)',
              border: `1px solid ${card.urgent ? 'var(--amber)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-lg)', padding: '16px 20px',
              textAlign: 'left', cursor: card.onClick ? 'pointer' : 'default',
              transition: 'all 0.15s'
            }}>
              <div style={{ fontSize: 28, fontFamily: 'var(--font-display)', color: card.urgent ? 'var(--amber)' : 'var(--navy)', fontWeight: 400 }}>
                {card.value}
              </div>
              <div style={{ fontSize: 13, color: card.urgent ? 'var(--amber)' : 'var(--muted)', marginTop: 2 }}>
                {card.label}
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>

          {/* Main: Needs attention + active offers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Needs attention */}
            {needsAction.length > 0 && (
              <section>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Needs your attention
                  <span style={{ background: 'var(--amber)', color: '#fff', fontSize: 12, padding: '2px 8px', borderRadius: 100, fontFamily: 'var(--font-body)', fontWeight: 500 }}>
                    {needsAction.length}
                  </span>
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {needsAction.map(offer => (
                    <OfferCard
                      key={offer.id}
                      offer={offer}
                      profile={profile}
                      actionLoading={actionLoading}
                      checkoutLoading={checkoutLoading}
                      counterForm={counterForm}
                      setCounterForm={setCounterForm}
                      onAccept={handleAccept}
                      onDecline={handleDecline}
                      onCounter={handleCounter}
                      onCheckout={handleCheckout}
                      onView={() => navigate(`/orders/${offer.id}`)}
                      highlight
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Active offers — waiting on other party */}
            {activeOffers.length > 0 && (
              <section>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 12, color: 'var(--slate)' }}>
                  Waiting on other party
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeOffers.map(offer => (
                    <OfferCard
                      key={offer.id}
                      offer={offer}
                      profile={profile}
                      actionLoading={actionLoading}
                      checkoutLoading={checkoutLoading}
                      counterForm={counterForm}
                      setCounterForm={setCounterForm}
                      onAccept={handleAccept}
                      onDecline={handleDecline}
                      onCounter={handleCounter}
                      onCheckout={handleCheckout}
                      onView={() => navigate(`/orders/${offer.id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {needsAction.length === 0 && activeOffers.length === 0 && (
              <div className="empty-state">
                <h3>No active offers</h3>
                <p>Browse listings to make a purchase or submit an offer.</p>
                <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/listings')}>
                  Browse listings
                </button>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Brand eligibility reviews — suppliers only */}
            {profile?.role === 'supplier' && brandReviews.filter(r => r.status === 'pending').length > 0 && (
              <div className="card" style={{ borderColor: 'var(--amber)', border: '1.5px solid var(--amber)' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 4 }}>
                  Brand eligibility reviews
                  <span style={{ marginLeft: 8, background: 'var(--amber)', color: '#fff', fontSize: 12, padding: '2px 8px', borderRadius: 100, fontFamily: 'var(--font-body)', fontWeight: 500 }}>
                    {brandReviews.filter(r => r.status === 'pending').length}
                  </span>
                </h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
                  An admin has requested your input on a new member's brand eligibility.
                </p>
                {brandReviews.filter(r => r.status === 'pending').map(review => (
                  <BrandReviewCard key={review.id} review={review} onRespond={loadAll} />
                ))}
              </div>
            )}

            {/* Quick actions */}
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 14 }}>Quick actions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn btn-primary" style={{ justifyContent: 'space-between' }} onClick={() => navigate('/listings')}>
                  Browse listings <span>→</span>
                </button>
                {(profile?.role === 'supplier' || profile?.role === 'retailer') && (
                  <button className="btn btn-outline" style={{ justifyContent: 'space-between' }} onClick={() => navigate('/listings/new')}>
                    Create listing <span>→</span>
                  </button>
                )}
                {(profile?.role === 'supplier' || profile?.role === 'retailer') && (
                  <button className="btn btn-outline" style={{ justifyContent: 'space-between' }} onClick={() => navigate('/my-listings')}>
                    My listings <span>→</span>
                  </button>
                )}
                {(profile?.role === 'supplier' || profile?.role === 'retailer') && (
                  <button className="btn btn-outline" style={{ justifyContent: 'space-between' }} onClick={() => navigate('/settings/payments')}>
                    Payment settings <span>→</span>
                  </button>
                )}
              </div>
            </div>

            {/* Recent orders */}
            {recentOrders.length > 0 && (
              <div className="card">
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 14 }}>Recent orders</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recentOrders.map(order => {
                    const isBuyer = order.buyer?.id === profile?.id
                    return (
                      <button
                        key={order.id}
                        onClick={() => navigate(`/orders/${order.id}`)}
                        style={{
                          background: 'none', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)', padding: '10px 12px',
                          textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                          width: '100%'
                        }}
                        onMouseOver={e => e.currentTarget.style.borderColor = 'var(--navy)'}
                        onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 3, color: 'var(--navy)' }}>
                          {order.listing?.title}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
                          <span>{isBuyer ? 'Bought' : 'Sold'} · {formatPrice((order.agreed_price_pence || order.offered_price_pence) * order.quantity)}</span>
                          <span style={{ color: 'var(--green)', fontWeight: 500 }}>✓ Paid</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Offer card component ──────────────────────────────────────
function OfferCard({ offer, profile, actionLoading, checkoutLoading, counterForm, setCounterForm, onAccept, onDecline, onCounter, onCheckout, onView, highlight }) {
  const isSeller = offer.seller?.id === profile?.id
  const isBuyer  = offer.buyer?.id  === profile?.id
  const isLoading = actionLoading === offer.id
  const isCheckingOut = checkoutLoading === offer.id
  const showCounterForm = counterForm.offerId === offer.id
  const cfg = STATUS_CONFIG[offer.status] || { label: offer.status, color: 'var(--muted)', bg: 'var(--surface)' }

  const displayPrice = offer.status === 'countered' && isBuyer
    ? offer.counter_price_pence
    : offer.offered_price_pence

  const totalValue = displayPrice * offer.quantity

  // What action does THIS user need to take?
  const sellerNeedsToRespond  = isSeller && offer.status === 'pending'
  const buyerNeedsToRespond   = isBuyer  && offer.status === 'countered'
  const buyerNeedsToPay       = isBuyer  && offer.status === 'accepted'
  const sellerWaiting         = isSeller && offer.status === 'countered'
  const buyerWaiting          = isBuyer  && offer.status === 'pending'

  return (
    <div style={{
      border: `1.5px solid ${highlight ? cfg.color : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      background: 'var(--white)',
      overflow: 'hidden',
      transition: 'box-shadow 0.2s'
    }}>
      {/* Status bar */}
      <div style={{
        padding: '8px 16px',
        background: cfg.bg,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${highlight ? cfg.color + '44' : 'var(--border)'}`
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: cfg.color }}>
          {sellerNeedsToRespond ? '⚡ Offer received — respond required'
           : buyerNeedsToRespond ? '⚡ Counter-offer received — your move'
           : buyerNeedsToPay    ? '✓ Accepted — payment required'
           : sellerWaiting      ? '⏳ Counter sent — awaiting buyer'
           : buyerWaiting       ? '⏳ Offer sent — awaiting seller'
           : cfg.label}
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
          {new Date(offer.updated_at || offer.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 12, alignItems: 'start' }}>

          {/* Thumbnail */}
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
            {offer.listing?.image_urls?.length > 0
              ? <img src={offer.listing.image_urls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--muted)' }}>No img</div>
            }
          </div>

          {/* Details */}
          <div>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 3, color: 'var(--navy)' }}>
              {offer.listing?.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span>{offer.listing?.brands?.name}</span>
              <span>{offer.quantity} unit{offer.quantity !== 1 ? 's' : ''}</span>
              <span style={{ fontWeight: 500, color: 'var(--navy)' }}>
                {formatPrice(displayPrice)}/unit
                {offer.status === 'countered' && isBuyer && (
                  <span style={{ color: 'var(--muted)', fontWeight: 400 }}> (was {formatPrice(offer.offered_price_pence)})</span>
                )}
              </span>
              <span style={{ color: 'var(--slate)', fontWeight: 500 }}>= {formatPrice(totalValue)}</span>
            </div>

            {/* Message/counter note */}
            {offer.message && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--slate)', fontStyle: 'italic' }}>
                "{offer.message}"
              </div>
            )}
            {offer.counter_message && isBuyer && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--amber)', fontStyle: 'italic' }}>
                Seller note: "{offer.counter_message}"
              </div>
            )}

            {/* Counterparty codename — unique per transaction */}
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
              {isBuyer
                ? `Counterparty: ${getCounterpartyCodename(offer.id, offer.seller?.id || '')}`
                : `Counterparty: ${getCounterpartyCodename(offer.id, offer.buyer?.id || '')}`
              }
              <span style={{ marginLeft: 6, color: 'var(--green)', fontSize: 10 }}>· one-time alias</span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 120 }}>
            {sellerNeedsToRespond && (
              <>
                <button className="btn btn-outline btn-sm" style={{ justifyContent: 'center' }} onClick={() => onAccept(offer.id)} disabled={isLoading}>
                  {isLoading ? '…' : 'Accept'}
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ justifyContent: 'center' }}
                  onClick={() => setCounterForm({ offerId: offer.id, price: (offer.offered_price_pence / 100).toFixed(2), message: '' })}
                  disabled={isLoading}
                >
                  Counter
                </button>
                <button className="btn btn-danger btn-sm" style={{ justifyContent: 'center' }} onClick={() => onDecline(offer.id)} disabled={isLoading}>
                  {isLoading ? '…' : 'Decline'}
                </button>
              </>
            )}

            {buyerNeedsToRespond && (
              <>
                <button className="btn btn-outline btn-sm" style={{ justifyContent: 'center' }} onClick={() => onAccept(offer.id)} disabled={isLoading}>
                  {isLoading ? '…' : 'Accept'}
                </button>
                <button className="btn btn-danger btn-sm" style={{ justifyContent: 'center' }} onClick={() => onDecline(offer.id)} disabled={isLoading}>
                  {isLoading ? '…' : 'Decline'}
                </button>
              </>
            )}

            {buyerNeedsToPay && (
              <button className="btn btn-gold btn-sm" style={{ justifyContent: 'center' }} onClick={() => onCheckout(offer.id)} disabled={isCheckingOut}>
                {isCheckingOut ? 'Loading…' : '💳 Pay now'}
              </button>
            )}

            {offer.status === 'paid' && (
              <button className="btn btn-outline btn-sm" style={{ justifyContent: 'center' }} onClick={onView}>
                View order
              </button>
            )}

            {(sellerWaiting || buyerWaiting) && (
              <span style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '4px 0' }}>
                Awaiting response
              </span>
            )}
          </div>
        </div>

        {/* Counter form — expands inline */}
        {showCounterForm && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Your counter-offer</h4>
            <form onSubmit={onCounter} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: '0 1 160px' }}>
                <label className="form-label">Counter price per unit (£)</label>
                <input
                  className="form-input" type="number" min="0.01" step="0.01"
                  value={counterForm.price}
                  onChange={e => setCounterForm(f => ({ ...f, price: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: '1 1 180px' }}>
                <label className="form-label">Note (optional, 300 chars)</label>
                <input
                  className="form-input" type="text"
                  value={counterForm.message}
                  onChange={e => setCounterForm(f => ({ ...f, message: e.target.value }))}
                  maxLength={300}
                  placeholder="Brief reason…"
                />
              </div>
              <div style={{ display: 'flex', gap: 8, paddingBottom: 2 }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={actionLoading === counterForm.offerId}>
                  {actionLoading === counterForm.offerId ? '…' : 'Send'}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setCounterForm({ offerId: null, price: '', message: '' })}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Brand Review Card (supplier only) ────────────────────────
function BrandReviewCard({ review, onRespond }) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [responded, setResponded] = useState(false)

  async function respond(decision) {
    setLoading(true)
    try {
      await api.respondToBrandReview(review.id, { decision, notes })
      setResponded(true)
      onRespond()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (responded) {
    return (
      <div style={{ padding: '12px 14px', background: 'var(--green-bg)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--green)', marginBottom: 10 }}>
        ✓ Response submitted — admin has been notified
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 10 }}>
      <div style={{ padding: '12px 14px', background: 'var(--surface)' }}>
        <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
          Brand: <span style={{ color: 'var(--gold)' }}>{review.brand?.name}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Applicant role: <span style={{ textTransform: 'capitalize' }}>{review.applicant?.role}</span>
          {' · '}Requested {new Date(review.requested_at).toLocaleDateString('en-GB')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          Expires: {new Date(review.expires_at).toLocaleDateString('en-GB')}
        </div>
      </div>
      <div style={{ padding: '12px 14px' }}>
        <div className="form-group" style={{ marginBottom: 10 }}>
          <label className="form-label">Your notes (optional)</label>
          <textarea
            className="form-input" rows={2}
            value={notes} onChange={e => setNotes(e.target.value)}
            maxLength={500}
            placeholder="Any notes for the admin about this applicant's eligibility…"
            style={{ resize: 'none' }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            className="btn btn-outline btn-sm"
            style={{ justifyContent: 'center', borderColor: 'var(--green)', color: 'var(--green)' }}
            onClick={() => respond('approved')}
            disabled={loading}
          >
            ✓ Recommend approval
          </button>
          <button
            className="btn btn-danger btn-sm"
            style={{ justifyContent: 'center' }}
            onClick={() => respond('declined')}
            disabled={loading}
          >
            ✗ Recommend decline
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
          Your response is advisory — the final decision rests with the platform admin.
        </p>
      </div>
    </div>
  )
}
