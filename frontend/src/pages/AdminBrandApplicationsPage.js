import { useState, useEffect } from 'react'
import { api } from '../lib/api'

export default function AdminBrandApplicationsPage() {
  const [applications, setApplications] = useState([])
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [expandedApp, setExpandedApp] = useState(null)
  const [suppliersForBrand, setSuppliersForBrand] = useState({})
  const [sendingReview, setSendingReview] = useState(null)
  const [deciding, setDeciding] = useState(null)
  const [decisionNotes, setDecisionNotes] = useState('')
  const [filterStatus, setFilterStatus] = useState('pending')
  const [linkingBrand, setLinkingBrand] = useState(null) // appId being linked
  const [linkBrandId, setLinkBrandId] = useState('')     // selected brand UUID

  useEffect(() => { loadApplications() }, [filterStatus])
  useEffect(() => { loadBrands() }, [])

  async function loadBrands() {
    try {
      const data = await api.admin.getBrands()
      setBrands(data.brands || [])
    } catch { /* silent */ }
  }

  async function loadApplications() {
    setLoading(true)
    try {
      const data = await api.admin.getBrandApplications({ status: filterStatus })
      setApplications(data.applications || [])
    } catch (err) {
      setError('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  async function loadSuppliersForBrand(brandId) {
    if (!brandId || suppliersForBrand[brandId]) return
    try {
      const data = await api.admin.getSuppliersForBrand(brandId)
      setSuppliersForBrand(prev => ({ ...prev, [brandId]: data.suppliers || [] }))
    } catch { /* silent */ }
  }

  async function linkBrand(applicationId, useFamily = false) {
    if (!linkBrandId) return setError('Please select a brand to link')
    setError('')
    try {
      const result = await api.admin.linkBrandApplication(applicationId, linkBrandId, useFamily)
      setSuccess(result.message || 'Application linked — approve button is now enabled')
      setLinkingBrand(null)
      setLinkBrandId('')
      await loadApplications()
    } catch (err) {
      setError(err.message)
    }
  }

  async function sendReview(applicationId, supplierId) {
    setSendingReview(`${applicationId}-${supplierId}`)
    setError('')
    try {
      await api.admin.requestBrandReview(applicationId, supplierId)
      setSuccess('Review request sent to supplier')
      await loadApplications()
    } catch (err) {
      setError(err.message)
    } finally {
      setSendingReview(null)
    }
  }

  async function decide(applicationId, decision) {
    setDeciding(`${applicationId}-${decision}`)
    setError('')
    try {
      await api.admin.decideBrandApplication(applicationId, decision, decisionNotes)
      setSuccess(`Application ${decision}`)
      setDecisionNotes('')
      setExpandedApp(null)
      await loadApplications()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeciding(null)
    }
  }

  const STATUS_COLOURS = {
    pending:   { bg: 'var(--amber-bg)',  color: 'var(--amber)',  label: 'Pending review' },
    reviewing: { bg: '#EBF4FF',          color: '#1D4ED8',       label: 'With supplier' },
    approved:  { bg: 'var(--green-bg)',  color: 'var(--green)',  label: 'Approved' },
    declined:  { bg: 'var(--red-bg)',    color: 'var(--red)',    label: 'Declined' },
  }

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="container">

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 4 }}>
            Brand applications
          </h1>
          <p style={{ color: 'var(--slate)', fontSize: 14 }}>
            Review brand access requests from new and existing members
          </p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {['pending', 'reviewing', 'approved', 'declined'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                padding: '6px 16px', borderRadius: 100, fontSize: 13,
                border: '1.5px solid', cursor: 'pointer', transition: 'all 0.15s',
                fontWeight: filterStatus === s ? 500 : 400,
                background: filterStatus === s ? 'var(--navy)' : 'var(--white)',
                color: filterStatus === s ? '#fff' : 'var(--slate)',
                borderColor: filterStatus === s ? 'var(--navy)' : 'var(--border)'
              }}
            >
              {STATUS_COLOURS[s]?.label || s}
            </button>
          ))}
        </div>

        {applications.length === 0 ? (
          <div className="empty-state">
            <h3>No {filterStatus} applications</h3>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {applications.map(app => {
              const sc = STATUS_COLOURS[app.status] || STATUS_COLOURS.pending
              const isExpanded = expandedApp === app.id
              const supplierReviews = app.eligibility_reviews || []
              const pendingReviews = supplierReviews.filter(r => r.status === 'pending')
              const respondedReviews = supplierReviews.filter(r => r.status !== 'pending')

              return (
                <div key={app.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>

                  {/* Header row */}
                  <div
                    style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, padding: '14px 20px', cursor: 'pointer', alignItems: 'center' }}
                    onClick={() => {
                      setExpandedApp(isExpanded ? null : app.id)
                      if (!isExpanded && app.brand?.id) loadSuppliersForBrand(app.brand.id)
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 500, fontSize: 14 }}>
                          {app.user?.company_name}
                        </span>
                        <span style={{ fontSize: 11, background: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: 100, fontWeight: 500 }}>
                          {sc.label}
                        </span>
                        <span style={{ fontSize: 11, background: 'var(--surface)', color: 'var(--muted)', padding: '2px 8px', borderRadius: 100, textTransform: 'capitalize' }}>
                          {app.user?.role}
                        </span>
                        {app.is_other && (
                          <span style={{ fontSize: 11, background: 'var(--amber-bg)', color: 'var(--amber)', padding: '2px 8px', borderRadius: 100, fontWeight: 500 }}>
                            Unregistered brand
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--slate)' }}>
                        Brand: <strong>{app.is_other ? app.brand_name_text : app.brand?.name}</strong>
                        {' · '}{app.user?.email}
                        {' · '}Applied {new Date(app.applied_at).toLocaleDateString('en-GB')}
                      </div>
                      {supplierReviews.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                          {pendingReviews.length > 0 && `${pendingReviews.length} supplier review pending · `}
                          {respondedReviews.length > 0 && `${respondedReviews.length} supplier response received`}
                        </div>
                      )}
                    </div>
                    <span style={{ color: 'var(--muted)', fontSize: 18 }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px' }}>

                      {/* Supplier reviews already sent */}
                      {supplierReviews.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <h4 style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Supplier reviews</h4>
                          {supplierReviews.map(review => (
                            <div key={review.id} style={{
                              padding: '10px 14px', borderRadius: 'var(--radius)',
                              background: review.status === 'pending' ? 'var(--surface)' : review.status === 'approved' ? 'var(--green-bg)' : 'var(--red-bg)',
                              marginBottom: 8, fontSize: 13
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: review.supplier_notes ? 4 : 0 }}>
                                <span style={{ fontWeight: 500 }}>{review.supplier?.company_name}</span>
                                <span style={{
                                  fontSize: 12, fontWeight: 500,
                                  color: review.status === 'pending' ? 'var(--amber)' : review.status === 'approved' ? 'var(--green)' : 'var(--red)',
                                  textTransform: 'capitalize'
                                }}>
                                  {review.status === 'pending' ? '⏳ Awaiting response' : review.status === 'approved' ? '✓ Recommends approval' : '✗ Recommends decline'}
                                </span>
                              </div>
                              {review.supplier_notes && (
                                <div style={{ fontSize: 12, color: 'var(--slate)', fontStyle: 'italic', marginTop: 4 }}>
                                  "{review.supplier_notes}"
                                </div>
                              )}
                              {review.responded_at && (
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                                  Responded {new Date(review.responded_at).toLocaleDateString('en-GB')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Send to supplier for review */}
                      {!app.is_other && app.brand?.id && app.status !== 'approved' && app.status !== 'declined' && (
                        <div style={{ marginBottom: 20 }}>
                          <h4 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                            Request supplier input
                          </h4>
                          {(suppliersForBrand[app.brand.id] || []).length === 0 ? (
                            <div>
                              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
                                No suppliers are registered as distributors for this brand yet.
                                You can still send a review request to any approved supplier account.
                              </p>
                              <AllSupplierSelector
                                applicationId={app.id}
                                existingReviews={supplierReviews}
                                sendingReview={sendingReview}
                                onSend={sendReview}
                              />
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {(suppliersForBrand[app.brand.id] || []).map(dist => {
                                const alreadySent = supplierReviews.some(r => r.supplier?.id === dist.supplier?.id)
                                return (
                                  <div key={dist.id} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '10px 14px', background: 'var(--surface)',
                                    borderRadius: 'var(--radius)', fontSize: 13
                                  }}>
                                    <div>
                                      <span style={{ fontWeight: 500 }}>{dist.supplier?.company_name}</span>
                                      <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>
                                        {dist.supplier?.email}
                                      </span>
                                    </div>
                                    <button
                                      className="btn btn-outline btn-sm"
                                      disabled={alreadySent || sendingReview === `${app.id}-${dist.supplier?.id}`}
                                      onClick={() => sendReview(app.id, dist.supplier?.id)}
                                    >
                                      {alreadySent ? '✓ Sent' : sendingReview === `${app.id}-${dist.supplier?.id}` ? 'Sending…' : 'Send review request'}
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Unregistered brand — offer to link or register */}
                      {app.is_other && (
                        <div style={{ marginBottom: 20 }}>
                          <div className="alert alert-warning" style={{ marginBottom: 12 }}>
                            This application is for an unregistered brand: <strong>{app.brand_name_text}</strong>.
                            If this brand exists on the platform, link it below. Otherwise add the brand first in the Users &amp; listings panel.
                          </div>

                          {linkingBrand === app.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <select
                                  className="form-input"
                                  style={{ flex: 1, minWidth: 180 }}
                                  value={linkBrandId}
                                  onChange={e => setLinkBrandId(e.target.value)}
                                >
                                  <option value="">Select a brand…</option>
                                  {brands.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                  ))}
                                </select>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => linkBrand(app.id, false)}
                                  disabled={!linkBrandId}
                                >
                                  Link this brand
                                </button>
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => linkBrand(app.id, true)}
                                  disabled={!linkBrandId}
                                >
                                  Link all family brands
                                </button>
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => { setLinkingBrand(null); setLinkBrandId('') }}
                                >
                                  Cancel
                                </button>
                              </div>
                              {linkBrandId && (
                                <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                                  <strong>Link all family brands</strong> will also create applications for all brands starting with the same name — e.g. selecting "Roland" will also apply for "Roland — Keys", "Roland Gold" etc. Useful when an applicant typed the parent brand name.
                                </p>
                              )}
                            </div>
                          ) : (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => setLinkingBrand(app.id)}
                            >
                              🔗 Link to existing brand
                            </button>
                          )}
                        </div>
                      )}

                      {/* Admin decision */}
                      {app.status !== 'approved' && app.status !== 'declined' && (
                        <div>
                          <h4 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Your decision</h4>
                          <div className="form-group" style={{ marginBottom: 12 }}>
                            <label className="form-label">Notes (optional)</label>
                            <textarea
                              className="form-input" rows={2}
                              value={decisionNotes}
                              onChange={e => setDecisionNotes(e.target.value)}
                              maxLength={500}
                              placeholder="Internal notes about this decision…"
                              style={{ resize: 'none' }}
                            />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <button
                              className="btn btn-outline"
                              style={{ justifyContent: 'center', borderColor: 'var(--green)', color: 'var(--green)' }}
                              onClick={() => decide(app.id, 'approved')}
                              disabled={!!deciding || app.is_other}
                            >
                              {deciding === `${app.id}-approved` ? 'Approving…' : '✓ Approve access'}
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{ justifyContent: 'center' }}
                              onClick={() => decide(app.id, 'declined')}
                              disabled={!!deciding}
                            >
                              {deciding === `${app.id}-declined` ? 'Declining…' : '✗ Decline'}
                            </button>
                          </div>
                          {app.is_other && (
                            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                              Register the brand first before approving access.
                            </p>
                          )}
                        </div>
                      )}

                      {app.status === 'approved' && (
                        <div className="alert alert-success">✓ Access granted — brand permission has been assigned to this user.</div>
                      )}
                      {app.status === 'declined' && (
                        <div className="alert alert-error">✗ Application declined{app.review_notes ? `: ${app.review_notes}` : '.'}</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Fallback supplier selector when no distributions exist ────
function AllSupplierSelector({ applicationId, existingReviews, sendingReview, onSend }) {
  const [allSuppliers, setAllSuppliers] = useState([])
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Use admin API which uses supabaseAdmin client — bypasses RLS
    api.admin.getUsers({ role: 'supplier', status: 'approved' })
      .then(data => {
        setAllSuppliers(data.users || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading suppliers…</div>
  if (allSuppliers.length === 0) return <p style={{ fontSize: 13, color: 'var(--muted)' }}>No approved supplier accounts yet.</p>

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <select
        className="form-input"
        style={{ flex: '1 1 200px' }}
        value={selectedSupplier}
        onChange={e => setSelectedSupplier(e.target.value)}
      >
        <option value="">Select a supplier…</option>
        {allSuppliers.map(s => {
          const alreadySent = existingReviews.some(r => r.supplier?.id === s.id)
          return (
            <option key={s.id} value={s.id} disabled={alreadySent}>
              {s.company_name}{alreadySent ? ' (already sent)' : ''}
            </option>
          )
        })}
      </select>
      <button
        className="btn btn-outline btn-sm"
        disabled={!selectedSupplier || sendingReview === `${applicationId}-${selectedSupplier}`}
        onClick={() => { onSend(applicationId, selectedSupplier); setSelectedSupplier('') }}
      >
        {sendingReview === `${applicationId}-${selectedSupplier}` ? 'Sending…' : 'Send review request'}
      </button>
    </div>
  )
}
