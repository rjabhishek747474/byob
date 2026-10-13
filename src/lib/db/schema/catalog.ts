import { relations } from 'drizzle-orm';
import {
  AnyPgColumn,
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
import { tenants, users } from './tenants';

/**
 * Category status enum
 */
export const categoryStatusEnum = pgEnum('category_status', ['active', 'inactive']);

/**
 * Product lifecycle status enum
 */
export const productStatusEnum = pgEnum('product_status', ['active', 'draft', 'archived']);

/**
 * Categories table supporting hierarchical nesting
 */
export const categories = pgTable(
  'categories',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    parentId: text('parent_id').references((): AnyPgColumn => categories.id),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),
    imageAssetId: text('image_asset_id'),
    iconName: varchar('icon_name', { length: 100 }),
    sortOrder: integer('sort_order').notNull().default(0),
    status: categoryStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_categories_tenant_slug_unique').on(table.tenantId, table.slug),
    index('idx_categories_tenant_parent').on(table.tenantId, table.parentId),
  ]
);

/**
 * Products table storing catalog items
 */
export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    title: varchar('title', { length: 500 }).notNull(),
    slug: varchar('slug', { length: 500 }).notNull(),
    description: text('description'),
    categoryId: text('category_id').references(() => categories.id),
    status: productStatusEnum('status').notNull().default('draft'),
    listPrice: integer('list_price').notNull(), // Minor units (e.g. 1000 = 10.00)
    salePrice: integer('sale_price'), // Minor units
    isFeatured: boolean('is_featured').notNull().default(false),
    isTrending: boolean('is_trending').notNull().default(false),
    deliveryFeeOverride: integer('delivery_fee_override'), // Minor units
    seoTitle: varchar('seo_title', { length: 255 }),
    seoDescription: text('seo_description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_products_tenant_slug_unique').on(table.tenantId, table.slug),
    index('idx_products_tenant_category').on(table.tenantId, table.categoryId),
    index('idx_products_tenant_status').on(table.tenantId, table.status),
    index('idx_products_tenant_featured').on(table.tenantId, table.isFeatured),
  ]
);

/**
 * Product variants table (SKU-level inventory and price overrides)
 */
export const productVariants = pgTable(
  'product_variants',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    sku: varchar('sku', { length: 100 }).notNull(),
    name: varchar('name', { length: 255 }), // e.g. 'Large / Red'
    optionValues: jsonb('option_values'), // e.g. { size: 'L', color: 'Red' }
    priceOverride: integer('price_override'), // Minor units
    stockQuantity: integer('stock_quantity').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_product_variants_tenant_sku_unique').on(table.tenantId, table.sku),
    index('idx_product_variants_tenant_product').on(table.tenantId, table.productId),
  ]
);

/**
 * Product gallery images table
 */
export const productImages = pgTable(
  'product_images',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    assetId: text('asset_id').notNull(),
    altText: varchar('alt_text', { length: 500 }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_product_images_tenant_product').on(table.tenantId, table.productId),
  ]
);

/**
 * Inventory movements tracking stock adjustments and reservations
 */
export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    variantId: text('variant_id')
      .notNull()
      .references(() => productVariants.id),
    delta: integer('delta').notNull(), // Positive for add, negative for deduct
    reason: varchar('reason', { length: 100 }).notNull(), // 'manual_adjustment', 'order_placed', 'order_cancelled'
    referenceId: text('reference_id'), // Order ID or batch ID
    actorId: text('actor_id').references(() => users.id), // Nullable for system operations
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_inventory_movements_tenant_variant_created').on(
      table.tenantId,
      table.variantId,
      table.createdAt
    ),
  ]
);

// Drizzle Relations
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [categories.tenantId],
    references: [tenants.id],
  }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'category_hierarchy',
  }),
  subcategories: many(categories, {
    relationName: 'category_hierarchy',
  }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [products.tenantId],
    references: [tenants.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(productVariants),
  images: many(productImages),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [productVariants.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  inventoryMovements: many(inventoryMovements),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [productImages.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  tenant: one(tenants, {
    fields: [inventoryMovements.tenantId],
    references: [tenants.id],
  }),
  variant: one(productVariants, {
    fields: [inventoryMovements.variantId],
    references: [productVariants.id],
  }),
  actor: one(users, {
    fields: [inventoryMovements.actorId],
    references: [users.id],
  }),
}));
