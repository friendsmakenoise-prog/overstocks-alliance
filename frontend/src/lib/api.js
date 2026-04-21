import { supabase } from './supabase'

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001'

// ============================================================
// API CLIENT
// Automatically attaches the user's session token to every request.
// ============================================================

async function apiRequest(method, path, body = null) {
  const { data: { session } } = await supabase.auth.getSession()

  const headers = { 'Content-Type': 'application/json' }

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  const config = { method, headers }
  if (body) config.body = JSON.stringify(body)

  const response = await fetch(`${API_URL}${path}`, config)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }

  return data
}

export const api = {
  get:    (path)         => apiRequest('GET', path),
  post:   (path, body)   => apiRequest('POST', path, body),
  put:    (path, body)   => apiRequest('PUT', path, body),
  delete: (path)         => apiRequest('DELETE', path),

  // Auth
  signup: (data)         => apiRequest('POST', '/api/auth/signup', data),
  me:     ()             => apiRequest('GET', '/api/auth/me'),

  // Listings
  getListings: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return apiRequest('GET', `/api/listings${qs ? '?' + qs : ''}`)
  },
  getListing:    (id)    => apiRequest('GET', `/api/listings/${id}`),
  createListing: (data)  => apiRequest('POST', '/api/listings', data),
  reportListing: (id, reason) => apiRequest('POST', `/api/listings/${id}/report`, { reason }),

  // Offers
  getOffers:      ()             => apiRequest('GET', '/api/offers'),
  createOffer:    (data)         => apiRequest('POST', '/api/offers', data),
  counterOffer:   (id, data)     => apiRequest('POST', `/api/offers/${id}/counter`, data),
  acceptOffer:    (id)           => apiRequest('POST', `/api/offers/${id}/accept`),
  declineOffer:   (id)           => apiRequest('POST', `/api/offers/${id}/decline`),
  getMessages:    (id)           => apiRequest('GET', `/api/offers/${id}/messages`),
  sendMessage:    (id, content)  => apiRequest('POST', `/api/offers/${id}/messages`, { content }),

  // Payments
  createCheckout:       (offerId)  => apiRequest('POST', '/api/payments/checkout', { offerId }),
  getConnectStatus:     ()         => apiRequest('GET', '/api/payments/connect/status'),
  startConnectOnboard:  ()         => apiRequest('POST', '/api/payments/connect/onboard'),

  // Admin
  admin: {
    getUsers:      (params = {}) => apiRequest('GET', '/api/admin/users?' + new URLSearchParams(params)),
    approveUser:   (id)          => apiRequest('POST', `/api/admin/users/${id}/approve`),
    rejectUser:    (id, reason)  => apiRequest('POST', `/api/admin/users/${id}/reject`, { reason }),
    suspendUser:   (id)          => apiRequest('POST', `/api/admin/users/${id}/suspend`),
    getBrands:     ()            => apiRequest('GET', '/api/admin/brands'),
    createBrand:   (name)        => apiRequest('POST', '/api/admin/brands', { name }),
    getListings:   (params = {}) => apiRequest('GET', '/api/admin/listings?' + new URLSearchParams(params)),
    approveListing:(id)          => apiRequest('POST', `/api/admin/listings/${id}/approve`),
    removeListing: (id, reason)  => apiRequest('POST', `/api/admin/listings/${id}/remove`, { reason }),
    getReports:    ()            => apiRequest('GET', '/api/admin/reports'),
    getUserPermissions: (id)     => apiRequest('GET', `/api/admin/users/${id}/permissions`),
    grantPermission:(userId, brandId) => apiRequest('POST', `/api/admin/users/${userId}/permissions/grant`, { brandId }),
    revokePermission:(userId, brandId) => apiRequest('POST', `/api/admin/users/${userId}/permissions/revoke`, { brandId }),
  }
}
