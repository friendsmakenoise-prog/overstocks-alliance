import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

function formatPrice(pence) {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
}

export default function OfferModal({ listing, onClose }) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [mode, setMode] = useState('choose') // choose | direct | offer
  const [buyerArrangesShipping, setBuyerArrangesShipping] = useState(false)
  const [offerPrice, setOfferPrice] = useState('')
  const [offerQty, setOfferQty] = useState(listing.quantity)
  const [offerShipping, setOfferShipping] = useState(
    listing.shipping_mode === 'included' ? 'accept' : 'arrange'
  )
  const [offerMessage, setOfferMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const listedPricePence = listing.price_pence
  const shippingPence = listing.shipping_cost_pence || 0
  const hasShipping = listing.shipping_mode === 'included' && shippingPence > 0
  const isPartialQty = parseInt(offerQty) < listing.quantity

  // Fee on goods value only — never on shipping
  function estimateFee(goodsPence) {
    if (goodsPence >= 500000) return { pct: 1, fee: Math.round(goodsPence * 0.01) }
    if (goodsPence >= 100000) return { pct: 2, fee: Math.round(goodsPence * 0.02) }
    return { pct: 3, fee: Math.round(goodsPence * 0.03) }
  }

  const directGoodsTotal = listedPricePence * listing.quantity
  const directFee = estimateFee(directGoodsTotal)
  const directShipping = !buyerArrangesShipping && hasShipping ? shippingPence : 0
  const directBuyerTotal = directGoodsTotal + directShipping

  async function handleDirect() {
    setLoading(true)
    setError('')
    try {
      const data = await api.createOffer({
        listingId: listing.id,
        offerType: 'direct',
        quantity: listing.quantity,
        offeredPricePounds: (listedPricePence / 100).toFixed(2),
        buyerArrangesShipping
      })
      const checkout = await api.createCheckout(data.offer.id)
      window.location.href = checkout.checkoutUrl
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  async function handleOffer(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.createOffer({
        listingId: listing.id,
        offerType: 'offer',
        quantity: parseInt(offerQty),
        offeredPricePounds: parseFloat(offerPrice).toFixed(2),
        buyerArrangesShipping: offerShipping === 'arrange',
        message: offerMessage || undefined
      })
      navigate('/')
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(11,22,40,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 300, padding: 20
    }}>
      <div className="card" style={{ maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 4 }}>
              {mode === 'choose' ? 'How would you like to proceed?'
               : mode === 'direct' ? 'Confirm purchase'
               : 'Make an offer'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>{listing.title}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--muted)', lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        {/* ── MODE SELECTION ── */}
        {mode === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => setMode('direct')}
              style={{
                padding: '16px 20px', border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-lg)', background: 'var(--white)',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--navy)'; e.currentTarget.style.background = 'var(--surface)' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--white)' }}
            >
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Buy now — full quantity</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                Purchase all {listing.quantity} units at the listed price.
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>
                {formatPrice(directGoodsTotal)}
                {hasShipping && (
                  <span style={{ fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--muted)', marginLeft: 8 }}>
                    + {formatPrice(shippingPence)} shipping (optional)
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                Platform fee ~{directFee.pct}% on goods value
              </div>
            </button>

            <button
              onClick={() => setMode('offer')}
              style={{
                padding: '16px 20px', border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-lg)', background: 'var(--white)',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--navy)'; e.currentTarget.style.background = 'var(--surface)' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--white)' }}
            >
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Make an offer</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                Negotiate on price or request a partial quantity.
              </div>
            </button>
          </div>
        )}

        {/* ── DIRECT PURCHASE ── */}
        {mode === 'direct' && (
          <div>
            {/* Shipping choice — only show if listing has shipping included */}
            {hasShipping && (
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Delivery</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    {
                      value: false,
                      label: 'Accept delivery',
                      hint: `+${formatPrice(shippingPence)} added to total`,
                      detail: 'Seller arranges delivery to you'
                    },
                    {
                      value: true,
                      label: 'I arrange collection',
                      hint: 'No shipping cost added',
                      detail: 'You collect or book your own courier'
                    }
                  ].map(opt => (
                    <label key={String(opt.value)} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '12px 14px', border: '1.5px solid',
                      borderColor: buyerArrangesShipping === opt.value ? 'var(--navy)' : 'var(--border)',
                      borderRadius: 'var(--radius)', cursor: 'pointer',
                      background: buyerArrangesShipping === opt.value ? 'var(--surface)' : 'var(--white)',
                      transition: 'all 0.15s'
                    }}>
                      <input
                        type="radio"
                        name="directShipping"
                        checked={buyerArrangesShipping === opt.value}
                        onChange={() => setBuyerArrangesShipping(opt.value)}
                        style={{ marginTop: 2, accentColor: 'var(--navy)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{opt.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 500 }}>{opt.hint}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{opt.detail}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Order summary */}
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 16 }}>
              {[
                { label: `${listing.quantity} units × ${formatPrice(listedPricePence)}`, value: formatPrice(directGoodsTotal) },
                !buyerArrangesShipping && hasShipping && { label: 'Delivery (seller arranges)', value: formatPrice(shippingPence) },
                buyerArrangesShipping && hasShipping && { label: 'Delivery', value: 'Buyer arranges', muted: true },
                { label: `Platform fee (~${directFee.pct}% on goods)`, value: `−${formatPrice(directFee.fee)}`, muted: true, note: 'deducted from seller' },
                { label: 'You pay', value: formatPrice(directBuyerTotal), bold: true }
              ].filter(Boolean).map((row, i, arr) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 14, marginBottom: i < arr.length - 1 ? 6 : 0,
                  paddingTop: row.bold ? 10 : 0,
                  borderTop: row.bold ? '1px solid var(--border-dark)' : 'none',
                  marginTop: row.bold ? 10 : 0
                }}>
                  <div>
                    <span style={{ color: row.muted ? 'var(--muted)' : 'var(--slate)' }}>{row.label}</span>
                    {row.note && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>({row.note})</span>}
                  </div>
                  <span style={{
                    fontWeight: row.bold ? 600 : 400,
                    fontFamily: row.bold ? 'var(--font-display)' : 'inherit',
                    fontSize: row.bold ? 22 : 14,
                    color: row.muted ? 'var(--muted)' : 'var(--navy)'
                  }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="alert alert-info" style={{ marginBottom: 16, fontSize: 12 }}>
              🔒 Transacting with a <strong>Verified seller</strong>. Identities protected — you'll be assigned a one-time codename.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setMode('choose')} disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>Back</button>
              <button className="btn btn-gold btn-lg" onClick={handleDirect} disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
                {loading ? 'Redirecting…' : 'Proceed to payment →'}
              </button>
            </div>
          </div>
        )}

        {/* ── OFFER FORM ── */}
        {mode === 'offer' && (
          <form onSubmit={handleOffer}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Your price per unit (£) *</label>
                <input
                  className="form-input" type="number"
                  min="0.01" step="0.01"
                  value={offerPrice}
                  onChange={e => setOfferPrice(e.target.value)}
                  placeholder={`Listed: £${(listedPricePence / 100).toFixed(2)}`}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input
                  className="form-input" type="number"
                  min="1" max={listing.quantity}
                  value={offerQty}
                  onChange={e => setOfferQty(e.target.value)}
                  required
                />
                <span className="form-hint">{listing.quantity} available</span>
              </div>
            </div>

            {/* Shipping choice for offer */}
            <div className="form-group">
              <label className="form-label">Delivery</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  {
                    value: 'accept',
                    label: hasShipping ? 'Accept delivery' : 'Request delivery',
                    hint: hasShipping ? `+${formatPrice(shippingPence)}` : 'Ask seller to arrange',
                    detail: hasShipping ? 'Seller arranges delivery' : 'Seller may counter on this'
                  },
                  {
                    value: 'arrange',
                    label: 'I arrange collection',
                    hint: 'No shipping cost',
                    detail: 'You collect or book courier'
                  }
                ].map(opt => (
                  <label key={opt.value} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '12px 14px', border: '1.5px solid',
                    borderColor: offerShipping === opt.value ? 'var(--navy)' : 'var(--border)',
                    borderRadius: 'var(--radius)', cursor: 'pointer',
                    background: offerShipping === opt.value ? 'var(--surface)' : 'var(--white)',
                    transition: 'all 0.15s'
                  }}>
                    <input
                      type="radio" name="offerShipping" value={opt.value}
                      checked={offerShipping === opt.value}
                      onChange={() => setOfferShipping(opt.value)}
                      style={{ marginTop: 2, accentColor: 'var(--navy)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 500 }}>{opt.hint}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{opt.detail}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {isPartialQty && (
              <div className="alert alert-warning" style={{ marginBottom: 12 }}>
                Partial quantities must go through the offer process — seller must accept before payment.
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Message (optional, max 300 chars)</label>
              <textarea
                className="form-input" rows={2}
                value={offerMessage}
                onChange={e => setOfferMessage(e.target.value)}
                maxLength={300}
                placeholder="Brief note to the seller (no contact details)…"
                style={{ resize: 'none' }}
              />
              <span className="form-hint">{offerMessage.length}/300</span>
            </div>

            <div className="alert alert-info" style={{ marginBottom: 16, fontSize: 12 }}>
              Seller can accept, decline, or counter once. If accepted you'll be prompted to pay.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-outline" onClick={() => setMode('choose')} disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>Back</button>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
                {loading ? 'Sending…' : 'Send offer →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
