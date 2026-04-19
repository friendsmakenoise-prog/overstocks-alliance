# Overstocks Alliance — Setup & Deployment Guide
# Follow these steps in order. Each section has exact instructions.
# Estimated time: 60–90 minutes for first-time setup.

=================================================================
STEP 1: SET UP SUPABASE (your database + auth)
=================================================================

1. Go to https://supabase.com and click "Start your project"
2. Sign up with GitHub (recommended) or email
3. Click "New project"
   - Name: overstocks-alliance
   - Database password: generate a strong one and SAVE IT somewhere safe
   - Region: Europe West (Ireland) — closest to UK users
   - Plan: Free
4. Wait ~2 minutes for the project to provision

5. RUN THE DATABASE SCHEMA:
   - In your Supabase dashboard, click "SQL Editor" in the left sidebar
   - Click "New query"
   - Open the file: database/schema.sql from this project
   - Copy the ENTIRE contents and paste into the SQL editor
   - Click "Run" (green button)
   - You should see "Success. No rows returned"

6. GET YOUR API KEYS:
   - Click "Settings" (gear icon) → "API"
   - Copy these two values — you'll need them in Steps 2 and 3:
     a) "Project URL" — looks like: https://abcdefgh.supabase.co
     b) "anon public" key — long string starting with "eyJ..."
     c) "service_role" key — KEEP THIS SECRET, never put in frontend

7. CONFIGURE EMAIL CONFIRMATIONS (optional for MVP):
   - Click "Authentication" → "Providers" → "Email"
   - For MVP testing, you can disable "Confirm email" to skip verification
   - Re-enable before going live with real users

=================================================================
STEP 2: CREATE YOUR FIRST ADMIN USER
=================================================================

After setting up Supabase, you need one admin account to approve
other users. Do this via Supabase directly (not the app).

1. In Supabase dashboard, click "Authentication" → "Users"
2. Click "Invite user" and enter your email
3. Check your email and click the confirmation link
4. Now go to "SQL Editor" and run this (replace with your user's ID
   which you can find in the Users table):

   INSERT INTO user_profiles (id, email, role, status, company_name, contact_name, anonymous_handle)
   VALUES (
     '46e0738c-366e-4eb8-b719-81345c8a908c',
     'friendsmakenoise@googlemail.com',
     'admin',
     'approved',
     'Platform Admin',
     'Admin',
     'Admin #0001'
   );

5. You can now log into the app as an admin

=================================================================
STEP 3: SET UP THE BACKEND (Railway)
=================================================================

1. Go to https://railway.app and sign up with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub account and select this repository
   (You'll need to push the code to GitHub first — see Step 5)
4. Railway will detect it's a Node.js app automatically
5. Set the ROOT DIRECTORY to: backend
6. Click "Variables" and add these environment variables:
   - SUPABASE_URL = (your Project URL from Step 1)
   - SUPABASE_SERVICE_ROLE_KEY = (your service_role key from Step 1)
   - STRIPE_SECRET_KEY = sk_test_... (from Step 4 below)
   - STRIPE_WEBHOOK_SECRET = (from Step 4 below)
   - NODE_ENV = production
   - FRONTEND_URL = (your Vercel URL — add this after Step 4)
7. Copy the Railway URL for your backend — you'll need it next
   It will look like: https://your-app.up.railway.app

=================================================================
STEP 4: SET UP STRIPE (payments — test mode)
=================================================================

1. Go to https://dashboard.stripe.com and create an account
2. You're automatically in TEST MODE (toggle top-left — keep it on)
3. Click "Developers" → "API keys"
4. Copy your "Secret key" — starts with sk_test_
5. For webhooks (Stripe notifying your backend of payments):
   - Click "Developers" → "Webhooks" → "Add endpoint"
   - Endpoint URL: https://your-railway-url.up.railway.app/api/webhooks/stripe
   - Select events: payment_intent.succeeded, payment_intent.payment_failed
   - Copy the "Signing secret" — starts with whsec_

Note: Full Stripe Connect setup for payouts to sellers comes in Stage 3.
For now this gets your keys in place.

=================================================================
STEP 5: DEPLOY THE FRONTEND (Vercel)
=================================================================

1. Push your code to GitHub:
   - Go to https://github.com and create a new repository called "overstocks-alliance"
   - In your project folder, open a terminal and run:
     git init
     git add .
     git commit -m "Initial commit"
     git remote add origin https://github.com/YOUR-USERNAME/overstocks-alliance.git
     git push -u origin main

2. Go to https://vercel.com and sign up with GitHub
3. Click "Add New Project" → select your overstocks-alliance repository
4. Set ROOT DIRECTORY to: frontend
5. Add these Environment Variables:
   - REACT_APP_SUPABASE_URL = (your Project URL from Step 1)
   - REACT_APP_SUPABASE_ANON_KEY = (your anon key from Step 1)
   - REACT_APP_API_URL = (your Railway URL from Step 3)
6. Click "Deploy"
7. After deployment, copy your Vercel URL (e.g. overstocks-alliance.vercel.app)
8. Go back to Railway and update FRONTEND_URL to your Vercel URL

=================================================================
STEP 6: TEST EVERYTHING
=================================================================

Test this flow in order:

□ Visit your Vercel URL — login page should appear
□ Click "Request access" — sign up as a Retailer
□ Log in as your admin account
□ Go to /admin — you should see the pending application
□ Approve the user
□ Go to "Brands" tab — create a test brand (e.g. "Test Brand")
□ Go back to users, find your retailer, click "Brands →"
□ Grant them access to "Test Brand"
□ Sign out, log in as the retailer
□ You should see the browse page (empty listings for now)

□ Sign up a second account as a Supplier
□ Admin: approve them, assign "Test Brand"
□ Log in as supplier
□ Click "+ New listing" — create a test listing
□ Admin: approve the listing in the "Listing review" tab
□ Log in as retailer — the listing should now appear
□ Click the listing — verify NO company name or email is visible
□ Verify the anonymous handle shows (e.g. "Seller #A4F2")

=================================================================
STEP 7: MAKE IT YOUR OWN
=================================================================

To change the platform name or colours:
- Name: search for "Overstocks Alliance" across the frontend files
- Colours: edit frontend/src/styles/global.css — the :root section
  contains all colour variables

To change the fee tiers:
- Go to Supabase → SQL Editor and run:
  UPDATE fee_config SET fee_percentage = 2.50 WHERE tier_name = 'Standard';
  (Or edit the INSERT statements at the bottom of schema.sql)

=================================================================
FOLDER STRUCTURE REFERENCE
=================================================================

overstocks-alliance/
├── database/
│   └── schema.sql              ← Run this in Supabase SQL Editor
├── backend/
│   ├── .env.example            ← Copy to .env, fill in values
│   ├── package.json
│   └── src/
│       ├── index.js            ← Server entry point
│       ├── config/supabase.js  ← Database client
│       ├── middleware/auth.js  ← Session verification
│       ├── routes/
│       │   ├── auth.js         ← Signup, login, profile
│       │   ├── listings.js     ← Brand-gated listing routes
│       │   └── admin.js        ← Admin management routes
│       └── services/
│           ├── brandPermissions.js ← Core access control logic
│           └── fees.js             ← Fee calculation (1–3%)
└── frontend/
    ├── .env.example            ← Copy to .env, fill in values
    ├── package.json
    └── src/
        ├── App.js              ← Routes and layout
        ├── lib/
        │   ├── supabase.js     ← Supabase client
        │   ├── api.js          ← API calls with auth tokens
        │   └── AuthContext.js  ← Session state management
        ├── components/
        │   ├── Nav.js          ← Navigation bar
        │   └── ProtectedRoute.js ← Auth/role gating
        ├── pages/
        │   ├── LoginPage.js
        │   ├── SignupPage.js
        │   ├── HoldingPages.js     ← Pending + access denied
        │   ├── ListingsPage.js     ← Browse listings
        │   ├── ListingDetailPage.js
        │   ├── CreateListingPage.js
        │   └── AdminPage.js
        └── styles/
            └── global.css      ← All styles and design tokens

=================================================================
WHAT'S COMING IN STAGE 2 & 3
=================================================================

Stage 2 (next session):
  - My listings page (suppliers can manage their own listings)
  - Order history page
  - Basic messaging between buyer and seller (still anonymous)
  - Mobile-responsive improvements

Stage 3:
  - Full Stripe Connect integration
  - Checkout flow with fee breakdown shown to buyer
  - Seller payout setup
  - Test mode walkthrough with Stripe test cards
  - Webhook handling for payment confirmation
