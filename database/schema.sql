-- ============================================================
-- OVERSTOCKS ALLIANCE — DATABASE SCHEMA
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('retailer', 'supplier', 'admin');
CREATE TYPE user_status AS ENUM ('pending', 'approved', 'suspended', 'rejected');
CREATE TYPE listing_status AS ENUM ('draft', 'pending_review', 'active', 'removed', 'sold');
CREATE TYPE shipping_mode AS ENUM ('included', 'buyer_arranges');
CREATE TYPE order_status AS ENUM ('pending_payment', 'paid', 'processing', 'dispatched', 'delivered', 'cancelled', 'refunded');

-- ============================================================
-- BRANDS
-- ============================================================

CREATE TABLE brands (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by    UUID, -- FK added after users table
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================

CREATE TABLE user_profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT NOT NULL UNIQUE,
  role             user_role NOT NULL DEFAULT 'retailer',
  status           user_status NOT NULL DEFAULT 'pending',
  company_name     TEXT NOT NULL,         -- PRIVATE: never returned to other users
  contact_name     TEXT NOT NULL,         -- PRIVATE: never returned to other users
  phone            TEXT,                  -- PRIVATE
  anonymous_handle TEXT NOT NULL UNIQUE,  -- Public identifier e.g. "Seller #4F2A"
  approved_by      UUID REFERENCES user_profiles(id),
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from brands back to user_profiles
ALTER TABLE brands ADD CONSTRAINT brands_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES user_profiles(id);

-- ============================================================
-- BRAND PERMISSIONS (the access control join table)
-- ============================================================

CREATE TABLE brand_permissions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  brand_id    UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  granted_by  UUID NOT NULL REFERENCES user_profiles(id),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ,               -- NULL = still active
  revoked_by  UUID REFERENCES user_profiles(id),
  UNIQUE(user_id, brand_id)              -- One permission record per user/brand pair
);

-- Index for fast permission lookups (called on every listing query)
CREATE INDEX idx_brand_permissions_user_id ON brand_permissions(user_id);
CREATE INDEX idx_brand_permissions_brand_id ON brand_permissions(brand_id);
CREATE INDEX idx_brand_permissions_active ON brand_permissions(user_id, brand_id)
  WHERE revoked_at IS NULL;

-- ============================================================
-- LISTINGS
-- ============================================================

CREATE TABLE listings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id       UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE, -- PRIVATE
  brand_id        UUID NOT NULL REFERENCES brands(id),
  title           TEXT NOT NULL CHECK (char_length(title) <= 150),
  description     TEXT NOT NULL CHECK (char_length(description) <= 2000),
  price_pence     INTEGER NOT NULL CHECK (price_pence > 0), -- Store in pence to avoid float issues
  quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  sku             TEXT,                  -- Optional seller reference
  shipping_mode   shipping_mode NOT NULL DEFAULT 'buyer_arranges',
  shipping_cost_pence INTEGER CHECK (
    (shipping_mode = 'included' AND shipping_cost_pence IS NOT NULL AND shipping_cost_pence >= 0)
    OR (shipping_mode = 'buyer_arranges' AND shipping_cost_pence IS NULL)
  ),
  image_urls      TEXT[] DEFAULT '{}',   -- Array of CDN image paths
  status          listing_status NOT NULL DEFAULT 'pending_review',
  view_count      INTEGER NOT NULL DEFAULT 0,
  reported_count  INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast filtered queries
CREATE INDEX idx_listings_brand_id ON listings(brand_id);
CREATE INDEX idx_listings_seller_id ON listings(seller_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_created_at ON listings(created_at DESC);

-- ============================================================
-- ORDERS
-- ============================================================

CREATE TABLE orders (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id            UUID NOT NULL REFERENCES listings(id),
  buyer_id              UUID NOT NULL REFERENCES user_profiles(id),  -- PRIVATE from seller
  seller_id             UUID NOT NULL REFERENCES user_profiles(id),  -- PRIVATE from buyer
  brand_id              UUID NOT NULL REFERENCES brands(id),

  -- Amounts (all in pence)
  goods_value_pence     INTEGER NOT NULL CHECK (goods_value_pence > 0),
  shipping_cost_pence   INTEGER NOT NULL DEFAULT 0,
  platform_fee_pence    INTEGER NOT NULL CHECK (platform_fee_pence >= 0),
  platform_fee_pct      NUMERIC(5,2) NOT NULL,  -- e.g. 2.00 for 2%
  seller_payout_pence   INTEGER NOT NULL,        -- goods_value - platform_fee

  -- Shipping
  shipping_mode         shipping_mode NOT NULL,
  shipping_address      JSONB,                   -- Only stored if platform ships

  -- Stripe
  stripe_payment_intent_id    TEXT UNIQUE,
  stripe_transfer_id          TEXT,              -- Payout to seller
  stripe_platform_fee_id      TEXT,

  status                order_status NOT NULL DEFAULT 'pending_payment',
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX idx_orders_seller_id ON orders(seller_id);
CREATE INDEX idx_orders_listing_id ON orders(listing_id);
CREATE INDEX idx_orders_stripe_intent ON orders(stripe_payment_intent_id);

-- ============================================================
-- LISTING REPORTS (moderation)
-- ============================================================

CREATE TABLE listing_reports (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id   UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reporter_id  UUID NOT NULL REFERENCES user_profiles(id),
  reason       TEXT NOT NULL CHECK (char_length(reason) <= 500),
  resolved     BOOLEAN NOT NULL DEFAULT false,
  resolved_by  UUID REFERENCES user_profiles(id),
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(listing_id, reporter_id)  -- One report per user per listing
);

-- ============================================================
-- AUDIT LOG (admin actions)
-- ============================================================

CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id     UUID NOT NULL REFERENCES user_profiles(id),
  action       TEXT NOT NULL,            -- e.g. 'approve_user', 'assign_brand', 'remove_listing'
  target_type  TEXT NOT NULL,            -- e.g. 'user', 'listing', 'brand_permission'
  target_id    UUID NOT NULL,
  metadata     JSONB DEFAULT '{}',       -- Any extra context
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_admin_id ON audit_log(admin_id);
CREATE INDEX idx_audit_log_target_id ON audit_log(target_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- ============================================================
-- FEE CONFIGURATION (admin-adjustable)
-- ============================================================

CREATE TABLE fee_config (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_name           TEXT NOT NULL,
  min_value_pence     INTEGER NOT NULL,   -- Inclusive lower bound
  max_value_pence     INTEGER,            -- NULL = no upper limit
  fee_percentage      NUMERIC(5,2) NOT NULL,
  active              BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default fee tiers (matches your 1-3% model)
INSERT INTO fee_config (tier_name, min_value_pence, max_value_pence, fee_percentage) VALUES
  ('Standard',  0,       49999,  3.00),   -- Under £500 = 3%
  ('Mid',       50000,   199999, 2.00),   -- £500–£1,999 = 2%
  ('Large',     200000,  NULL,   1.00);   -- £2,000+ = 1%

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_user_profiles
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_listings
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_orders
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_brands
  BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Supabase enforces these at the database level — not just app level
-- ============================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- USER PROFILES: users see only their own profile; admins see all
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- LISTINGS: users can only see listings for their approved brands
CREATE POLICY "Users see listings for approved brands only"
  ON listings FOR SELECT
  USING (
    status = 'active'
    AND brand_id IN (
      SELECT brand_id FROM brand_permissions
      WHERE user_id = auth.uid()
      AND revoked_at IS NULL
    )
  );

CREATE POLICY "Suppliers can manage own listings"
  ON listings FOR ALL
  USING (seller_id = auth.uid());

CREATE POLICY "Admins can manage all listings"
  ON listings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- BRAND PERMISSIONS: users see only their own permissions
CREATE POLICY "Users see own brand permissions"
  ON brand_permissions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage all brand permissions"
  ON brand_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ORDERS: buyers/sellers see only their own orders
CREATE POLICY "Users see own orders"
  ON orders FOR SELECT
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "Admins see all orders"
  ON orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- BRANDS: approved users can view active brands they have permission for
CREATE POLICY "Users see brands they are approved for"
  ON brands FOR SELECT
  USING (
    status = 'active'
    AND id IN (
      SELECT brand_id FROM brand_permissions
      WHERE user_id = auth.uid()
      AND revoked_at IS NULL
    )
  );

CREATE POLICY "Admins manage all brands"
  ON brands FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- AUDIT LOG: admins only
CREATE POLICY "Admins view audit log"
  ON audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
