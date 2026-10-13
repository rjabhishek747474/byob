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
import { productVariants } from './catalog';
import { tenants, users } from './tenants';

/**
 * Order fulfillment/processing status enum
 */
export const orderStatusEnum = pgEnum('order_status', [
  'pending_confirmation',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'failed',
  'returned',
  'refunded',
]);

/**
 * Order payment mode enum
 */
export const paymentModeEnum = pgEnum('payment_mode', ['cod', 'online', 'free']);

/**
 * Order payment status enum
 */
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'failed',
  'refunded',
]);

/**
 * Store customers table
 */
export const customers = pgTable(
  'customers',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    name: varchar('name', { length: 255 }),
    marketingConsent: boolean('marketing_consent').notNull().default(false),
    consentUpdatedAt: timestamp('consent_updated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_customers_tenant_email').on(table.tenantId, table.email),
    index('idx_customers_tenant_phone').on(table.tenantId, table.phone),
  ]
);

/**
 * Addresses table for saved customer addresses and order shipping snapshots
 */
export const addresses = pgTable('addresses', {
  id: text('id').primaryKey(), // ULID
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id),
  customerId: text('customer_id').references(() => customers.id),
  orderId: text('order_id'), // Filled when snapshotted for an order
  fullName: varchar('fullName', { length: 255 }).notNull(),
  addressLine1: varchar('address_line1', { length: 500 }).notNull(),
  addressLine2: varchar('address_line2', { length: 500 }),
  city: varchar('city', { length: 255 }).notNull(),
  state: varchar('state', { length: 255 }).notNull(),
  postalCode: varchar('postal_code', { length: 20 }).notNull(),
  country: varchar('country', { length: 100 }).notNull().default('India'),
  phone: varchar('phone', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Active shopping carts table
 */
export const carts = pgTable(
  'carts',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    sessionId: text('session_id').notNull(),
    customerId: text('customer_id').references(() => customers.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_carts_tenant_session').on(table.tenantId, table.sessionId),
    index('idx_carts_expires_at').on(table.expiresAt),
  ]
);

/**
 * Cart line items table
 */
export const cartItems = pgTable(
  'cart_items',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    cartId: text('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    variantId: text('variant_id')
      .notNull()
      .references(() => productVariants.id),
    quantity: integer('quantity').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_cart_items_cart_variant_unique').on(table.cartId, table.variantId),
  ]
);

/**
 * Orders table
 */
export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    orderNumber: varchar('order_number', { length: 50 }).notNull(), // e.g. 'ORD-1001'
    publicToken: text('public_token').notNull().unique(), // ULID for public tracking
    customerId: text('customer_id').references(() => customers.id),
    status: orderStatusEnum('status').notNull().default('pending_confirmation'),
    paymentMode: paymentModeEnum('payment_mode').notNull().default('cod'),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
    subtotal: integer('subtotal').notNull(), // Minor units
    discountAmount: integer('discount_amount').notNull().default(0), // Minor units
    deliveryFee: integer('delivery_fee').notNull().default(0), // Minor units
    taxAmount: integer('tax_amount').notNull().default(0), // Minor units
    total: integer('total').notNull(), // Minor units
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),
    couponCode: varchar('coupon_code', { length: 100 }),
    couponId: text('coupon_id'),
    addressSnapshot: jsonb('address_snapshot'), // Full address snapshot at checkout
    idempotencyKey: varchar('idempotency_key', { length: 255 }).unique(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_orders_tenant_order_number_unique').on(table.tenantId, table.orderNumber),
    index('idx_orders_tenant_status_created').on(table.tenantId, table.status, table.createdAt),
    index('idx_orders_tenant_customer').on(table.tenantId, table.customerId),
    index('idx_orders_public_token').on(table.publicToken),
  ]
);

/**
 * Order line items table (immutable snapshot of purchased products and prices)
 */
export const orderItems = pgTable('order_items', {
  id: text('id').primaryKey(), // ULID
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id),
  productId: text('product_id').notNull(), // Snapshot, not FK
  variantId: text('variant_id').notNull(), // Snapshot, not FK
  productTitle: varchar('product_title', { length: 500 }).notNull(), // Snapshot
  variantName: varchar('variant_name', { length: 255 }), // Snapshot
  sku: varchar('sku', { length: 100 }).notNull(), // Snapshot
  unitPrice: integer('unit_price').notNull(), // Minor units snapshot
  quantity: integer('quantity').notNull(),
  lineTotal: integer('line_total').notNull(), // Minor units snapshot (unitPrice * quantity)
  imageUrl: text('image_url'), // Snapshot
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Order status transition history table for audit trails
 */
export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    oldStatus: varchar('old_status', { length: 50 }),
    newStatus: varchar('new_status', { length: 50 }).notNull(),
    reason: text('reason'),
    actorId: text('actor_id').references(() => users.id), // Nullable for automated system updates
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_order_status_history_tenant_order_created').on(
      table.tenantId,
      table.orderId,
      table.createdAt
    ),
  ]
);

// Drizzle Relations
export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
  addresses: many(addresses),
  orders: many(orders),
  carts: many(carts),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  tenant: one(tenants, {
    fields: [addresses.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [addresses.customerId],
    references: [customers.id],
  }),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [carts.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [carts.customerId],
    references: [customers.id],
  }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [cartItems.tenantId],
    references: [tenants.id],
  }),
  cart: one(carts, {
    fields: [cartItems.cartId],
    references: [carts.id],
  }),
  variant: one(productVariants, {
    fields: [cartItems.variantId],
    references: [productVariants.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [orders.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
  statusHistory: many(orderStatusHistory),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [orderItems.tenantId],
    references: [tenants.id],
  }),
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  tenant: one(tenants, {
    fields: [orderStatusHistory.tenantId],
    references: [tenants.id],
  }),
  order: one(orders, {
    fields: [orderStatusHistory.orderId],
    references: [orders.id],
  }),
  actor: one(users, {
    fields: [orderStatusHistory.actorId],
    references: [users.id],
  }),
}));
