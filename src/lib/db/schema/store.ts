import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenants, users } from './tenants';

/**
 * Store settings table storing tenant customization and configuration
 */
export const storeSettings = pgTable('store_settings', {
  id: text('id').primaryKey(), // ULID
  tenantId: text('tenant_id')
    .notNull()
    .unique()
    .references(() => tenants.id),
  storeName: varchar('store_name', { length: 255 }).notNull(),
  timezone: varchar('timezone', { length: 50 }).notNull().default('Asia/Kolkata'),
  locale: varchar('locale', { length: 10 }).notNull().default('en-IN'),
  currency: varchar('currency', { length: 3 }).notNull().default('INR'),
  logoAssetId: text('logo_asset_id'),
  faviconAssetId: text('favicon_asset_id'),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  address: text('address'),
  socialFacebook: varchar('social_facebook', { length: 500 }),
  socialInstagram: varchar('social_instagram', { length: 500 }),
  socialTwitter: varchar('social_twitter', { length: 500 }),
  socialYoutube: varchar('social_youtube', { length: 500 }),
  socialWhatsapp: varchar('social_whatsapp', { length: 500 }),
  announcementText: text('announcement_text'),
  announcementActive: boolean('announcement_active').notNull().default(false),
  deliveryFeeDefault: integer('delivery_fee_default').notNull().default(0), // Minor units
  freeDeliveryThreshold: integer('free_delivery_threshold'), // Minor units
  analyticsEnabled: boolean('analytics_enabled').notNull().default(true),
  consentRequired: boolean('consent_required').notNull().default(true),
  metaTitle: varchar('meta_title', { length: 255 }),
  metaDescription: text('meta_description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Themes table storing draft and published styling tokens
 */
export const themes = pgTable(
  'themes',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: varchar('name', { length: 100 }).notNull().default('default'),
    draftConfig: jsonb('draft_config').notNull(), // Color tokens, typography, spacing, layout
    publishedConfig: jsonb('published_config'), // Nullable until published
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: text('published_by').references(() => users.id),
    version: integer('version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_themes_tenant_id').on(table.tenantId),
  ]
);

// Drizzle Relations
export const storeSettingsRelations = relations(storeSettings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [storeSettings.tenantId],
    references: [tenants.id],
  }),
}));

export const themesRelations = relations(themes, ({ one }) => ({
  tenant: one(tenants, {
    fields: [themes.tenantId],
    references: [tenants.id],
  }),
  publishedByUser: one(users, {
    fields: [themes.publishedBy],
    references: [users.id],
  }),
}));
