import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

/**
 * Analytics events table tracking tenant-isolated telemetry and behavioral events
 */
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    eventId: text('event_id').notNull().unique(), // Client-generated UUID for dedup
    eventName: varchar('event_name', { length: 100 }).notNull(),
    schemaVersion: integer('schema_version').notNull().default(1),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    sessionId: text('session_id').notNull(),
    visitorId: text('visitor_id').notNull(),
    path: varchar('path', { length: 2000 }),
    referrerCategory: varchar('referrer_category', { length: 50 }),
    consentCategories: jsonb('consent_categories').$type<string[]>(),
    properties: jsonb('properties').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_analytics_events_tenant_event_occurred').on(
      table.tenantId,
      table.eventName,
      table.occurredAt
    ),
    index('idx_analytics_events_tenant_session').on(table.tenantId, table.sessionId),
    index('idx_analytics_events_tenant_occurred').on(table.tenantId, table.occurredAt),
  ]
);

/**
 * Consent records table logging cookie and tracking consent status per visitor/customer
 */
export const consentRecords = pgTable(
  'consent_records',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    visitorId: text('visitor_id'),
    customerId: text('customer_id'),
    policyVersion: varchar('policy_version', { length: 50 }).notNull(),
    categoriesGranted: jsonb('categories_granted').$type<string[]>().notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_consent_records_tenant_visitor').on(table.tenantId, table.visitorId),
  ]
);

// Drizzle Relations
export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [analyticsEvents.tenantId],
    references: [tenants.id],
  }),
}));

export const consentRecordsRelations = relations(consentRecords, ({ one }) => ({
  tenant: one(tenants, {
    fields: [consentRecords.tenantId],
    references: [tenants.id],
  }),
}));
