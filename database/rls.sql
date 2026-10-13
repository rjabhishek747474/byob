-- ==============================================================================
-- Multi-Tenant Row-Level Security (RLS) Setup
-- Platform: BeYourOwnBoss (BYOB) E-Commerce SaaS
-- ==============================================================================
--
-- CRITICAL SECURITY ARCHITECTURE NOTE:
--
-- In pooled connection architectures (e.g. postgres.js, PgBouncer, RDS Proxy),
-- database connections are shared across multiple HTTP requests and tenants.
--
-- To prevent cross-tenant connection leakage:
-- 1. ALWAYS set the tenant context using `SET LOCAL app.current_tenant_id = '<TENANT_ID>';`
--    within an explicit transaction block (`BEGIN ... COMMIT`).
-- 2. `SET LOCAL` automatically scopes the session configuration variable to the
--    current transaction and clears/reverts it as soon as the transaction commits or rolls back.
-- 3. NEVER use session-level `SET app.current_tenant_id = '...'` without `LOCAL`,
--    as subsequent queries executed on that pooled connection could inadvertently run
--    under the previous tenant's identity!
--
-- Example Application Usage:
--   BEGIN;
--   SET LOCAL app.current_tenant_id = 'ten_01JABC1234567890';
--   SELECT * FROM products; -- Returns ONLY products belonging to ten_01JABC1234567890
--   COMMIT;
--
-- For platform administrative queries operating across all tenants:
-- Either run queries under a database superuser / bypassrls role, or clear the local tenant:
--   SET LOCAL app.current_tenant_id = '';
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Tenants Table
-- ------------------------------------------------------------------------------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON tenants;
CREATE POLICY tenant_isolation_policy ON tenants
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- ------------------------------------------------------------------------------
-- Macro-like helper application for all tenant-scoped tables
-- ------------------------------------------------------------------------------

-- 2. Store Settings
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON store_settings;
CREATE POLICY tenant_isolation_policy ON store_settings
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 3. Themes
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE themes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON themes;
CREATE POLICY tenant_isolation_policy ON themes
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 4. Categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON categories;
CREATE POLICY tenant_isolation_policy ON categories
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 5. Products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON products;
CREATE POLICY tenant_isolation_policy ON products
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 6. Product Variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON product_variants;
CREATE POLICY tenant_isolation_policy ON product_variants
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 7. Product Images
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON product_images;
CREATE POLICY tenant_isolation_policy ON product_images
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 8. Inventory Movements
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON inventory_movements;
CREATE POLICY tenant_isolation_policy ON inventory_movements
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 9. Customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON customers;
CREATE POLICY tenant_isolation_policy ON customers
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 10. Addresses
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON addresses;
CREATE POLICY tenant_isolation_policy ON addresses
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 11. Carts
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON carts;
CREATE POLICY tenant_isolation_policy ON carts
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 12. Cart Items
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON cart_items;
CREATE POLICY tenant_isolation_policy ON cart_items
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 13. Orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON orders;
CREATE POLICY tenant_isolation_policy ON orders
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 14. Order Items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON order_items;
CREATE POLICY tenant_isolation_policy ON order_items
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 15. Order Status History
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON order_status_history;
CREATE POLICY tenant_isolation_policy ON order_status_history
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 16. Pages
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON pages;
CREATE POLICY tenant_isolation_policy ON pages
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 17. Page Versions
ALTER TABLE page_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON page_versions;
CREATE POLICY tenant_isolation_policy ON page_versions
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 18. Assets
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON assets;
CREATE POLICY tenant_isolation_policy ON assets
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 19. Navigation Menus
ALTER TABLE navigation_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE navigation_menus FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON navigation_menus;
CREATE POLICY tenant_isolation_policy ON navigation_menus
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 20. Campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON campaigns;
CREATE POLICY tenant_isolation_policy ON campaigns
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 21. Banner Slides
ALTER TABLE banner_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE banner_slides FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON banner_slides;
CREATE POLICY tenant_isolation_policy ON banner_slides
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 22. Coupons
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON coupons;
CREATE POLICY tenant_isolation_policy ON coupons
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 23. Coupon Redemptions
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON coupon_redemptions;
CREATE POLICY tenant_isolation_policy ON coupon_redemptions
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 24. Subscription Plans
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON subscription_plans;
CREATE POLICY tenant_isolation_policy ON subscription_plans
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 25. Customer Subscriptions
ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_subscriptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON customer_subscriptions;
CREATE POLICY tenant_isolation_policy ON customer_subscriptions
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 26. Analytics Events
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON analytics_events;
CREATE POLICY tenant_isolation_policy ON analytics_events
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

-- 27. Consent Records
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON consent_records;
CREATE POLICY tenant_isolation_policy ON consent_records
  FOR ALL
  USING (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  )
  WITH CHECK (
    current_setting('app.current_tenant_id', true) = tenant_id
    OR current_setting('app.is_platform_admin', true) = 'true'
  );
