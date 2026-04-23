require('dotenv').config()
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')

const authRoutes = require('./routes/auth')
const listingsRoutes = require('./routes/listings')
const adminRoutes = require('./routes/admin')
const offersRoutes = require('./routes/offers')
const paymentsRoutes = require('./routes/payments')
const brandReviewsRoutes = require('./routes/brandReviews')

const app = express()

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

// Helmet sets secure HTTP headers
app.use(helmet())

// CORS — only allow requests from our frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// Parse JSON bodies — but NOT for the Stripe webhook route
// Stripe requires the raw unparsed body to verify the signature
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook') {
    next()
  } else {
    express.json({ limit: '10kb' })(req, res, next)
  }
})

// Global rate limiting — 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
})
app.use(globalLimiter)

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Only 10 login/signup attempts per 15 minutes
  message: { error: 'Too many authentication attempts, please wait 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false
})

// ============================================================
// ROUTES
// ============================================================

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/listings', listingsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/offers', offersRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/brand-reviews', brandReviewsRoutes)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

// ============================================================
// START
// ============================================================

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Overstocks Alliance API running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
})
