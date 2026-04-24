import { useState, useEffect, useCallback } from 'react'
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
  const [showAllState, setShowAllState] = useState(false)
  const showAll = canShowAll && showAllState
  const [filters, setFilters] = useState({ brand_id: '', min_price: '', max_price: '' })
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')
  const [applying, setApplying] = useState({}) // { [brandId]: 'loading' | 'applied' }

  const approvedBrands = profile?.approvedBrands || []
  const isSupplier = profile?.role === 'supplier'

  // Suppliers never see show-all — they only see their registered brands
  const canShowAll = !isSupplier

  // When showAll toggles, reload with appropriate endpoint
  useEffect(() => { loadListings() }, [filters, showAll])

  async function loadListings() {
    setLoading(true)
    try {
      const params = {}
      if (filters.min_price) params.min_price = filters.min_price
      if (filters.max_price) params.max_price = filters.max_price

      const data = showAll
        ? await api.getAllListings(params)
        : await api.getListings({ ...params, ...(filters.brand_id ? { brand_id: filters.brand_id } : {}) })

      setListings(data.listings || [])
    } catch (err) {
      setError('Failed to load listings')
    } finally {
      setLoading(false)
    }
  }

  async function handleApplyForBrand(e, brandId, brandName) {
    e.stopPropagation() // Prevent navigating to listing
    setApplying(prev => ({ ...prev, [brandId]: 'loading' }))
    try {
      await api.applyForBrand(brandId)
      setApplying(prev => ({ ...prev, [brandId]: 'applied' }))
      // Update listings to reflect pending state
      setListings(prev => prev.map(l =>
        l.brand_id === brandId ? { ...l, applied: true } : l
      ))
    } catch (err) {
      // Show error inline on the card
      setApplying(prev => ({ ...prev, [brandId]: 'error' }))
      setTimeout(() => setApplying(prev => ({ ...prev, [brandId]: null })), 3000)
    }
  }

  // Client-side search + sort
  const displayListings = listings
    .filter(l => {
      if (!search) return true
      const q = search.toLowerCase()
      return l.title?.toLowerCase().includes(q) || l.brands?.name?.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      // Always show authorised listings first when in showAll mode
      if (showAll && a.authorised !== b.authorised) return a.authorised ? -1 : 1
      if (sort === 'newest')     return new Date(b.created_at) - new Date(a.created_at)
      if (sort === 'oldest')     return new Date(a.created_at) - new Date(b.created_at)
      if (sort === 'price_asc')  return a.price_pence - b.price_pence
      if (sort === 'price_desc') return b.price_pence - a.price_pence
      if (sort === 'az')         return (a.title || '').localeCompare(b.title || '')
      return 0
    })

  const authorisedCount = displayListings.filter(l => l.authorised !== false).length
  const unauthorisedCount = displayListings.filter(l => l.authorised === false).length

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 4 }}>
              Available stock
            </h1>
            <p style={{ color: 'var(--slate)', fontSize: 14 }}>
              {showAll
                ? `Showing all listings — ${authorisedCount} available to you`
                : `Showing listings for your ${approvedBrands.length} approved brand${approvedBrands.length !== 1 ? 's' : ''}`
              }
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Show all toggle — retailers only, not suppliers */}
            {canShowAll && (
              <button
                className={`btn btn-sm ${showAll ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => { setShowAllState(v => !v); setFilters({ brand_id: '', min_price: '', max_price: '' }) }}
              >
                {showAll ? '👁 Showing all brands' : '👁 Show all brands'}
              </button>
            )}
            {isSupplier && (
              <button className="btn btn-primary" onClick={() => navigate('/listings/new')}>
                + New listing
              </button>
            )}
          </div>
        </div>

        {/* Show-all info banner */}
        {showAll && (
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            Listings you're not yet authorised for are shown greyed out. Click <strong>Apply for access</strong> on any listing to submit a brand application — our team will verify your eligibility.
          </div>
        )}

        {/* Search & Filters */}
        <div className="card" style={{ marginBottom: 16, padding: '12px 14px' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ flex: '1 1 180px', minWidth: 140 }}
              type="search"
              placeholder="Search listings…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {!showAll && approvedBrands.length > 1 && (
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
              style={{ flex: '0 1 100px', minWidth: 80 }}
              placeholder="Min £"
              value={filters.min_price}
              onChange={e => setFilters(f => ({ ...f, min_price: e.target.value }))}
            />
            <input
              className="form-input" type="number" min="0" step="1"
              style={{ flex: '0 1 100px', minWidth: 80 }}
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
                Clear
              </button>
            )}
          </div>
          {displayListings.length !== listings.length && search && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              Showing {displayListings.length} of {listings.length} listings
            </div>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {loading && <div className="loading-page"><div className="spinner" /></div>}

        {/* Empty states */}
        {!loading && approvedBrands.length === 0 && !showAll && (
          <div className="empty-state">
            <h3>No brands assigned yet</h3>
            <p>Your account is approved but you haven't been assigned any brands yet.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/settings/brands')}>
              Apply for brand access
            </button>
          </div>
        )}

        {!loading && listings.length === 0 && (approvedBrands.length > 0 || showAll) && (
          <div className="empty-state">
            <h3>No listings found</h3>
            <p>There are no active listings matching your filters right now.</p>
          </div>
        )}

        {/* Listings grid */}
        {!loading && displayListings.length > 0 && (
          <>
            {/* Section header when showing all */}
            {showAll && authorisedCount > 0 && (
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Your brands ({authorisedCount})
              </div>
            )}

            <div className="listings-grid">
              {displayListings.map(listing => {
                const isAuthorised = !showAll || listing.authorised !== false
                const isApplied = listing.applied || applying[listing.brand_id] === 'applied'
                const isApplying = applying[listing.brand_id] === 'loading'
                const applyError = applying[listing.brand_id] === 'error'

                // Section divider between authorised and unauthorised
                const idx = displayListings.indexOf(listing)
                const prevAuthorised = idx > 0 ? displayListings[idx - 1].authorised !== false : true
                const showDivider = showAll && !isAuthorised && prevAuthorised && idx > 0

                return (
                  <div key={listing.id}>
                    {showDivider && (
                      <div style={{
                        gridColumn: '1 / -1',
                        marginBottom: 10,
                        marginTop: 8,
                        fontSize: 13, fontWeight: 500,
                        color: 'var(--muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        paddingTop: 12,
                        borderTop: '1px solid var(--border)'
                      }}>
                        Other brands — apply for access ({unauthorisedCount})
                      </div>
                    )}

                    <div
                      className="listing-card"
                      onClick={() => isAuthorised && navigate(`/listings/${listing.id}`)}
                      style={{
                        opacity: isAuthorised ? 1 : 0.65,
                        cursor: isAuthorised ? 'pointer' : 'default',
                        position: 'relative'
                      }}
                    >
                      {/* Not authorised overlay badge */}
                      {!isAuthorised && (
                        <div style={{
                          position: 'absolute', top: 8, right: 8,
                          background: 'var(--navy)', color: 'var(--white)',
                          fontSize: 10, fontWeight: 500,
                          padding: '3px 8px', borderRadius: 100,
                          zIndex: 2, letterSpacing: '0.04em'
                        }}>
                          🔒 Not authorised
                        </div>
                      )}

                      {listing.image_urls?.length > 0 ? (
                        <img src={listing.image_urls[0]} alt={listing.title} className="listing-card-image"
                          style={{ filter: isAuthorised ? 'none' : 'grayscale(40%)' }}
                        />
                      ) : (
                        <div className="listing-card-image" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
                          No image
                        </div>
                      )}

                      <div className="listing-card-body">
                        <div className="listing-card-brand">{listing.brands?.name}</div>
                        <div className="listing-card-title">{listing.title}</div>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <div className="listing-card-price">{formatPrice(listing.price_pence)}</div>
                          {listing.quantity > 1 && (
                            <span style={{ fontSize: 13, color: 'var(--muted)' }}>× {listing.quantity} units</span>
                          )}
                        </div>

                        <div className="listing-card-shipping">
                          {listing.shipping_mode === 'included'
                            ? `Shipping available — ${formatPrice(listing.shipping_cost_pence)}`
                            : 'Buyer arranges shipping'
                          }
                        </div>

                        {listing.status === 'sold' && (
                          <div style={{ marginTop: 8, padding: '4px 10px', background: 'var(--surface)', borderRadius: 100, fontSize: 11, color: 'var(--muted)', display: 'inline-block', border: '1px solid var(--border)' }}>
                            ✓ Sold
                          </div>
                        )}

                        {/* Authorised → verified seller tag */}
                        {isAuthorised && (
                          <div className="listing-card-handle">✓ Verified seller</div>
                        )}

                        {/* Not authorised → apply button */}
                        {!isAuthorised && listing.status !== 'sold' && (
                          <div style={{ marginTop: 10 }}>
                            {isApplied ? (
                              <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>
                                ✓ Application submitted
                              </div>
                            ) : applyError ? (
                              <div style={{ fontSize: 12, color: 'var(--red)' }}>
                                Already applied or access exists
                              </div>
                            ) : (
                              <button
                                className="btn btn-outline btn-sm"
                                style={{ width: '100%', justifyContent: 'center', fontSize: 12, borderColor: 'var(--gold)', color: 'var(--gold)' }}
                                onClick={e => handleApplyForBrand(e, listing.brand_id, listing.brands?.name)}
                                disabled={isApplying}
                              >
                                {isApplying ? 'Applying…' : '+ Apply for access'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
