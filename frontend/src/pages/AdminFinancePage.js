import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'

function formatPrice(pence) {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function AdminFinancePage() {
  const [orders, setOrders] = useState([])
  const [feeTiers, setFeeTiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingTiers, setSavingTiers] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editTiers, setEditTiers] = useState([])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: paidOffers, error: offersError } = await supabase
        .from('offers')
        .select(`
          id, agreed_price_pence, offered_price_pence, quantity,
          platform_fee_pence, platform_fee_pct, seller_payout_pence,
          shipping_cost_pence, shipping_mode,
          created_at, updated_at,
          listing:listing_id ( id, title, brands(name) ),
          buyer:buyer_id ( anonymous_handle ),
          seller:seller_id ( anonymous_handle )
        `)
        .eq('status', 'paid')
        .order('updated_at', { ascending: false })

      if (offersError) console.warn('Offers query error:', offersError)
      setOrders(paidOffers || [])

      const { data: tiers, error: tiersError } = await supabase
        .from('fee_config')
        .select('*')
        .eq('active', true)
        .order('min_value_pence', { ascending: true })

      if (tiersError) console.warn('Fee config error:', tiersError)
      setFeeTiers(tiers || [])
      setEditTiers(tiers?.map(t => ({ ...t })) || [])

    } catch (err) {
      setError('Failed to load finance data')
    } finally {
      setLoading(false)
    }
  }

  async function saveTiers() {
    setSavingTiers(true)
    setError('')
    setSuccess('')
    try {
      for (const tier of editTiers) {
        const pct = parseFloat(tier.fee_percentage)
        if (isNaN(pct) || pct < 0 || pct > 100) throw new Error(`Invalid percentage for ${tier.tier_name}`)

        const minPence = Math.round(parseFloat(tier.min_value_pounds ?? tier.min_value_pence / 100) * 100)
        const maxPence = tier.max_value_pounds !== undefined
          ? (tier.max_value_pounds === '' || tier.max_value_pounds === null ? null : Math.round(parseFloat(tier.max_value_pounds) * 100))
          : tier.max_value_pence

        const { error } = await supabase
          .from('fee_config')
          .update({ fee_percentage: pct, min_value_pence: minPence, max_value_pence: maxPence, tier_name: tier.tier_name })
          .eq('id', tier.id)

        if (error) throw error
      }
      setSuccess('Fee tiers updated successfully')
      await loadAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingTiers(false)
    }
  }

  function updateTier(id, field, value) {
    setEditTiers(tiers => tiers.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  const totalGoodsValue    = orders.reduce((s, o) => s + ((o.agreed_price_pence || o.offered_price_pence) * o.quantity), 0)
  const totalPlatformFees  = orders.reduce((s, o) => s + (o.platform_fee_pence || 0), 0)
  const totalShipping      = orders.reduce((s, o) => s + (o.shipping_cost_pence || 0), 0)
  const totalTransactions  = orders.length

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="container">

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 4 }}>Finance</h1>
          <p style={{ color: 'var(--slate)', fontSize: 14 }}>Platform revenue, transaction history and fee configuration</p>
        </div>

        {error   && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

        {/* Summary stat cards */}
        <div className="stat-cards" style={{ marginBottom: 28 }}>
          {[
            { label: 'Total transactions',  value: totalTransactions,       format: false },
            { label: 'Total goods value',   value: totalGoodsValue,         format: true },
            { label: 'Platform fees earned',value: totalPlatformFees,       format: true,  highlight: true },
            { label: 'Shipping processed',  value: totalShipping,           format: true },
          ].map((card, i) => (
            <div key={i} className={`stat-card ${card.highlight ? 'highlight' : ''}`}>
              <div className="stat-card-value" style={{ fontSize: 22 }}>
                {card.format ? formatPrice(card.value) : card.value}
              </div>
              <div className="stat-card-label">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Main layout — table + sidebar */}
        <div className="layout-main-sidebar">

          {/* Transaction history */}
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 16 }}>
              Transaction history
            </h2>

            {orders.length === 0 ? (
              <div className="empty-state">
                <h3>No completed transactions yet</h3>
                <p>Paid orders will appear here.</p>
              </div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Listing</th>
                        <th className="hide-mobile">Brand</th>
                        <th>Value</th>
                        <th>Fee</th>
                        <th className="hide-mobile">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(order => {
                        const goodsValue = (order.agreed_price_pence || order.offered_price_pence) * order.quantity
                        return (
                          <tr key={order.id}>
                            <td>
                              <div style={{ fontWeight: 500, fontSize: 13 }}>{order.listing?.title}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                                {order.buyer?.anonymous_handle} → {order.seller?.anonymous_handle}
                              </div>
                            </td>
                            <td className="hide-mobile" style={{ fontSize: 13 }}>{order.listing?.brands?.name}</td>
                            <td style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
                              {formatPrice(goodsValue)}
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                {order.quantity} unit{order.quantity !== 1 ? 's' : ''}
                              </div>
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 500 }}>
                                {formatPrice(order.platform_fee_pence || 0)}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                {order.platform_fee_pct}%
                              </div>
                            </td>
                            <td className="hide-mobile" style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                              {new Date(order.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--surface)', fontWeight: 500 }}>
                        <td style={{ padding: '12px 16px', fontSize: 13 }}>
                          {totalTransactions} transaction{totalTransactions !== 1 ? 's' : ''}
                        </td>
                        <td className="hide-mobile" />
                        <td style={{ padding: '12px 16px', fontSize: 13, whiteSpace: 'nowrap' }}>
                          {formatPrice(totalGoodsValue)}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--green)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {formatPrice(totalPlatformFees)}
                        </td>
                        <td className="hide-mobile" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Fee tier configuration */}
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 16 }}>
              Fee tiers
            </h2>
            <div className="card">
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                Platform fee percentage applied based on total goods value. Changes take effect on new transactions immediately.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {editTiers.map(tier => (
                  <div key={tier.id} style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label className="form-label">Tier name</label>
                      <input className="form-input" type="text" value={tier.tier_name}
                        onChange={e => updateTier(tier.id, 'tier_name', e.target.value)} />
                    </div>
                    {/* 3-col grid — stacks to 1 on mobile */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: 11 }}>Min (£)</label>
                        <input className="form-input" type="number" min="0" step="1"
                          value={tier.min_value_pounds ?? (tier.min_value_pence / 100)}
                          onChange={e => updateTier(tier.id, 'min_value_pounds', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: 11 }}>Max (£)</label>
                        <input className="form-input" type="number" min="0" step="1"
                          value={tier.max_value_pounds ?? (tier.max_value_pence !== null ? tier.max_value_pence / 100 : '')}
                          onChange={e => updateTier(tier.id, 'max_value_pounds', e.target.value)}
                          placeholder="No limit" />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: 11 }}>Fee %</label>
                        <input className="form-input" type="number" min="0" max="100" step="0.1"
                          value={tier.fee_percentage}
                          onChange={e => updateTier(tier.id, 'fee_percentage', e.target.value)} />
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                      {tier.max_value_pence === null
                        ? `Over £${(tier.min_value_pence / 100).toLocaleString()} → ${tier.fee_percentage}%`
                        : `£${(tier.min_value_pence / 100).toLocaleString()} – £${(tier.max_value_pence / 100).toLocaleString()} → ${tier.fee_percentage}%`
                      }
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                onClick={saveTiers} disabled={savingTiers}>
                {savingTiers ? 'Saving…' : 'Save fee tiers'}
              </button>

              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--amber-bg)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--amber)', lineHeight: 1.6 }}>
                ⚠️ Changes apply to new transactions only.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
