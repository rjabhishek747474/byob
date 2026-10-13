import { cookies } from 'next/headers';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { hasPermission } from './permissions';
import { verifySession } from './session';
import type { AuthSession, Permission } from './types';

/**
 * Cookie key used for persisting authenticated session tokens.
 */
export const SESSION_COOKIE_NAME = 'byob_session';

/**
 * Retrieves and validates the current authenticated session from the request cookies.
 *
 * @returns Decoded AuthSession or null if unauthenticated
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await verifySession(token);
  if (!session) {
    return null;
  }

  // TODO: Full membership and tenant role lookup from the database (`memberships` table).
  // Once the active tenant context is determined, query the user's role and status within that tenant
  // to dynamically augment permissions and enforce disabled/invited membership statuses.

  return session;
}

/**
 * Requires an active authenticated session.
 * Throws UnauthorizedError if no valid session cookie is present.
 *
 * @returns Resolves to active AuthSession
 * @throws {UnauthorizedError} If unauthenticated
 */
export async function requireAuth(): Promise<AuthSession> {
  const session = await getAuthSession();
  if (!session) {
    throw new UnauthorizedError('Authentication required to access this resource');
  }
  return session;
}

/**
 * Requires an authenticated user possessing the specified permission.
 * Throws UnauthorizedError if unauthenticated, or ForbiddenError if permission is missing.
 *
 * @param permission - The specific Permission required
 * @returns Resolves to active AuthSession
 * @throws {UnauthorizedError} If unauthenticated
 * @throws {ForbiddenError} If permission is not granted
 */
export async function requirePermission(permission: Permission): Promise<AuthSession> {
  const session = await requireAuth();

  const hasDirectPermission = session.permissions.includes(permission);
  const hasRolePermission = session.role ? hasPermission(session.role, permission) : false;

  if (!hasDirectPermission && !hasRolePermission) {
    throw new ForbiddenError(`User lacks required permission: ${permission}`);
  }

  return session;
}

/**
 * Validates that the authenticated user has legitimate access to the specified tenant.
 * Platform administrators and support personnel have elevated multi-tenant access.
 *
 * @param tenantId - The target tenant identifier
 * @returns Resolves to active AuthSession
 * @throws {UnauthorizedError} If unauthenticated
 * @throws {ForbiddenError} If access to the tenant is denied
 */
export async function requireTenantAccess(tenantId: string): Promise<AuthSession> {
  if (!tenantId) {
    throw new ForbiddenError('Tenant ID must be specified for access validation');
  }

  const session = await requireAuth();

  // Platform admin and support roles have multi-tenant oversight
  if (session.role === 'platform_admin' || session.role === 'platform_support') {
    return session;
  }

  // Match tenant assigned to current session
  if (session.tenantId && session.tenantId === tenantId) {
    return session;
  }

  // TODO: Query `memberships` table in database to verify user's membership for target tenantId
  // when the user belongs to multiple tenants and switched context.

  throw new ForbiddenError('Access to this tenant store is forbidden');
}
