import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

function formatPrice(pence) {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
}

export default function OrderPage() {
  const { id } = useParams()
  const location = useLocation()
  const { profile } = useAuth()
  const [offer, setOffer] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)

  const isSuccess = new URLSearchParams(location.search).get('success')
  const isBuyer = offer?.buyer?.id === profile?.id

  useEffect(() => { loadOrder() }, [id])
  useEffect(() => {
    if (offer?.status === 'paid') loadMessages()
  }, [offer?.status])
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadOrder() {
    setLoading(true)
    try {
      const data = await api.getOffers()
      const found = data.offers.find(o => o.id === id)
      if (!found) throw new Error('Order not found')
      setOffer(found)
    } catch (err) {
      setError('Order not found')
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages() {
    try {
      const data = await api.getMessages(id)
      setMessages(data.messages)
    } catch { /* Messages not available yet */ }
  }

  async function handleSendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim()) return
    setSendingMessage(true)
    try {
      const data = await api.sendMessage(id, newMessage.trim())
      setMessages(m => [...m, data.message])
      setNewMessage('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSendingMessage(false)
    }
  }

  if (loading) return <div className="loading-page"><div className="spinner" /></div>
  if (error || !offer) return (
    <div className="page"><div className="container">
      <div className="empty-state"><h3>Order not found</h3></div>
    </div></div>
  )

  const totalGoods = (offer.agreed_price_pence || offer.offered_price_pence) * offer.quantity
  const totalCharge = totalGoods + offer.shipping_cost_pence

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 800 }}>

        {isSuccess && (
          <div className="alert alert-success" style={{ marginBottom: 24 }}>
            🎉 Payment confirmed! Your order is now active. You can message the {isBuyer ? 'seller' : 'buyer'} below to coordinate logistics.
          </div>
        )}

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 4 }}>
          Order details
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
          Order #{offer.id.substring(0, 8).toUpperCase()}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>

          {/* Left: messages */}
          <div>
            {offer.status === 'paid' ? (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 500, fontSize: 14 }}>
                  Messages with {isBuyer ? offer.seller?.anonymous_handle : offer.buyer?.anonymous_handle}
                </div>

                {/* Message thread */}
                <div style={{ padding: 16, minHeight: 200, maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {messages.length === 0 ? (
                    <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                      No messages yet. Say hello to coordinate your delivery!
                    </p>
                  ) : (
                    messages.map(msg => {
                      const isMe = msg.sender?.id === profile?.id
                      return (
                        <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            maxWidth: '75%', padding: '8px 12px',
                            borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                            background: isMe ? 'var(--navy)' : 'var(--surface)',
                            color: isMe ? '#fff' : 'var(--navy)',
                            fontSize: 14, lineHeight: 1.5
                          }}>
                            {!isMe && (
                              <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 4, color: 'var(--muted)', opacity: isMe ? 0.7 : 1 }}>
                                {msg.sender?.anonymous_handle}
                              </div>
                            )}
                            {msg.content}
                            <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6, textAlign: 'right' }}>
                              {new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message input */}
                <form onSubmit={handleSendMessage} style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', gap: 8 }}>
                  <input
                    className="form-input"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type a message…"
                    maxLength={1000}
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={sendingMessage || !newMessage.trim()}>
                    {sendingMessage ? '…' : 'Send'}
                  </button>
                </form>

                <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)' }}>
                  🔒 Messages are anonymous — only your handle is visible, not your company name or contact details
                </div>
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 8 }}>Messages unlock after payment</h3>
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                  Once payment is confirmed, you'll be able to message the {isBuyer ? 'seller' : 'buyer'} to coordinate delivery and logistics.
                </p>
              </div>
            )}
          </div>

          {/* Right: order summary */}
          <div style={{ position: 'sticky', top: 80 }}>
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Order summary
              </div>

              {offer.listing?.image_urls?.length > 0 && (
                <img
                  src={offer.listing.image_urls[0]}
                  alt={offer.listing?.title}
                  style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 'var(--radius)', marginBottom: 12 }}
                />
              )}

              <div style={{ fontWeight: 500, marginBottom: 4 }}>{offer.listing?.title}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                {offer.listing?.brands?.name} · {offer.quantity} unit{offer.quantity !== 1 ? 's' : ''}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Price per unit', value: formatPrice(offer.agreed_price_pence || offer.offered_price_pence) },
                  { label: `× ${offer.quantity} units`, value: formatPrice((offer.agreed_price_pence || offer.offered_price_pence) * offer.quantity) },
                  offer.shipping_cost_pence > 0 && { label: 'Shipping', value: formatPrice(offer.shipping_cost_pence) },
                  { label: 'Platform fee', value: `${offer.platform_fee_pct}% (${formatPrice(offer.platform_fee_pence)})`, muted: true },
                ].filter(Boolean).map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: row.muted ? 'var(--muted)' : 'var(--slate)' }}>{row.label}</span>
                    <span style={{ color: row.muted ? 'var(--muted)' : 'var(--navy)' }}>{row.value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 500, paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                  <span>Total</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>{formatPrice(totalCharge)}</span>
                </div>
              </div>

              <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--muted)' }}>
                📦 {offer.shipping_mode === 'included' ? 'Shipping included in price above' : 'Buyer arranges own shipping'}
              </div>

              <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--muted)' }}>
                {isBuyer
                  ? `Seller receives: ${formatPrice(offer.seller_payout_pence)} after platform fee`
                  : `You receive: ${formatPrice(offer.seller_payout_pence)} after platform fee`
                }
              </div>

              {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
