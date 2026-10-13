import { z } from 'zod/v4';

/**
 * Roles assignable to users across the platform and tenant domains.
 */
export type UserRole =
  | 'platform_admin'
  | 'platform_support'
  | 'tenant_owner'
  | 'store_manager'
  | 'catalog_manager'
  | 'order_manager'
  | 'analyst';

/**
 * Granular permissions governing operations across platform and store resources.
 */
export type Permission =
  | 'tenant:create' | 'tenant:read' | 'tenant:update' | 'tenant:suspend'
  | 'store:settings:read' | 'store:settings:update'
  | 'theme:read' | 'theme:update' | 'theme:publish'
  | 'product:create' | 'product:read' | 'product:update' | 'product:delete' | 'product:export'
  | 'category:create' | 'category:read' | 'category:update' | 'category:delete'
  | 'order:read' | 'order:update' | 'order:export'
  | 'customer:read' | 'customer:export' | 'customer:delete'
  | 'page:create' | 'page:read' | 'page:update' | 'page:delete' | 'page:publish'
  | 'coupon:create' | 'coupon:read' | 'coupon:update' | 'coupon:delete'
  | 'campaign:create' | 'campaign:read' | 'campaign:update' | 'campaign:delete'
  | 'analytics:read' | 'analytics:export'
  | 'plan:create' | 'plan:read' | 'plan:update' | 'plan:delete'
  | 'member:invite' | 'member:read' | 'member:update' | 'member:remove'
  | 'audit:read'
  | 'asset:upload' | 'asset:delete';

/**
 * Validated authentication session context.
 */
export interface AuthSession {
  userId: string;
  email: string;
  name?: string;
  role?: UserRole;
  tenantId?: string;
  tenantSlug?: string;
  permissions: Permission[];
}

/**
 * Tenant resolution context populated per request.
 */
export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  tenantStatus: 'active' | 'suspended' | 'archived';
}

/**
 * Schema for decoded JWT auth token payloads.
 */
export const jwtPayloadSchema = z.object({
  sub: z.string().min(1, 'Subject user ID is required'),
  email: z.string().email(),
  name: z.string().optional(),
  role: z
    .enum([
      'platform_admin',
      'platform_support',
      'tenant_owner',
      'store_manager',
      'catalog_manager',
      'order_manager',
      'analyst',
    ])
    .optional(),
  tenantId: z.string().optional(),
  tenantSlug: z.string().optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export type JWTPayload = z.infer<typeof jwtPayloadSchema>;
