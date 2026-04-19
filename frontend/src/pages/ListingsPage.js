import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

function formatPrice(pence) {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
}

export default function ListingsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ brand_id: '', min_price: '', max_price: '' })

  const approvedBrands = profile?.approvedBrands || []

  useEffect(() => {
    loadListings()
  }, [filters])

  async function loadListings() {
    setLoading(true)
    try {
      const params = {}
      if (filters.brand_id) params.brand_id = filters.brand_id
      if (filters.min_price) params.min_price = filters.min_price
      if (filters.max_price) params.max_price = filters.max_price

      const data = await api.getListings(params)
      setListings(data.listings)
    } catch (err) {
      setError('Failed to load listings')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 4 }}>
              Available stock
            </h1>
            <p style={{ color: 'var(--slate)', fontSize: 14 }}>
              Showing listings for your {approvedBrands.length} approved brand{approvedBrands.length !== 1 ? 's' : ''}
            </p>
          </div>
          {profile?.role === 'supplier' && (
            <button className="btn btn-primary" onClick={() => navigate('/listings/new')}>
              + New listing
            </button>
          )}
        </div>

        {/* Filters */}
        {approvedBrands.length > 0 && (
          <div className="card" style={{ marginBottom: 24, padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Brand</label>
                <select
                  className="form-input"
                  value={filters.brand_id}
                  onChange={e => setFilters(f => ({ ...f, brand_id: e.target.value }))}
                >
                  <option value="">All my brands</option>
                  {approvedBrands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '0 1 140px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Min price (£)</label>
                <input
                  className="form-input" type="number" min="0" step="1"
                  placeholder="0"
                  value={filters.min_price}
                  onChange={e => setFilters(f => ({ ...f, min_price: e.target.value }))}
                />
              </div>
              <div style={{ flex: '0 1 140px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Max price (£)</label>
                <input
                  className="form-input" type="number" min="0" step="1"
                  placeholder="Any"
                  value={filters.max_price}
                  onChange={e => setFilters(f => ({ ...f, max_price: e.target.value }))}
                />
              </div>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setFilters({ brand_id: '', min_price: '', max_price: '' })}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && <div className="alert alert-error">{error}</div>}

        {/* Loading */}
        {loading && (
          <div className="loading-page"><div className="spinner" /></div>
        )}

        {/* No brands approved yet */}
        {!loading && approvedBrands.length === 0 && (
          <div className="empty-state">
            <h3>No brands assigned yet</h3>
            <p>Your account is approved but you haven't been assigned any brands yet.<br />
              Contact an administrator to get brand access.
            </p>
          </div>
        )}

        {/* No listings found */}
        {!loading && approvedBrands.length > 0 && listings.length === 0 && (
          <div className="empty-state">
            <h3>No listings found</h3>
            <p>There are no active listings matching your filters right now.<br />
              Check back soon or adjust your search.
            </p>
          </div>
        )}

        {/* Listings grid */}
        {!loading && listings.length > 0 && (
          <div className="listings-grid">
            {listings.map(listing => (
              <div
                key={listing.id}
                className="listing-card"
                onClick={() => navigate(`/listings/${listing.id}`)}
              >
                {listing.image_urls?.length > 0 ? (
                  <img
                    src={listing.image_urls[0]}
                    alt={listing.title}
                    className="listing-card-image"
                  />
                ) : (
                  <div className="listing-card-image" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--muted)', fontSize: 13
                  }}>
                    No image
                  </div>
                )}

                <div className="listing-card-body">
                  <div className="listing-card-brand">{listing.brands?.name}</div>
                  <div className="listing-card-title">{listing.title}</div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <div className="listing-card-price">{formatPrice(listing.price_pence)}</div>
                    {listing.quantity > 1 && (
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                        × {listing.quantity} units
                      </span>
                    )}
                  </div>

                  <div className="listing-card-shipping">
                    {listing.shipping_mode === 'included'
                      ? `Shipping included — ${formatPrice(listing.shipping_cost_pence)}`
                      : 'Buyer arranges shipping'
                    }
                  </div>

                  <div className="listing-card-handle">
                    Listed by {listing.anonymous_handle || 'Anonymous seller'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
