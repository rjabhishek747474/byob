import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { customers, orders } from './orders';
import { tenants, users } from './tenants';

/**
 * Page type classification enum
 */
export const pageTypeEnum = pgEnum('page_type', [
  'home',
  'collection',
  'product',
  'about',
  'contact',
  'policy',
  'custom',
  'landing',
]);

/**
 * Page publication status enum
 */
export const pageStatusEnum = pgEnum('page_status', ['draft', 'published']);

/**
 * Digital asset processing lifecycle status enum
 */
export const assetProcessingStatusEnum = pgEnum('asset_processing_status', [
  'pending',
  'processing',
  'ready',
  'failed',
]);

/**
 * Coupon discount deduction type enum
 */
export const discountTypeEnum = pgEnum('discount_type', ['percentage', 'fixed']);

/**
 * Subscription plan lifecycle status enum
 */
export const subscriptionPlanStatusEnum = pgEnum('subscription_plan_status', [
  'active',
  'inactive',
]);

/**
 * Customer subscription active status enum
 */
export const customerSubscriptionStatusEnum = pgEnum('customer_subscription_status', [
  'active',
  'expired',
  'cancelled',
]);

/**
 * Pages table storing customizable storefront pages
 */
export const pages = pgTable(
  'pages',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    slug: varchar('slug', { length: 500 }).notNull(),
    pageType: pageTypeEnum('page_type').notNull().default('custom'),
    title: varchar('title', { length: 255 }).notNull(),
    status: pageStatusEnum('status').notNull().default('draft'),
    seoTitle: varchar('seo_title', { length: 255 }),
    seoDescription: text('seo_description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_pages_tenant_slug_unique').on(table.tenantId, table.slug),
  ]
);

/**
 * Page versions table storing revision history of page blocks
 */
export const pageVersions = pgTable(
  'page_versions',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    pageId: text('page_id')
      .notNull()
      .references(() => pages.id),
    versionNumber: integer('version_number').notNull(),
    schemaVersion: integer('schema_version').notNull().default(1),
    blocks: jsonb('blocks').notNull(), // Array/tree of page builder components
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: text('published_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_page_versions_page_version_unique').on(table.pageId, table.versionNumber),
    index('idx_page_versions_tenant_page').on(table.tenantId, table.pageId),
  ]
);

/**
 * Assets table for files, images, and documents
 */
export const assets = pgTable(
  'assets',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    storageKey: text('storage_key').notNull().unique(),
    fileName: varchar('file_name', { length: 500 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    checksum: varchar('checksum', { length: 128 }),
    processingStatus: assetProcessingStatusEnum('processing_status')
      .notNull()
      .default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_assets_tenant_created').on(table.tenantId, table.createdAt),
  ]
);

/**
 * Navigation menus table for storefront header/footer/sidebar menus
 */
export const navigationMenus = pgTable(
  'navigation_menus',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: varchar('name', { length: 100 }).notNull(), // e.g. 'header', 'footer'
    items: jsonb('items').notNull(), // Array of { label, href, children? }
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_navigation_menus_tenant_name_unique').on(table.tenantId, table.name),
  ]
);

/**
 * Marketing campaigns table
 */
export const campaigns = pgTable(
  'campaigns',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: varchar('name', { length: 255 }).notNull(),
    placement: varchar('placement', { length: 50 }).notNull().default('homepage'), // 'homepage', 'category', 'popup'
    dayOfWeek: integer('day_of_week'), // 0-6 (0=Sunday), nullable for any-day
    startDate: timestamp('start_date', { withTimezone: true }),
    endDate: timestamp('end_date', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_campaigns_tenant_active').on(table.tenantId, table.isActive),
  ]
);

/**
 * Banner slides table belonging to marketing campaigns
 */
export const bannerSlides = pgTable('banner_slides', {
  id: text('id').primaryKey(), // ULID
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id),
  campaignId: text('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  assetId: text('asset_id').references(() => assets.id),
  imageUrl: text('image_url'),
  altText: varchar('alt_text', { length: 500 }),
  heading: varchar('heading', { length: 255 }),
  subheading: text('subheading'),
  ctaLabel: varchar('cta_label', { length: 100 }),
  ctaHref: varchar('cta_href', { length: 500 }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Promotional discount coupons table
 */
export const coupons = pgTable(
  'coupons',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    code: varchar('code', { length: 100 }).notNull(),
    discountType: discountTypeEnum('discount_type').notNull(),
    discountValue: integer('discount_value').notNull(), // Percentage 1-100 or fixed amount in minor units
    minSubtotal: integer('min_subtotal').notNull().default(0), // Minor units
    maxUses: integer('max_uses'), // Nullable for unlimited
    usedCount: integer('used_count').notNull().default(0),
    perCustomerLimit: integer('per_customer_limit').notNull().default(1),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    eligibleProductIds: jsonb('eligible_product_ids'), // Nullable array of string IDs
    eligibleCategoryIds: jsonb('eligible_category_ids'), // Nullable array of string IDs
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_coupons_tenant_code_unique').on(table.tenantId, table.code),
  ]
);

/**
 * Coupon redemption tracking table
 */
export const couponRedemptions = pgTable(
  'coupon_redemptions',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    couponId: text('coupon_id')
      .notNull()
      .references(() => coupons.id),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    customerId: text('customer_id').references(() => customers.id),
    discountApplied: integer('discount_applied').notNull(), // Minor units
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_coupon_redemptions_coupon_order_unique').on(table.couponId, table.orderId),
  ]
);

/**
 * Subscription plans table (feature-flagged membership feature)
 */
export const subscriptionPlans = pgTable(
  'subscription_plans',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    price: integer('price').notNull(), // Minor units
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),
    durationDays: integer('duration_days').notNull(),
    isVisible: boolean('is_visible').notNull().default(true),
    status: subscriptionPlanStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_subscription_plans_tenant_status').on(table.tenantId, table.status),
  ]
);

/**
 * Customer subscriptions table
 */
export const customerSubscriptions = pgTable(
  'customer_subscriptions',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    planId: text('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id),
    status: customerSubscriptionStatusEnum('status').notNull().default('active'),
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_customer_subscriptions_tenant_customer').on(table.tenantId, table.customerId),
  ]
);

// Drizzle Relations
export const pagesRelations = relations(pages, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [pages.tenantId],
    references: [tenants.id],
  }),
  versions: many(pageVersions),
}));

export const pageVersionsRelations = relations(pageVersions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pageVersions.tenantId],
    references: [tenants.id],
  }),
  page: one(pages, {
    fields: [pageVersions.pageId],
    references: [pages.id],
  }),
  publishedByUser: one(users, {
    fields: [pageVersions.publishedBy],
    references: [users.id],
  }),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [assets.tenantId],
    references: [tenants.id],
  }),
  bannerSlides: many(bannerSlides),
}));

export const navigationMenusRelations = relations(navigationMenus, ({ one }) => ({
  tenant: one(tenants, {
    fields: [navigationMenus.tenantId],
    references: [tenants.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [campaigns.tenantId],
    references: [tenants.id],
  }),
  slides: many(bannerSlides),
}));

export const bannerSlidesRelations = relations(bannerSlides, ({ one }) => ({
  tenant: one(tenants, {
    fields: [bannerSlides.tenantId],
    references: [tenants.id],
  }),
  campaign: one(campaigns, {
    fields: [bannerSlides.campaignId],
    references: [campaigns.id],
  }),
  asset: one(assets, {
    fields: [bannerSlides.assetId],
    references: [assets.id],
  }),
}));

export const couponsRelations = relations(coupons, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [coupons.tenantId],
    references: [tenants.id],
  }),
  redemptions: many(couponRedemptions),
}));

export const couponRedemptionsRelations = relations(couponRedemptions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [couponRedemptions.tenantId],
    references: [tenants.id],
  }),
  coupon: one(coupons, {
    fields: [couponRedemptions.couponId],
    references: [coupons.id],
  }),
  order: one(orders, {
    fields: [couponRedemptions.orderId],
    references: [orders.id],
  }),
  customer: one(customers, {
    fields: [couponRedemptions.customerId],
    references: [customers.id],
  }),
}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [subscriptionPlans.tenantId],
    references: [tenants.id],
  }),
  subscriptions: many(customerSubscriptions),
}));

export const customerSubscriptionsRelations = relations(customerSubscriptions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [customerSubscriptions.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [customerSubscriptions.customerId],
    references: [customers.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [customerSubscriptions.planId],
    references: [subscriptionPlans.id],
  }),
}));
