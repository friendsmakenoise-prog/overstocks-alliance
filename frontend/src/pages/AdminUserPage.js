import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'

export default function AdminUserPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [brands, setBrands] = useState([])
  const [permissions, setPermissions] = useState([])
  const [brandApplications, setBrandApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmAction, setConfirmAction] = useState(null)

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    setLoading(true)
    try {
      const [userResp, brandsResp, permsResp] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', id).single(),
        api.admin.getBrands(),
        api.admin.getUserPermissions(id)
      ])

      setUser(userResp.data)
      setBrands(brandsResp.brands || [])
      setPermissions(permsResp.permissions || [])

      // Load brand applications for this user
      const { data: apps } = await supabase
        .from('brand_applications')
        .select('*, brand:brand_id(id, name)')
        .eq('user_id', id)
        .order('applied_at', { ascending: false })
      setBrandApplications(apps || [])

    } catch (err) {
      setError('Failed to load user')
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(action) {
    setError('')
    setSuccess('')
    try {
      switch (action) {
        case 'approve':
          await api.admin.approveUser(id)
          setSuccess('User approved — they can now log in')
          break
        case 'suspend':
          await api.admin.suspendUser(id)
          setSuccess('User suspended')
          break
        case 'reject':
          await api.admin.rejectUser(id, 'Account cancelled by admin')
          setSuccess('User account cancelled')
          break
        case 'reinstate':
          await supabase.from('user_profiles').update({ status: 'approved' }).eq('id', id)
          setSuccess('User reinstated')
          break
      }
      setConfirmAction(null)
      await loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function grantBrand(brandId) {
    try {
      await api.admin.grantPermission(id, brandId)
      setSuccess('Brand access granted')
      await loadAll()
    } catch (err) { setError(err.message) }
  }

  async function revokeBrand(brandId) {
    try {
      await api.admin.revokePermission(id, brandId)
      setSuccess('Brand access revoked')
      await loadAll()
    } catch (err) { setError(err.message) }
  }

  if (loading) return <div className="loading-page"><div className="spinner" /></div>
  if (!user) return (
    <div className="page"><div className="container">
      <div className="empty-state"><h3>User not found</h3></div>
    </div></div>
  )

  const activePerms = permissions.filter(p => !p.revoked_at)

  const STATUS_CONFIG = {
    pending:   { label: 'Pending approval', class: 'badge-pending', actions: ['approve', 'reject'] },
    approved:  { label: 'Active',           class: 'badge-approved', actions: ['suspend', 'reject'] },
    suspended: { label: 'Suspended',        class: 'badge-suspended', actions: ['reinstate', 'reject'] },
    rejected:  { label: 'Cancelled',        class: 'badge-rejected', actions: ['reinstate'] },
  }

  const statusCfg = STATUS_CONFIG[user.status] || STATUS_CONFIG.pending

  const ACTION_CONFIG = {
    approve:   { label: 'Approve account',   class: 'btn-outline', confirm: false, style: { borderColor: 'var(--green)', color: 'var(--green)' } },
    suspend:   { label: 'Suspend account',   class: 'btn-danger',  confirm: true,  confirmMsg: 'This will immediately block this user from logging in.' },
    reject:    { label: 'Cancel account',    class: 'btn-danger',  confirm: true,  confirmMsg: 'This will permanently cancel this account. The user will no longer be able to access the platform.' },
    reinstate: { label: 'Reinstate account', class: 'btn-outline', confirm: true,  confirmMsg: 'This will restore this user\'s access to the platform.', style: { borderColor: 'var(--green)', color: 'var(--green)' } },
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 800 }}>

        {/* Back */}
        <button className="btn btn-outline btn-sm" style={{ marginBottom: 20 }} onClick={() => navigate('/admin')}>
          ← Back to admin
        </button>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

        {/* User header */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}>
                  {user.company_name}
                </h1>
                <span className={`badge ${statusCfg.class}`}>{statusCfg.label}</span>
                <span className="badge badge-draft" style={{ textTransform: 'capitalize' }}>{user.role}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--muted)' }}>
                <span>📧 {user.email}</span>
                <span>👤 {user.contact_name}</span>
                {user.phone && <span>📞 {user.phone}</span>}
                <span>🏷️ {user.anonymous_handle}</span>
                <span>📅 Joined {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                {user.approved_at && <span>✓ Approved {new Date(user.approved_at).toLocaleDateString('en-GB')}</span>}
              </div>
            </div>

            {/* Account actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
              {statusCfg.actions.map(action => {
                const cfg = ACTION_CONFIG[action]
                return (
                  <button
                    key={action}
                    className={`btn ${cfg.class} btn-sm`}
                    style={{ justifyContent: 'center', ...cfg.style }}
                    onClick={() => cfg.confirm ? setConfirmAction(action) : handleAction(action)}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Brand permissions */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 4 }}>
            Brand access
          </h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            {activePerms.length} active brand{activePerms.length !== 1 ? 's' : ''}
          </p>

          {brands.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>No brands on the platform yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {brands.map(brand => {
                const perm = permissions.find(p => p.brand_id === brand.id)
                const active = perm && !perm.revoked_at
                return (
                  <div key={brand.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px',
                    background: active ? 'var(--green-bg)' : 'var(--surface)',
                    borderRadius: 'var(--radius)',
                    border: `1px solid ${active ? 'var(--green)' : 'var(--border)'}`,
                    transition: 'all 0.15s'
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14, color: active ? 'var(--green)' : 'var(--navy)' }}>
                        {active ? '✓ ' : ''}{brand.name}
                      </div>
                      {active && perm.granted_at && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                          Granted {new Date(perm.granted_at).toLocaleDateString('en-GB')}
                        </div>
                      )}
                    </div>
                    <button
                      className={`btn btn-sm ${active ? 'btn-danger' : 'btn-outline'}`}
                      style={{ justifyContent: 'center' }}
                      onClick={() => active ? revokeBrand(brand.id) : grantBrand(brand.id)}
                    >
                      {active ? 'Revoke' : 'Grant'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Brand applications */}
        {brandApplications.length > 0 && (
          <div className="card">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16 }}>
              Brand applications
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {brandApplications.map(app => (
                <div key={app.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: 'var(--surface)',
                  borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13
                }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>
                      {app.is_other ? app.brand_name_text : app.brand?.name}
                    </span>
                    {app.is_other && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '1px 6px', borderRadius: 100 }}>
                        Unregistered
                      </span>
                    )}
                  </div>
                  <span className={`badge badge-${app.status}`} style={{ textTransform: 'capitalize' }}>
                    {app.status}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
              Manage detailed brand applications in{' '}
              <button
                onClick={() => navigate('/admin/brand-applications')}
                style={{ background: 'none', border: 'none', color: 'var(--navy)', cursor: 'pointer', fontWeight: 500, fontSize: 12, textDecoration: 'underline' }}
              >
                Brand applications
              </button>
            </p>
          </div>
        )}

        {/* Confirm action modal */}
        {confirmAction && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(11,22,40,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: 20
          }}>
            <div className="card" style={{ maxWidth: 400, width: '100%' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 10 }}>
                {ACTION_CONFIG[confirmAction].label}?
              </h3>
              <p style={{ color: 'var(--slate)', fontSize: 14, marginBottom: 20 }}>
                {ACTION_CONFIG[confirmAction].confirmMsg}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setConfirmAction(null)}>Cancel</button>
                <button
                  className={`btn ${ACTION_CONFIG[confirmAction].class}`}
                  onClick={() => handleAction(confirmAction)}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
