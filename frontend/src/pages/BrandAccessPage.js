import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

export default function BrandAccessPage() {
  const { profile, loadProfile, user } = useAuth()
  const navigate = useNavigate()
  const [activeBrands, setActiveBrands] = useState([])
  const [myApplications, setMyApplications] = useState([])
  const [myPermissions, setMyPermissions] = useState([])
  const [retailers, setRetailers] = useState([])
  const [showRetailers, setShowRetailers] = useState(false)
  const [selectedBrands, setSelectedBrands] = useState([])
  const [otherBrand, setOtherBrand] = useState('')
  const [showOther, setShowOther] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [approvedSearch, setApprovedSearch] = useState('')

  useEffect(() => { loadAll() }, [profile?.id])

  // Refresh permissions on mount to pick up admin changes
  useEffect(() => { if (user?.id) loadProfile(user.id) }, [])

  async function loadAll() {
    if (!profile?.id) return
    setLoading(true)
    try {
      const promises = [
        supabase.from('brands').select('id, name').eq('status', 'active').order('name'),
        supabase.from('brand_applications').select('id, brand_id, brand_name_text, is_other, status, applied_at').eq('user_id', profile.id).order('applied_at', { ascending: false }),
        supabase.from('brand_permissions').select('brand_id').eq('user_id', profile.id).is('revoked_at', null)
      ]

      const [brandsResp, appsResp, permsResp] = await Promise.all(promises)
      setActiveBrands(brandsResp.data || [])
      setMyApplications(appsResp.data || [])
      setMyPermissions((permsResp.data || []).map(p => p.brand_id))

      // Load approved retailers for suppliers
      if (profile.role === 'supplier') {
        try {
          const retailersData = await api.getMyRetailers()
          setRetailers(retailersData.retailers || [])
        } catch { /* silent — may have no distributions yet */ }
      }
    } catch (err) {
      setError('Failed to load brand information')
    } finally {
      setLoading(false)
    }
  }

  function toggleBrand(brandId) {
    setSelectedBrands(prev =>
      prev.includes(brandId)
        ? prev.filter(id => id !== brandId)
        : [...prev, brandId]
    )
  }

  // Brands that already have active permission or a pending/reviewing application
  function getBrandStatus(brandId) {
    if (myPermissions.includes(brandId)) return 'approved'
    const app = myApplications.find(a => a.brand_id === brandId)
    if (app) return app.status
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (selectedBrands.length === 0 && !otherBrand.trim()) {
      return setError('Please select at least one brand to apply for')
    }
    setSubmitting(true)
    setError('')
    try {
      const applications = []

      for (const brandId of selectedBrands) {
        // Check not already applied
        const existing = myApplications.find(a => a.brand_id === brandId && ['pending', 'reviewing', 'approved'].includes(a.status))
        if (!existing && !myPermissions.includes(brandId)) {
          applications.push({
            user_id: profile.id,
            brand_id: brandId,
            is_other: false,
            status: 'pending'
          })
        }
      }

      if (otherBrand.trim()) {
        const otherBrands = otherBrand.split(',').map(b => b.trim()).filter(Boolean)
        for (const name of otherBrands) {
          // Check if it matches an existing brand
          const matched = activeBrands.find(b => b.name.toLowerCase() === name.toLowerCase())
          if (matched) {
            const existing = myApplications.find(a => a.brand_id === matched.id && ['pending', 'reviewing', 'approved'].includes(a.status))
            if (!existing && !myPermissions.includes(matched.id)) {
              applications.push({ user_id: profile.id, brand_id: matched.id, is_other: false, status: 'pending' })
            }
          } else {
            applications.push({
              user_id: profile.id,
              brand_id: null,
              brand_name_text: name.substring(0, 200),
              is_other: true,
              status: 'pending'
            })
          }
        }
      }

      if (applications.length === 0) {
        setError('All selected brands already have applications in progress or access already granted.')
        setSubmitting(false)
        return
      }

      const { error: insertError } = await supabase.from('brand_applications').insert(applications)
      if (insertError) throw insertError

      setSuccess(`Application submitted for ${applications.length} brand${applications.length !== 1 ? 's' : ''}. Our team will review your request.`)
      setSelectedBrands([])
      setOtherBrand('')
      setShowOther(false)
      await loadAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const STATUS_CONFIG = {
    approved:  { label: 'Access granted', class: 'badge-approved', icon: '✓' },
    pending:   { label: 'Pending review', class: 'badge-pending',  icon: '⏳' },
    reviewing: { label: 'Under review',   class: 'badge-pending',  icon: '👁' },
    declined:  { label: 'Declined',       class: 'badge-rejected', icon: '✗' },
  }

  const filteredBrands = activeBrands.filter(b =>
    !search || b.name.toLowerCase().includes(search.toLowerCase())
  )

  // Split brands into groups
  const brandGroups = {
    approved:  filteredBrands.filter(b => myPermissions.includes(b.id)),
    pending:   filteredBrands.filter(b => !myPermissions.includes(b.id) && myApplications.some(a => a.brand_id === b.id && ['pending','reviewing'].includes(a.status))),
    declined:  filteredBrands.filter(b => !myPermissions.includes(b.id) && myApplications.some(a => a.brand_id === b.id && a.status === 'declined')),
    available: filteredBrands.filter(b => {
      if (myPermissions.includes(b.id)) return false
      const app = myApplications.find(a => a.brand_id === b.id)
      return !app || app.status === 'declined'
    })
  }

  // When searching show ALL matching brands; when not searching show only available ones
  const gridBrands = search ? filteredBrands : brandGroups.available

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 780 }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 4 }}>
            {profile?.role === 'supplier' ? 'My brands' : 'Brand access'}
          </h1>
          <p style={{ color: 'var(--slate)', fontSize: 14 }}>
            {profile?.role === 'supplier'
              ? 'Manage your registered brands and dealership tiers.'
              : 'Apply for access to additional brands. Applications are reviewed by our team and verified with brand suppliers.'
            }
          </p>
        </div>

        {error   && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* Supplier pending notification */}
        {profile?.role === 'supplier' && brandGroups.pending.length > 0 && (
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>
            ⏳ You have <strong>{brandGroups.pending.length}</strong> brand submission{brandGroups.pending.length !== 1 ? 's' : ''} currently under review. We'll notify you once a decision has been made.
          </div>
        )}

        {/* Stat cards — role appropriate */}
        <div className="stat-cards" style={{ marginBottom: 24 }}>
          {(profile?.role === 'supplier' ? [
            { label: 'Approved retailers', value: retailers.length, highlight: true,
              onClick: () => setShowRetailers(v => !v), hint: 'Click to view' },
            { label: 'Pending review',    value: brandGroups.pending.length },
            { label: 'Declined',          value: brandGroups.declined.length },
          ] : [
            { label: 'Brands with access',   value: myPermissions.length, highlight: true },
            { label: 'Applications pending',  value: brandGroups.pending.length },
            { label: 'Available to apply',    value: brandGroups.available.length },
          ]).map((s, i) => (
            <div key={i}
              className={`stat-card ${s.highlight ? 'highlight' : ''}`}
              onClick={s.onClick}
              style={{ cursor: s.onClick ? 'pointer' : 'default' }}
            >
              <div className="stat-card-value">{s.value}</div>
              <div className="stat-card-label">{s.label}</div>
              {s.hint && <div style={{ fontSize: 11, color: 'var(--gold-light)', marginTop: 2 }}>{s.hint}</div>}
            </div>
          ))}
        </div>


        {/* Approved brands list — retailer only */}
        {profile?.role === 'retailer' && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>
                Your approved brands
              </h2>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/listings')}>
                Browse all →
              </button>
            </div>

            {myPermissions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>
                <p>No brands approved yet.</p>
                <p style={{ marginTop: 4 }}>Use the form below to apply for brand access.</p>
              </div>
            ) : (
              <>
                {myPermissions.length > 5 && (
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <input
                      className="form-input"
                      type="search"
                      placeholder="Filter your brands…"
                      value={approvedSearch}
                      onChange={e => setApprovedSearch(e.target.value)}
                    />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activeBrands
                    .filter(b => myPermissions.includes(b.id))
                    .filter(b => !approvedSearch || b.name.toLowerCase().includes(approvedSearch.toLowerCase()))
                    .map(brand => (
                      <div key={brand.id} className="brand-approved-row" style={{
                        padding: '10px 14px',
                        background: 'var(--green-bg)',
                        border: '1px solid var(--green)',
                        borderRadius: 'var(--radius)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: 'var(--green)', fontSize: 14 }}>✓</span>
                          <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--green)' }}>
                            {brand.name}
                          </span>
                        </div>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ borderColor: 'var(--green)', color: 'var(--green)', fontSize: 12, flexShrink: 0 }}
                          onClick={() => navigate('/listings', { state: { brand_id: brand.id, brand_name: brand.name } })}
                        >
                          Browse {brand.name} listings →
                        </button>
                      </div>
                    ))
                  }
                  {approvedSearch && activeBrands.filter(b => myPermissions.includes(b.id) && b.name.toLowerCase().includes(approvedSearch.toLowerCase())).length === 0 && (
                    <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>
                      No approved brands match "{approvedSearch}"
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Approved retailers panel — supplier only */}
        {profile?.role === 'supplier' && showRetailers && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>
                Approved retailers
              </h2>
              <button className="btn btn-outline btn-sm" onClick={() => setShowRetailers(false)}>
                Close ✕
              </button>
            </div>

            <div className="alert alert-info" style={{ marginBottom: 16, fontSize: 13 }}>
              This list is for account management purposes only. During trading, all parties remain anonymous.
            </div>

            {retailers.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                No retailers have been approved for your brands yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {retailers.map(retailer => (
                  <div key={retailer.id} style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'flex-start', padding: '12px 16px',
                      background: 'var(--surface)', flexWrap: 'wrap', gap: 10
                    }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>
                          {retailer.company_name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {retailer.contact_name && <span>👤 {retailer.contact_name}</span>}
                          {retailer.email && <span>📧 {retailer.email}</span>}
                          {retailer.phone && <span>📞 {retailer.phone}</span>}
                          {retailer.website && (
                            <a href={retailer.website} target="_blank" rel="noopener noreferrer"
                              style={{ color: 'var(--navy)' }}>
                              🌐 Website
                            </a>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--green)', background: 'var(--green-bg)', padding: '2px 8px', borderRadius: 100, border: '1px solid var(--green)' }}>
                          ✓ Approved {retailer.approved_at ? new Date(retailer.approved_at).toLocaleDateString('en-GB') : ''}
                        </span>
                      </div>
                    </div>
                    {/* Brands they're approved for */}
                    <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 4 }}>Brands:</span>
                      {retailer.brands.map(b => (
                        <span key={b.id} style={{
                          fontSize: 12, background: 'var(--surface)', color: 'var(--navy)',
                          padding: '2px 8px', borderRadius: 100, border: '1px solid var(--border)'
                        }}>
                          {b.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Apply for new brands */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 4 }}>
            {profile?.role === 'supplier' ? 'Add a brand or tier' : 'Apply for additional brands'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            {profile?.role === 'supplier'
              ? 'Register new brands or dealership tiers you distribute. Each tier should be added separately.'
              : 'Select brands you are authorised to sell. Brands with existing access or pending applications are shown but cannot be reselected.'
            }
          </p>

          {/* Supplier-only: dealership tier guidance */}
          {profile?.role === 'supplier' && (
            <div style={{
              padding: '12px 14px',
              background: 'var(--amber-bg)',
              border: '1px solid rgba(180,83,9,0.2)',
              borderRadius: 'var(--radius)',
              marginBottom: 16,
              fontSize: 13,
              color: 'var(--amber)',
              lineHeight: 1.7
            }}>
              <strong>Dealership tiers:</strong> If your brand has Gold, Platinum, Premier or other dealer levels, add each as a separate entry — e.g. "Brand Gold" and "Brand Platinum". This lets us match retailers to the correct access level.
            </div>
          )}

          <form onSubmit={handleSubmit}>

            {profile?.role === 'supplier' ? (
              /* ── SUPPLIER VIEW — no platform browse, just their brands + Other field ── */
              <>
                {/* Their current registered brands */}
                {brandGroups.approved.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <label className="form-label">Your registered brands</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                      {brandGroups.approved.map(brand => (
                        <div key={brand.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', background: 'var(--green-bg)',
                          border: '1px solid var(--green)', borderRadius: 'var(--radius)',
                          fontSize: 13
                        }}>
                          <span style={{ color: 'var(--green)' }}>✓</span>
                          <span style={{ fontWeight: 500, color: 'var(--green)' }}>{brand.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending submissions */}
                {brandGroups.pending.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <label className="form-label">Pending review</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                      {brandGroups.pending.map(brand => (
                        <div key={brand.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', background: 'var(--amber-bg)',
                          border: '1px solid var(--amber)', borderRadius: 'var(--radius)',
                          fontSize: 13
                        }}>
                          <span style={{ color: 'var(--amber)' }}>⏳</span>
                          <span style={{ fontWeight: 500, color: 'var(--amber)' }}>{brand.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other field — always visible for suppliers, no checkbox needed */}
                <div className="form-group">
                  <label className="form-label">Add a brand or tier</label>
                  <input
                    className="form-input"
                    type="text"
                    value={otherBrand}
                    onChange={e => setOtherBrand(e.target.value)}
                    placeholder="Enter brand name(s) — separate multiple with commas"
                    maxLength={500}
                  />
                  <span className="form-hint">
                    Include dealership tiers as separate entries (e.g. "Brand Gold, Brand Platinum"). These will be verified during review.
                  </span>
                </div>
              </>
            ) : (
              /* ── RETAILER VIEW — full search and grid ── */
              <>
                {/* Brand search */}
                <div className="form-group">
                  <input
                    className="form-input"
                    type="search"
                    placeholder={`Search all ${activeBrands.length} brands on the platform…`}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && filteredBrands.length > 0 && (
                    <span className="form-hint">
                      {filteredBrands.length} brand{filteredBrands.length !== 1 ? 's' : ''} found — tick to apply for ones you don't have yet
                    </span>
                  )}
                </div>

                {/* Brand grid */}
                {gridBrands.length === 0 && search ? (
                  <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                    No brands match "{search}" — use the "My brand isn't listed" field below.
                  </div>
                ) : gridBrands.length === 0 && !search ? (
                  <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                    You've applied for all brands currently on the platform. Use the field below if your brand isn't listed.
                  </p>
                ) : (
                  <div className="brand-access-grid" style={{ display: 'grid', gap: 8, marginBottom: 16, overflowY: 'auto', padding: '2px 0' }}>
                    {gridBrands.map(brand => {
                      const status = getBrandStatus(brand.id)
                      const isSelected = selectedBrands.includes(brand.id)
                      const isDisabled = status === 'approved' || status === 'pending' || status === 'reviewing'
                      const sc = status ? STATUS_CONFIG[status] : null
                      return (
                        <label key={brand.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '9px 12px', border: '1.5px solid',
                          borderColor: isSelected ? 'var(--navy)' : status === 'approved' ? 'var(--green)' : status === 'pending' || status === 'reviewing' ? 'var(--amber)' : 'var(--border)',
                          borderRadius: 'var(--radius)',
                          cursor: isDisabled ? 'default' : 'pointer',
                          background: isSelected ? 'var(--surface)' : status === 'approved' ? 'var(--green-bg)' : status === 'pending' || status === 'reviewing' ? 'var(--amber-bg)' : 'var(--white)',
                          transition: 'all 0.12s', fontSize: 13
                        }}>
                          {!isDisabled ? (
                            <input type="checkbox" checked={isSelected} onChange={() => toggleBrand(brand.id)} style={{ accentColor: 'var(--navy)', flexShrink: 0 }} />
                          ) : (
                            <span style={{ fontSize: 11, flexShrink: 0 }}>{sc?.icon}</span>
                          )}
                          <span style={{
                            fontWeight: 500,
                            color: status === 'approved' ? 'var(--green)' : status === 'pending' || status === 'reviewing' ? 'var(--amber)' : 'var(--navy)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}>
                            {brand.name}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}

                {/* Other brand */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: showOther ? 10 : 0 }}>
                    <input
                      type="checkbox"
                      checked={showOther}
                      onChange={e => { setShowOther(e.target.checked); if (!e.target.checked) setOtherBrand('') }}
                      style={{ accentColor: 'var(--navy)' }}
                    />
                    <span style={{ fontWeight: 500 }}>My brand isn't listed above</span>
                  </label>
                  {showOther && (
                    <div>
                      <input
                        className="form-input"
                        type="text"
                        value={otherBrand}
                        onChange={e => setOtherBrand(e.target.value)}
                        placeholder="Enter brand name(s) — separate multiple with commas"
                        maxLength={500}
                      />
                      <span className="form-hint">
                        Unlisted brands will be reviewed by our team and may require additional verification.
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            {selectedBrands.length > 0 && (
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                You're applying for {selectedBrands.length} brand{selectedBrands.length !== 1 ? 's' : ''}.
                Your eligibility will be verified with brand suppliers during review.
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={submitting || (selectedBrands.length === 0 && !otherBrand.trim())}
            >
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>
          </form>
        </div>

        {/* Application history */}
        {myApplications.length > 0 && (
          <div className="card">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16 }}>
              Application history
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myApplications.map(app => {
                const sc = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending
                return (
                  <div key={app.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px',
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    gap: 12, flexWrap: 'wrap'
                  }}>
                    <div>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>
                        {app.is_other ? app.brand_name_text : activeBrands.find(b => b.id === app.brand_id)?.name || 'Unknown brand'}
                      </span>
                      {app.is_other && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '1px 6px', borderRadius: 100 }}>
                          Unregistered
                        </span>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        Applied {new Date(app.applied_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <span className={`badge ${sc.class}`}>{sc.icon} {sc.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
