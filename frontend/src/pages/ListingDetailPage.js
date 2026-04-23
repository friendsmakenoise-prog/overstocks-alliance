import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import OfferModal from '../components/OfferModal'

function formatPrice(pence) {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
}

export default function ListingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reportReason, setReportReason] = useState('')
  const [reportSent, setReportSent] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [salePending, setSalePending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getListing(id)
        setListing(data.listing)

        // Check if there's an accepted offer on this listing
        const { data: acceptedOffers } = await supabase
          .from('offers')
          .select('id')
          .eq('listing_id', id)
          .eq('status', 'accepted')
          .limit(1)

        setSalePending(acceptedOffers && acceptedOffers.length > 0)
      } catch (err) {
        setError('This listing could not be found or you do not have access to it.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleReport(e) {
    e.preventDefault()
    try {
      await api.reportListing(id, reportReason)
      setReportSent(true)
      setShowReport(false)
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  if (error || !listing) {
    return (
      <div className="page">
        <div className="container">
          <div className="empty-state">
            <h3>Listing not found</h3>
            <p>{error || 'This listing does not exist or you do not have access.'}</p>
            <button className="btn btn-outline" style={{ marginTop: 20 }} onClick={() => navigate('/listings')}>
              Back to listings
            </button>
          </div>
        </div>
      </div>
    )
  }

  const totalValue = listing.price_pence * listing.quantity
  const shippingLine = listing.shipping_mode === 'included'
    ? `Shipping available — ${formatPrice(listing.shipping_cost_pence)}`
    : 'Buyer arranges own shipping'

  return (
    <div className="page">
      <div className="container">

        {/* Back link */}
        <button
          className="btn btn-outline btn-sm"
          style={{ marginBottom: 24 }}
          onClick={() => navigate('/listings')}
        >
          ← Back to listings
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 32, alignItems: 'start' }}>

          {/* Left: Images + description */}
          <div>
            {listing.image_urls?.length > 0 ? (
              <img
                src={listing.image_urls[0]}
                alt={listing.title}
                style={{
                  width: '100%', borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)', marginBottom: 24,
                  maxHeight: 480, objectFit: 'cover'
                }}
              />
            ) : (
              <div style={{
                width: '100%', height: 320, borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)', background: 'var(--surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--muted)', marginBottom: 24
              }}>
                No image provided
              </div>
            )}

            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 12 }}>
              About this listing
            </h2>
            <p style={{ color: 'var(--slate)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {listing.description}
            </p>
          </div>

          {/* Right: Summary card */}
          <div style={{ position: 'sticky', top: 80 }}>
            <div className="card">
              {/* Brand badge */}
              <div style={{
                display: 'inline-block', padding: '4px 12px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 100, fontSize: 12, fontWeight: 500,
                color: 'var(--gold)', textTransform: 'uppercase',
                letterSpacing: '0.08em', marginBottom: 12
              }}>
                {listing.brands?.name}
              </div>

              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, marginBottom: 8, lineHeight: 1.3 }}>
                {listing.title}
              </h1>

              {/* Price */}
              <div style={{ margin: '16px 0', padding: '16px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ color: 'var(--slate)', fontSize: 14 }}>Unit price</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>
                    {formatPrice(listing.price_pence)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)' }}>
                  <span>Quantity available</span>
                  <span>{listing.quantity} units</span>
                </div>
                {listing.quantity > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 500, color: 'var(--navy)', marginTop: 8 }}>
                    <span>Total value</span>
                    <span>{formatPrice(totalValue)}</span>
                  </div>
                )}
              </div>

              {/* Shipping */}
              <div style={{
                padding: '12px 14px', background: 'var(--surface)',
                borderRadius: 'var(--radius)', fontSize: 13,
                color: 'var(--slate)', marginBottom: 16
              }}>
                📦 {shippingLine}
              </div>

              {/* Seller anonymity notice */}
              <div style={{
                padding: '10px 14px',
                background: 'var(--amber-bg)',
                borderRadius: 'var(--radius)',
                fontSize: 12, color: 'var(--amber)',
                marginBottom: 20
              }}>
                🔒 Seller identity is protected. You'll connect through our secure platform only.
              </div>

              {/* CTA — opens offer modal */}
              {listing.status === 'sold' ? (
                <div style={{
                  padding: '12px 16px', background: 'var(--surface)',
                  borderRadius: 'var(--radius)', fontSize: 14,
                  color: 'var(--muted)', textAlign: 'center',
                  border: '1px solid var(--border)'
                }}>
                  ✓ This listing has been sold
                </div>
              ) : salePending ? (
                <div>
                  <div style={{
                    padding: '12px 16px', background: 'var(--amber-bg)',
                    borderRadius: 'var(--radius)', fontSize: 13,
                    color: 'var(--amber)', textAlign: 'center',
                    marginBottom: 10, border: '1px solid var(--gold)'
                  }}>
                    ⏳ Sale pending — an offer has been accepted and payment is awaited
                  </div>
                  <button
                    className="btn btn-outline btn-lg"
                    style={{ width: '100%', justifyContent: 'center', opacity: 0.5 }}
                    disabled
                  >
                    Buy now / Make an offer
                  </button>
                </div>
              ) : listing.seller_id !== profile?.id ? (
                <button
                  className="btn btn-gold btn-lg"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setShowOfferModal(true)}
                >
                  Buy now / Make an offer
                </button>
              ) : (
                <div style={{ padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
                  This is your listing
                </div>
              )}

              {/* Verified seller badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', background: 'var(--green-bg)',
                borderRadius: 'var(--radius)', fontSize: 13,
                color: 'var(--green)', marginBottom: 16
              }}>
                <span>✓</span>
                <span style={{ fontWeight: 500 }}>Verified seller</span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>— identity protected by platform</span>
              </div>

              {/* Report link */}
              {!reportSent ? (
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <button
                    onClick={() => setShowReport(!showReport)}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Report this listing
                  </button>
                </div>
              ) : (
                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--green)', marginTop: 12 }}>
                  ✓ Report submitted — thank you
                </p>
              )}

              {showReport && (
                <form onSubmit={handleReport} style={{ marginTop: 12 }}>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Describe the issue (min 10 characters)"
                    value={reportReason}
                    onChange={e => setReportReason(e.target.value)}
                    style={{ resize: 'vertical', marginBottom: 8 }}
                  />
                  <button type="submit" className="btn btn-danger btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                    Submit report
                  </button>
                </form>
              )}
            </div>

            <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 12 }}>
              Listed {new Date(listing.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              &nbsp;·&nbsp; {listing.view_count} view{listing.view_count !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>
      {showOfferModal && (
        <OfferModal
          listing={{ ...listing, anonymous_handle: listing.anonymous_handle }}
          onClose={() => setShowOfferModal(false)}
        />
      )}
    </div>
  )
}
