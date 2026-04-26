import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

function formatPrice(pence) {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STATUS_CONFIG = {
  active:         { label: 'Live',           class: 'badge-approved' },
  pending_review: { label: 'Pending review', class: 'badge-pending' },
  draft:          { label: 'Paused',         class: 'badge-draft' },
  sold:           { label: 'Sold',           class: 'badge-approved' },
  removed:        { label: 'Removed',        class: 'badge-rejected' },
}

export default function SupplierListingsPage() {
  const navigate = useNavigate()
  const [listings, setListings] = useState([])
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [toggling, setToggling] = useState(null) // listing id being toggled

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [brandFilter, setBrandFilter] = useState('')
  const [openToAllOnly, setOpenToAllOnly] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const data = await api.getMyBrandListings()
      setListings(data.listings || [])
      setBrands(data.brands || [])
    } catch (err) {
      setError('Failed to load brand listings')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleOpen(listingId, currentValue) {
    setToggling(listingId)
    setError('')
    try {
      const result = await api.toggleListingOpenToAll(listingId)
      setListings(prev => prev.map(l =>
        l.id === listingId ? { ...l, open_to_all: result.open_to_all } : l
      ))
      setSuccess(result.message)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setToggling(null)
    }
  }

  // Filtered listings
  const filtered = listings.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !search || l.title?.toLowerCase().includes(q) || l.brand?.name?.toLowerCase().includes(q)
    const matchStatus = !statusFilter || l.status === statusFilter
    const matchBrand  = !brandFilter  || l.brand?.id === brandFilter
    const matchOpen   = !openToAllOnly || l.open_to_all
    return matchSearch && matchStatus && matchBrand && matchOpen
  })

  const openToAllCount = listings.filter(l => l.open_to_all && l.status === 'active').length
  const activeCount = listings.filter(l => l.status === 'active').length

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 4 }}>
            Brand listings
          </h1>
          <p style={{ color: 'var(--slate)', fontSize: 14 }}>
            All listings across your brands — manage open to all status for any listing
          </p>
        </div>

        {error   && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

        {/* Stat cards */}
        <div className="stat-cards" style={{ marginBottom: 24 }}>
          {[
            { label: 'Active brand listings', value: activeCount },
            { label: 'Open to all',           value: openToAllCount, highlight: openToAllCount > 0 },
            { label: 'Total brands',          value: brands.length },
          ].map((card, i) => (
            <div key={i} className={`stat-card ${card.highlight ? 'highlight' : ''}`}>
              <div className="stat-card-value">{card.value}</div>
              <div className="stat-card-label">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Info box */}
        <div style={{ padding: '12px 16px', background: 'var(--amber-bg)', border: '1px solid rgba(180,83,9,0.2)', borderRadius: 'var(--radius)', marginBottom: 20, fontSize: 13, color: 'var(--amber)', lineHeight: 1.6 }}>
          <strong>⭐ Open to all</strong> — toggle this on any active listing to make it visible to all verified retailers on the platform, not just those authorised for your brand. Use for clearance or discontinued lines. You can toggle it off at any time.
        </div>

        {/* Search & filter bar */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <input
            className="form-input"
            style={{ flex: '1 1 180px', minWidth: 140 }}
            type="search"
            placeholder="Search by title or brand…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="form-input"
            style={{ flex: '0 1 150px' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          {brands.length > 1 && (
            <select
              className="form-input"
              style={{ flex: '0 1 160px' }}
              value={brandFilter}
              onChange={e => setBrandFilter(e.target.value)}
            >
              <option value="">All brands</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <button
            className={`btn btn-sm ${openToAllOnly ? 'btn-gold' : 'btn-outline'}`}
            onClick={() => setOpenToAllOnly(v => !v)}
            style={{ whiteSpace: 'nowrap' }}
          >
            ⭐ Open to all only
          </button>
          {(search || brandFilter || openToAllOnly || statusFilter !== 'active') && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => { setSearch(''); setBrandFilter(''); setOpenToAllOnly(false); setStatusFilter('active') }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Listings */}
        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>{listings.length === 0 ? 'No listings yet' : 'No listings match your filters'}</h3>
            <p>{listings.length === 0 ? 'Listings for your brands will appear here once approved.' : 'Try adjusting your search or filters.'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(listing => {
              const sc = STATUS_CONFIG[listing.status] || STATUS_CONFIG.draft
              const isToggling = toggling === listing.id

              return (
                <div key={listing.id} className="card" style={{
                  padding: 0, overflow: 'hidden',
                  borderLeft: listing.open_to_all ? '3px solid var(--amber)' : undefined
                }}>
                  <div className="listing-card-row">

                    {/* Thumbnail */}
                    <div
                      className="thumb"
                      style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: listing.status === 'active' ? 'pointer' : 'default' }}
                      onClick={() => listing.status === 'active' && navigate(`/listings/${listing.id}`)}
                    >
                      {listing.image_urls?.length > 0 ? (
                        <img src={listing.image_urls[0]} alt="" style={{ width: '100%', height: 64, objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--muted)', padding: 4, textAlign: 'center' }}>No img</span>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 500, fontSize: 14 }}>{listing.title}</span>
                        <span className={`badge ${sc.class}`} style={{ fontSize: 11 }}>{sc.label}</span>
                        {listing.open_to_all && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '2px 7px', borderRadius: 100, border: '1px solid rgba(180,83,9,0.2)' }}>
                            OPEN TO ALL
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span>{listing.brand?.name}</span>
                        <span>{formatPrice(listing.price_pence)}/unit</span>
                        <span>{listing.quantity} unit{listing.quantity !== 1 ? 's' : ''}</span>
                        <span className="hide-mobile">{new Date(listing.created_at).toLocaleDateString('en-GB')}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="listing-card-actions-col">
                      {/* View listing */}
                      {listing.status === 'active' && (
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ justifyContent: 'center', fontSize: 12 }}
                          onClick={() => navigate(`/listings/${listing.id}`)}
                        >
                          View →
                        </button>
                      )}

                      {/* Open to all toggle — only on active listings */}
                      {listing.status === 'active' && (
                        <button
                          className="btn btn-sm"
                          style={{
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 500,
                            background: listing.open_to_all ? 'var(--amber-bg)' : 'var(--surface)',
                            border: `1.5px solid ${listing.open_to_all ? 'var(--amber)' : 'var(--border)'}`,
                            color: listing.open_to_all ? 'var(--amber)' : 'var(--slate)',
                            opacity: isToggling ? 0.6 : 1
                          }}
                          onClick={() => handleToggleOpen(listing.id, listing.open_to_all)}
                          disabled={isToggling}
                          title={listing.open_to_all ? 'Click to restrict to authorised dealers only' : 'Click to open to all verified retailers'}
                        >
                          {isToggling ? '…' : listing.open_to_all ? '⭐ Open to all' : '☆ Open to all'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>
          Showing {filtered.length} of {listings.length} listing{listings.length !== 1 ? 's' : ''}
        </div>

      </div>
    </div>
  )
}
