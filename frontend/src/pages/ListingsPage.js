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
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')

  const approvedBrands = profile?.approvedBrands || []

  // Client-side search + sort on top of server-side brand/price filter
  const displayListings = listings
    .filter(l => {
      if (!search) return true
      const q = search.toLowerCase()
      return l.title?.toLowerCase().includes(q) || l.brands?.name?.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (sort === 'newest')    return new Date(b.created_at) - new Date(a.created_at)
      if (sort === 'oldest')    return new Date(a.created_at) - new Date(b.created_at)
      if (sort === 'price_asc') return a.price_pence - b.price_pence
      if (sort === 'price_desc')return b.price_pence - a.price_pence
      if (sort === 'az')        return (a.title || '').localeCompare(b.title || '')
      return 0
    })

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

        {/* Search & Filters */}
        <div className="card" style={{ marginBottom: 20, padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ flex: '1 1 180px', minWidth: 140 }}
              type="search"
              placeholder="Search listings…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {approvedBrands.length > 1 && (
              <select
                className="form-input"
                style={{ flex: '0 1 160px' }}
                value={filters.brand_id}
                onChange={e => setFilters(f => ({ ...f, brand_id: e.target.value }))}
              >
                <option value="">All my brands</option>
                {approvedBrands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <input
              className="form-input" type="number" min="0" step="1"
              style={{ flex: '0 1 110px', minWidth: 90 }}
              placeholder="Min £"
              value={filters.min_price}
              onChange={e => setFilters(f => ({ ...f, min_price: e.target.value }))}
            />
            <input
              className="form-input" type="number" min="0" step="1"
              style={{ flex: '0 1 110px', minWidth: 90 }}
              placeholder="Max £"
              value={filters.max_price}
              onChange={e => setFilters(f => ({ ...f, max_price: e.target.value }))}
            />
            <select
              className="form-input"
              style={{ flex: '0 1 150px' }}
              value={sort}
              onChange={e => setSort(e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="price_asc">Price: low → high</option>
              <option value="price_desc">Price: high → low</option>
              <option value="az">Title A → Z</option>
            </select>
            {(search || filters.brand_id || filters.min_price || filters.max_price) && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => { setSearch(''); setFilters({ brand_id: '', min_price: '', max_price: '' }) }}
              >
                Clear all
              </button>
            )}
          </div>
          {displayListings.length !== listings.length && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              Showing {displayListings.length} of {listings.length} listings
            </div>
          )}
        </div>

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
            {displayListings.map(listing => (
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
                      ? `Shipping available — ${formatPrice(listing.shipping_cost_pence)} (buyer can accept or arrange own)`
                      : 'Buyer arranges shipping'
                    }
                  </div>

                  {listing.status === 'sold' && (
                    <div style={{ marginTop: 8, padding: '4px 10px', background: 'var(--surface)', borderRadius: 100, fontSize: 11, color: 'var(--muted)', display: 'inline-block', border: '1px solid var(--border)' }}>
                      ✓ Sold
                    </div>
                  )}

                  <div className="listing-card-handle">
                    ✓ Verified seller
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
