import type { Permission, UserRole } from './types';

/**
 * Complete list of all granular system permissions.
 */
export const ALL_PERMISSIONS: readonly Permission[] = [
  'tenant:create',
  'tenant:read',
  'tenant:update',
  'tenant:suspend',
  'store:settings:read',
  'store:settings:update',
  'theme:read',
  'theme:update',
  'theme:publish',
  'product:create',
  'product:read',
  'product:update',
  'product:delete',
  'product:export',
  'category:create',
  'category:read',
  'category:update',
  'category:delete',
  'order:read',
  'order:update',
  'order:export',
  'customer:read',
  'customer:export',
  'customer:delete',
  'page:create',
  'page:read',
  'page:update',
  'page:delete',
  'page:publish',
  'coupon:create',
  'coupon:read',
  'coupon:update',
  'coupon:delete',
  'campaign:create',
  'campaign:read',
  'campaign:update',
  'campaign:delete',
  'analytics:read',
  'analytics:export',
  'plan:create',
  'plan:read',
  'plan:update',
  'plan:delete',
  'member:invite',
  'member:read',
  'member:update',
  'member:remove',
  'audit:read',
  'asset:upload',
  'asset:delete',
] as const;

/**
 * Mapping from each defined user role to its granted permissions.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // Platform Administrator: Unrestricted access across all tenants and platform controls
  platform_admin: [...ALL_PERMISSIONS],

  // Platform Support: Read-only access across platform operations and stores for triage
  platform_support: [
    'tenant:read',
    'store:settings:read',
    'order:read',
    'customer:read',
    'audit:read',
  ],

  // Tenant Owner: Complete authority over the owned tenant store (cannot create or suspend tenants)
  tenant_owner: [
    'tenant:read',
    'tenant:update',
    'store:settings:read',
    'store:settings:update',
    'theme:read',
    'theme:update',
    'theme:publish',
    'product:create',
    'product:read',
    'product:update',
    'product:delete',
    'product:export',
    'category:create',
    'category:read',
    'category:update',
    'category:delete',
    'order:read',
    'order:update',
    'order:export',
    'customer:read',
    'customer:export',
    'customer:delete',
    'page:create',
    'page:read',
    'page:update',
    'page:delete',
    'page:publish',
    'coupon:create',
    'coupon:read',
    'coupon:update',
    'coupon:delete',
    'campaign:create',
    'campaign:read',
    'campaign:update',
    'campaign:delete',
    'analytics:read',
    'analytics:export',
    'plan:create',
    'plan:read',
    'plan:update',
    'plan:delete',
    'member:invite',
    'member:read',
    'member:update',
    'member:remove',
    'audit:read',
    'asset:upload',
    'asset:delete',
  ],

  // Store Manager: Operational control over catalog, sales, customers, and marketing
  store_manager: [
    'product:create',
    'product:read',
    'product:update',
    'product:delete',
    'product:export',
    'category:create',
    'category:read',
    'category:update',
    'category:delete',
    'order:read',
    'order:update',
    'order:export',
    'customer:read',
    'customer:export',
    'customer:delete',
    'coupon:create',
    'coupon:read',
    'coupon:update',
    'coupon:delete',
    'campaign:create',
    'campaign:read',
    'campaign:update',
    'campaign:delete',
    'analytics:read',
    'page:read',
    'page:update',
    'asset:upload',
  ],

  // Catalog Manager: Dedicated to products, categories, and media assets
  catalog_manager: [
    'product:create',
    'product:read',
    'product:update',
    'product:delete',
    'product:export',
    'category:create',
    'category:read',
    'category:update',
    'category:delete',
    'asset:upload',
  ],

  // Order Manager: Dedicated to fulfillment and order processing
  order_manager: [
    'order:read',
    'order:update',
    'order:export',
    'customer:read',
  ],

  // Analyst: Reporting and analytics without access to PII exports or modification
  analyst: [
    'analytics:read',
    'analytics:export',
    'product:read',
    'order:read',
  ],
};

/**
 * Checks whether a given role holds a specific permission.
 *
 * @param role - The UserRole to evaluate
 * @param permission - The Permission to verify
 * @returns boolean indicating permission grant
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) {
    return false;
  }
  return permissions.includes(permission);
}

/**
 * Retrieves the complete array of permissions granted to a given role.
 *
 * @param role - The UserRole whose permissions to fetch
 * @returns Array of assigned permissions (empty array if role is invalid)
 */
export function getPermissions(role: UserRole): Permission[] {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? [...permissions] : [];
}
