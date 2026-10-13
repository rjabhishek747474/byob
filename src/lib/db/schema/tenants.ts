import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Tenant lifecycle status enum
 */
export const tenantStatusEnum = pgEnum('tenant_status', ['active', 'suspended', 'archived']);

/**
 * Platform/tenant user status enum
 */
export const userStatusEnum = pgEnum('user_status', ['active', 'disabled']);

/**
 * Role-based access control enum across platform and tenants
 */
export const membershipRoleEnum = pgEnum('membership_role', [
  'platform_admin',
  'platform_support',
  'tenant_owner',
  'store_manager',
  'catalog_manager',
  'order_manager',
  'analyst',
]);

/**
 * Membership invitation/activity status enum
 */
export const membershipStatusEnum = pgEnum('membership_status', [
  'active',
  'invited',
  'disabled',
]);

/**
 * Audit log outcome status enum
 */
export const auditOutcomeEnum = pgEnum('audit_outcome', ['success', 'failure', 'denied']);

/**
 * Tenants table representing isolated store instances
 */
export const tenants = pgTable(
  'tenants',
  {
    id: text('id').primaryKey(), // ULID
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    status: tenantStatusEnum('status').notNull().default('active'),
    plan: varchar('plan', { length: 50 }).notNull().default('free'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_tenants_slug').on(table.slug),
  ]
);

/**
 * Global users table capable of authenticating via AWS Cognito or local auth
 */
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(), // ULID
    cognitoSubject: varchar('cognito_subject', { length: 255 }).unique(),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }),
    passwordHash: text('password_hash'),
    status: userStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_users_email').on(table.email),
  ]
);

/**
 * Memberships table linking users to tenants with specific permissions
 */
export const memberships = pgTable(
  'memberships',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    role: membershipRoleEnum('role').notNull(),
    status: membershipStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_memberships_tenant_user_unique').on(table.tenantId, table.userId),
    index('idx_memberships_tenant_user').on(table.tenantId, table.userId),
    index('idx_memberships_user').on(table.userId),
  ]
);

/**
 * Audit logs table recording administrative and critical tenant operations
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(), // ULID
    tenantId: text('tenant_id').references(() => tenants.id), // Nullable for platform-level actions
    actorId: text('actor_id').references(() => users.id),
    action: varchar('action', { length: 100 }).notNull(),
    resourceType: varchar('resource_type', { length: 100 }).notNull(),
    resourceId: text('resource_id'),
    outcome: auditOutcomeEnum('outcome').notNull().default('success'),
    metadata: jsonb('metadata'),
    correlationId: text('correlation_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_audit_logs_tenant_created').on(table.tenantId, table.createdAt),
    index('idx_audit_logs_actor_created').on(table.actorId, table.createdAt),
    index('idx_audit_logs_correlation').on(table.correlationId),
  ]
);

// Drizzle Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  memberships: many(memberships),
  auditLogs: many(auditLogs),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  auditLogs: many(auditLogs),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  tenant: one(tenants, {
    fields: [memberships.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [auditLogs.tenantId],
    references: [tenants.id],
  }),
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}));
