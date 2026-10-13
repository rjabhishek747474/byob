import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  getPermissions,
  hasPermission,
} from '@/lib/auth/permissions';
import {
  createSession,
  invalidateSession,
  verifySession,
} from '@/lib/auth/session';
import {
  getAuthSession,
  requireAuth,
  requirePermission,
  requireTenantAccess,
} from '@/lib/auth/context';
import {
  RateLimiter,
  apiLimiter,
  authLimiter,
  checkoutLimiter,
} from '@/lib/middleware/rate-limit';
import {
  CORRELATION_ID_HEADER,
  getCorrelationId,
  getCurrentCorrelationId,
  withCorrelation,
} from '@/lib/middleware/correlation';
import { extractTenantSlug } from '@/lib/middleware/tenant';
import { middleware } from '@/middleware';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';

// Mock cookies for auth context tests
const mockCookieMap = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (key: string) => {
      const val = mockCookieMap.get(key);
      return val ? { name: key, value: val } : undefined;
    },
    set: (key: string, value: string) => {
      mockCookieMap.set(key, value);
    },
  })),
}));

describe('Auth, Permissions & Middleware Tests', () => {
  describe('File 1 & 2: Permissions and Roles', () => {
    it('platform_admin has all permissions', () => {
      expect(ROLE_PERMISSIONS.platform_admin).toHaveLength(ALL_PERMISSIONS.length);
      for (const perm of ALL_PERMISSIONS) {
        expect(hasPermission('platform_admin', perm)).toBe(true);
      }
    });

    it('platform_support has read-only platform permissions', () => {
      expect(hasPermission('platform_support', 'tenant:read')).toBe(true);
      expect(hasPermission('platform_support', 'store:settings:read')).toBe(true);
      expect(hasPermission('platform_support', 'order:read')).toBe(true);
      expect(hasPermission('platform_support', 'customer:read')).toBe(true);
      expect(hasPermission('platform_support', 'audit:read')).toBe(true);

      // Denies write permissions
      expect(hasPermission('platform_support', 'tenant:create')).toBe(false);
      expect(hasPermission('platform_support', 'product:create')).toBe(false);
    });

    it('tenant_owner has all tenant permissions but not tenant create/suspend', () => {
      expect(hasPermission('tenant_owner', 'tenant:create')).toBe(false);
      expect(hasPermission('tenant_owner', 'tenant:suspend')).toBe(false);
      expect(hasPermission('tenant_owner', 'tenant:read')).toBe(true);
      expect(hasPermission('tenant_owner', 'tenant:update')).toBe(true);
      expect(hasPermission('tenant_owner', 'product:create')).toBe(true);
      expect(hasPermission('tenant_owner', 'member:invite')).toBe(true);
    });

    it('order_manager can read/update orders and read customers', () => {
      expect(hasPermission('order_manager', 'order:read')).toBe(true);
      expect(hasPermission('order_manager', 'order:update')).toBe(true);
      expect(hasPermission('order_manager', 'customer:read')).toBe(true);
      expect(hasPermission('order_manager', 'product:create')).toBe(false);
    });

    it('analyst can read analytics and products but cannot export customer PII', () => {
      expect(hasPermission('analyst', 'analytics:read')).toBe(true);
      expect(hasPermission('analyst', 'analytics:export')).toBe(true);
      expect(hasPermission('analyst', 'product:read')).toBe(true);
      expect(hasPermission('analyst', 'customer:export')).toBe(false);
      expect(hasPermission('analyst', 'customer:delete')).toBe(false);
    });

    it('getPermissions returns copy of permissions array', () => {
      const perms = getPermissions('catalog_manager');
      expect(perms).toContain('product:create');
      expect(perms).toContain('category:create');
      expect(perms).not.toContain('order:read');
    });
  });

  describe('File 3: Session Management (JWT)', () => {
    it('creates, verifies, and invalidates session token', async () => {
      const token = await createSession({
        id: 'usr_01JABCDEF1234567890',
        email: 'owner@store.com',
        name: 'Jane Doe',
        role: 'tenant_owner',
        tenantId: 'ten_01JABCDEF1234567890',
        tenantSlug: 'acme-store',
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const session = await verifySession(token);
      expect(session).not.toBeNull();
      expect(session?.userId).toBe('usr_01JABCDEF1234567890');
      expect(session?.email).toBe('owner@store.com');
      expect(session?.name).toBe('Jane Doe');
      expect(session?.role).toBe('tenant_owner');
      expect(session?.tenantId).toBe('ten_01JABCDEF1234567890');
      expect(session?.tenantSlug).toBe('acme-store');
      expect(session?.permissions).toContain('product:create');

      // Invalidate session
      invalidateSession(token);

      const revokedSession = await verifySession(token);
      expect(revokedSession).toBeNull();
    });

    it('returns null for malformed tokens', async () => {
      expect(await verifySession('not-a-valid-token')).toBeNull();
      expect(await verifySession('')).toBeNull();
    });
  });

  describe('File 4: Auth Context', () => {
    it('getAuthSession and requireAuth read session from cookies', async () => {
      mockCookieMap.clear();

      // No session
      expect(await getAuthSession()).toBeNull();
      await expect(requireAuth()).rejects.toThrow(UnauthorizedError);

      // Create session and set cookie
      const token = await createSession({
        id: 'usr_1',
        email: 'admin@platform.com',
        role: 'platform_admin',
      });
      mockCookieMap.set('byob_session', token);

      const session = await requireAuth();
      expect(session.userId).toBe('usr_1');
      expect(session.role).toBe('platform_admin');
    });

    it('requirePermission enforces role-based permission checks', async () => {
      mockCookieMap.clear();
      const token = await createSession({
        id: 'usr_mgr',
        email: 'manager@shop.com',
        role: 'catalog_manager',
      });
      mockCookieMap.set('byob_session', token);

      // Allowed
      const session = await requirePermission('product:create');
      expect(session.userId).toBe('usr_mgr');

      // Denied
      await expect(requirePermission('order:update')).rejects.toThrow(ForbiddenError);
    });

    it('requireTenantAccess validates tenant matching', async () => {
      mockCookieMap.clear();
      const token = await createSession({
        id: 'usr_owner',
        email: 'owner@acme.com',
        role: 'tenant_owner',
        tenantId: 'ten_acme_1',
      });
      mockCookieMap.set('byob_session', token);

      // Same tenant: allowed
      await expect(requireTenantAccess('ten_acme_1')).resolves.toBeDefined();

      // Different tenant: forbidden
      await expect(requireTenantAccess('ten_other_2')).rejects.toThrow(ForbiddenError);
    });

    it('requireTenantAccess permits platform_admin to access any tenant', async () => {
      mockCookieMap.clear();
      const token = await createSession({
        id: 'usr_admin',
        email: 'super@platform.com',
        role: 'platform_admin',
      });
      mockCookieMap.set('byob_session', token);

      await expect(requireTenantAccess('any_tenant_id')).resolves.toBeDefined();
    });
  });

  describe('File 6: Rate Limiting', () => {
    it('allows requests within window and limits requests beyond threshold', () => {
      const limiter = new RateLimiter({ windowMs: 1000, maxRequests: 2 });
      const key = 'test-ip-1';

      const res1 = limiter.checkLimit(key);
      expect(res1.allowed).toBe(true);
      expect(res1.remaining).toBe(1);

      const res2 = limiter.checkLimit(key);
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(0);

      const res3 = limiter.checkLimit(key);
      expect(res3.allowed).toBe(false);
      expect(res3.remaining).toBe(0);

      // Other key still has quota
      expect(limiter.checkLimit('test-ip-2').allowed).toBe(true);
    });

    it('predefined limiters are instantiated with required specifications', () => {
      expect(authLimiter).toBeDefined();
      expect(apiLimiter).toBeDefined();
      expect(checkoutLimiter).toBeDefined();
    });
  });

  describe('File 7: Correlation Tracking', () => {
    it('retrieves header correlation id or creates new ULID', () => {
      const reqWithHeader = new Request('http://localhost:3000', {
        headers: { 'x-correlation-id': 'custom-cid-123' },
      });
      expect(getCorrelationId(reqWithHeader)).toBe('custom-cid-123');

      const reqWithoutHeader = new Request('http://localhost:3000');
      const generated = getCorrelationId(reqWithoutHeader);
      expect(generated).toHaveLength(26);
    });

    it('propagates correlation ID within AsyncLocalStorage scope', async () => {
      expect(getCurrentCorrelationId()).toBeUndefined();

      await withCorrelation('active-correlation-789', async () => {
        expect(getCurrentCorrelationId()).toBe('active-correlation-789');
      });

      expect(getCurrentCorrelationId()).toBeUndefined();
    });
  });

  describe('File 5: Tenant Resolution Slug Extraction', () => {
    it('extracts slug from host subdomain', () => {
      const req = new NextRequest('http://acme-store.localhost:3000/products', {
        headers: { host: 'acme-store.localhost:3000' },
      });
      expect(extractTenantSlug(req)).toBe('acme-store');
    });

    it('ignores reserved subdomains', () => {
      const req = new NextRequest('http://admin.localhost:3000/dashboard', {
        headers: { host: 'admin.localhost:3000' },
      });
      expect(extractTenantSlug(req)).toBeNull();
    });

    it('extracts slug from x-tenant-slug header in development', () => {
      const req = new NextRequest('http://localhost:3000/products', {
        headers: { 'x-tenant-slug': 'my-cool-shop' },
      });
      expect(extractTenantSlug(req)).toBe('my-cool-shop');
    });

    it('extracts slug from /s/<slug>/ path prefix', () => {
      const req = new NextRequest('http://localhost:3000/s/gadget-hub/categories');
      expect(extractTenantSlug(req)).toBe('gadget-hub');
    });
  });

  describe('File 8: Edge Middleware', () => {
    it('adds correlation ID and security headers', async () => {
      const req = new NextRequest('http://localhost:3000/');
      const res = await middleware(req);

      expect(res.headers.get(CORRELATION_ID_HEADER)).toBeDefined();
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('redirects unauthenticated admin UI routes to /login', async () => {
      const req = new NextRequest('http://localhost:3000/admin/settings');
      const res = await middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login?redirect=%2Fadmin%2Fsettings');
    });

    it('returns 401 for unauthenticated admin API routes', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/admin/stores');
      const res = await middleware(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('sets x-tenant-slug header when resolved', async () => {
      const req = new NextRequest('http://my-store.localhost:3000/products', {
        headers: { host: 'my-store.localhost:3000' },
      });
      const res = await middleware(req);

      expect(res.headers.get('x-tenant-slug')).toBe('my-store');
    });
  });
});
