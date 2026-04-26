import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

function formatPrice(pence) {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
}

const STATUS_CONFIG = {
  pending:   { label: 'Awaiting response', class: 'badge-pending', description: 'Waiting for the seller to respond' },
  countered: { label: 'Counter received',  class: 'badge-pending', description: 'Seller has made a counter-offer' },
  accepted:  { label: 'Accepted',          class: 'badge-approved', description: 'Ready for payment' },
  declined:  { label: 'Declined',          class: 'badge-rejected', description: 'This offer was declined' },
  paid:      { label: 'Paid',              class: 'badge-approved', description: 'Transaction complete' },
  cancelled: { label: 'Cancelled',         class: 'badge-removed', description: 'This offer was cancelled' },
  expired:   { label: 'Expired',           class: 'badge-removed', description: 'This offer expired' },
}

export default function OffersPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [counterForm, setCounterForm] = useState({ offerId: null, price: '', message: '' })
  const [checkoutLoading, setCheckoutLoading] = useState(null)

  const cancelled = new URLSearchParams(location.search).get('cancelled')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadOffers() }, [])

  async function loadOffers() {
    setLoading(true)
    try {
      const data = await api.getOffers()
      setOffers(data.offers)
    } catch (err) {
      setError('Failed to load offers')
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept(offerId) {
    setActionLoading(offerId)
    try {
      await api.acceptOffer(offerId)
      await loadOffers()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDecline(offerId) {
    setActionLoading(offerId)
    try {
      await api.declineOffer(offerId)
      await loadOffers()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
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
      await loadOffers()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCheckout(offerId) {
    setCheckoutLoading(offerId)
    try {
      const data = await api.createCheckout(offerId)
      window.location.href = data.checkoutUrl
    } catch (err) {
      if (err.message.includes('SELLER_NOT_CONNECTED') || err.message.includes('not connected')) {
        setError('The seller has not yet set up their payment account. Please try again shortly.')
      } else {
        setError(err.message)
      }
    } finally {
      setCheckoutLoading(null)
    }
  }

  const buyingOffers = offers.filter(o => o.buyer?.id === profile?.id)
  const sellingOffers = offers.filter(o => o.seller?.id === profile?.id)

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="container">
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 4 }}>Offers</h1>
          <p style={{ color: 'var(--slate)', fontSize: 14 }}>Your active and recent offer activity</p>
        </div>

        {cancelled && (
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>
            Payment was cancelled — your offer is still active if you'd like to try again.
          </div>
        )}
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        {offers.length === 0 ? (
          <div className="empty-state">
            <h3>No offers yet</h3>
            <p>Browse listings and make an offer or direct purchase to get started.</p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/listings')}>
              Browse listings
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* Selling offers */}
            {sellingOffers.length > 0 && (
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 16 }}>
                  Offers on my listings ({sellingOffers.length})
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {sellingOffers.map(offer => (
                    <OfferCard
                      key={offer.id}
                      offer={offer}
                      perspective="seller"
                      currentUserId={profile?.id}
                      actionLoading={actionLoading}
                      checkoutLoading={checkoutLoading}
                      counterForm={counterForm}
                      setCounterForm={setCounterForm}
                      onAccept={handleAccept}
                      onDecline={handleDecline}
                      onCounter={handleCounter}
                      onCheckout={handleCheckout}
                      onViewOrder={() => navigate(`/orders/${offer.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Buying offers */}
            {buyingOffers.length > 0 && (
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 16 }}>
                  My offers ({buyingOffers.length})
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {buyingOffers.map(offer => (
                    <OfferCard
                      key={offer.id}
                      offer={offer}
                      perspective="buyer"
                      currentUserId={profile?.id}
                      actionLoading={actionLoading}
                      checkoutLoading={checkoutLoading}
                      counterForm={counterForm}
                      setCounterForm={setCounterForm}
                      onAccept={handleAccept}
                      onDecline={handleDecline}
                      onCounter={handleCounter}
                      onCheckout={handleCheckout}
                      onViewOrder={() => navigate(`/orders/${offer.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function OfferCard({ offer, perspective, currentUserId, actionLoading, checkoutLoading, counterForm, setCounterForm, onAccept, onDecline, onCounter, onCheckout, onViewOrder }) {
  const statusCfg = STATUS_CONFIG[offer.status] || { label: offer.status, class: 'badge-draft' }
  const isLoading = actionLoading === offer.id
  const isCheckingOut = checkoutLoading === offer.id
  const showCounterForm = counterForm.offerId === offer.id

  const agreedPrice = offer.agreed_price_pence || offer.offered_price_pence
  const displayPrice = offer.status === 'countered' && perspective === 'buyer'
    ? offer.counter_price_pence
    : offer.offered_price_pence

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto', gap: 0 }}>

        {/* Thumbnail */}
        <div style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {offer.listing?.image_urls?.length > 0 ? (
            <img src={offer.listing.image_urls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 10, color: 'var(--muted)', padding: 4, textAlign: 'center' }}>No image</span>
          )}
        </div>

        {/* Main content */}
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>{offer.listing?.title}</span>
            <span className={`badge ${statusCfg.class}`}>{statusCfg.label}</span>
            {offer.offer_type === 'direct' && (
              <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface)', padding: '2px 8px', borderRadius: 100, border: '1px solid var(--border)' }}>
                Direct purchase
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--muted)', flexWrap: 'wrap' }}>
            <span>{offer.listing?.brands?.name}</span>
            <span>{offer.quantity} unit{offer.quantity !== 1 ? 's' : ''}</span>
            <span>
              {offer.status === 'countered' && perspective === 'buyer'
                ? <>Counter: <strong style={{ color: 'var(--navy)' }}>{formatPrice(offer.counter_price_pence)}/unit</strong></>
                : <>Offer: <strong style={{ color: 'var(--navy)' }}>{formatPrice(offer.offered_price_pence)}/unit</strong></>
              }
            </span>
            {offer.status === 'paid' && (
              <span>Agreed: <strong style={{ color: 'var(--green)' }}>{formatPrice(offer.agreed_price_pence)}/unit</strong></span>
            )}
          </div>

          {/* Messages */}
          {offer.message && (
            <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--surface)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--slate)', borderLeft: '2px solid var(--border)' }}>
              "{offer.message}"
            </div>
          )}
          {offer.counter_message && (
            <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--amber-bg)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--amber)', borderLeft: '2px solid var(--gold)' }}>
              Counter note: "{offer.counter_message}"
            </div>
          )}

          {/* Anonymity note */}
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
            {perspective === 'buyer' ? `Seller: ${offer.seller?.anonymous_handle}` : `Buyer: ${offer.buyer?.anonymous_handle}`}
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '14px 16px', borderLeft: '1px solid var(--border)', minWidth: 160, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>

          {/* Seller actions on pending offer */}
          {perspective === 'seller' && offer.status === 'pending' && (
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

          {/* Buyer actions on countered offer */}
          {perspective === 'buyer' && offer.status === 'countered' && (
            <>
              <button className="btn btn-outline btn-sm" style={{ justifyContent: 'center' }} onClick={() => onAccept(offer.id)} disabled={isLoading}>
                {isLoading ? '…' : 'Accept counter'}
              </button>
              <button className="btn btn-danger btn-sm" style={{ justifyContent: 'center' }} onClick={() => onDecline(offer.id)} disabled={isLoading}>
                {isLoading ? '…' : 'Decline'}
              </button>
            </>
          )}

          {/* Checkout button for accepted offers */}
          {offer.status === 'accepted' && offer.buyer?.id === currentUserId && (
            <button
              className="btn btn-gold btn-sm"
              style={{ justifyContent: 'center' }}
              onClick={() => onCheckout(offer.id)}
              disabled={isCheckingOut}
            >
              {isCheckingOut ? 'Loading…' : 'Pay now'}
            </button>
          )}

          {/* View order for paid offers */}
          {offer.status === 'paid' && (
            <button className="btn btn-outline btn-sm" style={{ justifyContent: 'center' }} onClick={onViewOrder}>
              View order
            </button>
          )}
        </div>
      </div>

      {/* Counter-offer form — expands inline */}
      {showCounterForm && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', background: 'var(--surface)' }}>
          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 12 }}>Make a counter-offer</h4>
          <form onSubmit={onCounter} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: '0 1 160px' }}>
              <label className="form-label">Counter price per unit (£)</label>
              <input
                className="form-input" type="number" min="0.01" step="0.01"
                value={counterForm.price}
                onChange={e => setCounterForm(f => ({ ...f, price: e.target.value }))}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px' }}>
              <label className="form-label">Note (optional, max 300 chars)</label>
              <input
                className="form-input" type="text"
                value={counterForm.message}
                onChange={e => setCounterForm(f => ({ ...f, message: e.target.value }))}
                maxLength={300}
                placeholder="Brief reason for counter…"
              />
            </div>
            <div style={{ display: 'flex', gap: 8, paddingBottom: 2 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={isLoading}>
                {isLoading ? 'Sending…' : 'Send counter'}
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setCounterForm({ offerId: null, price: '', message: '' })}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
