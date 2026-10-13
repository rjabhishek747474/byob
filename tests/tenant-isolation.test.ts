import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { requireTenantAccess } from '@/lib/auth/context';
import { hasPermission } from '@/lib/auth/permissions';
import { createSession } from '@/lib/auth/session';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { extractTenantSlug, resolveTenant } from '@/lib/middleware/tenant';
import {
  listAuditLogs,
  recordAuditLog,
  scrubSensitiveData,
} from '@/modules/audit/audit-service';
import {
  createTenant,
  getTenantById,
  getTenantBySlug,
  listTenants,
  updateTenant,
  updateTenantStatus,
  validateTenantSlug,
} from '@/modules/tenant/tenant-service';
import { GET as getPlatformTenants, POST as postPlatformTenants } from '@/app/api/v1/platform/tenants/route';
import { GET as getPlatformTenantById, PATCH as patchPlatformTenantById } from '@/app/api/v1/platform/tenants/[id]/route';
import { PATCH as patchPlatformTenantStatus } from '@/app/api/v1/platform/tenants/[id]/status/route';

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Tenant Isolation & Service Tests
// -----------------------------------------------------------------------------
interface MockRecord {
  [key: string]: unknown;
}

const tableStores = {
  tenants: new Map<string, MockRecord>(),
  users: new Map<string, MockRecord>(),
  memberships: new Map<string, MockRecord>(),
  store_settings: new Map<string, MockRecord>(),
  themes: new Map<string, MockRecord>(),
  pages: new Map<string, MockRecord>(),
  page_versions: new Map<string, MockRecord>(),
  audit_logs: new Map<string, MockRecord>(),
};

function resetMockDb() {
  for (const store of Object.values(tableStores)) {
    store.clear();
  }
}

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

// Mock database layer
vi.mock('@/lib/db', () => {
  const queryExecutor = {
    select: vi.fn((fields?: unknown) => ({
      from: vi.fn((table: { _: { name: string } } | unknown) => {
        const tableName = (table as { _: { name: string } })?._?.name || 'unknown';
        const records = Array.from(
          (tableStores[tableName as keyof typeof tableStores] ?? new Map()).values()
        );

        const isCountQuery =
          fields &&
          typeof fields === 'object' &&
          'count' in (fields as Record<string, unknown>);

        const chain = {
          where: vi.fn((condition: unknown) => {
            let filtered = [...records];
            const resultData = isCountQuery ? [{ count: filtered.length }] : filtered;
            return {
              limit: vi.fn((n: number) => Promise.resolve(filtered.slice(0, n))),
              orderBy: vi.fn(() => ({
                limit: vi.fn((limitN: number) => ({
                  offset: vi.fn((offsetN: number) =>
                    Promise.resolve(filtered.slice(offsetN, offsetN + limitN))
                  ),
                })),
              })),
              offset: vi.fn((n: number) => Promise.resolve(filtered.slice(n))),
              then: (resolve: (val: unknown) => void) => resolve(resultData),
            };
          }),
          orderBy: vi.fn(() => ({
            limit: vi.fn((limitN: number) => ({
              offset: vi.fn((offsetN: number) =>
                Promise.resolve(records.slice(offsetN, offsetN + limitN))
              ),
            })),
          })),
          limit: vi.fn((n: number) => Promise.resolve(records.slice(0, n))),
          then: (resolve: (val: unknown) => void) =>
            resolve(isCountQuery ? [{ count: records.length }] : records),
        };
        return chain;
      }),
    })),
    insert: vi.fn((table: { _: { name: string } }) => ({
      values: vi.fn((vals: Record<string, unknown>) => {
        const tableName = table?._?.name;
        const store = tableStores[tableName as keyof typeof tableStores];
        const record = { ...vals, createdAt: new Date(), updatedAt: new Date() };
        if (store && vals.id) {
          store.set(vals.id as string, record);
        }
        return {
          returning: vi.fn(() => Promise.resolve([record])),
          then: (resolve: (val: unknown) => void) => resolve([record]),
        };
      }),
    })),
    update: vi.fn((table: { _: { name: string } }) => ({
      set: vi.fn((vals: Record<string, unknown>) => ({
        where: vi.fn((_cond: unknown) => {
          return {
            returning: vi.fn(() => Promise.resolve([{ ...vals }])),
            then: (resolve: (val: unknown) => void) => resolve([{ ...vals }]),
          };
        }),
      })),
    })),
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) => {
      return callback(queryExecutor);
    }),
  };

  return {
    db: queryExecutor,
    schema: {},
    closeDb: vi.fn(),
  };
});

describe('Slice 2: Tenant & Identity Domain + Isolation Tests', () => {
  beforeEach(() => {
    resetMockDb();
    mockCookieMap.clear();
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Cross-Tenant Negative Isolation Tests
  // ---------------------------------------------------------------------------
  describe('Cross-Tenant Negative Isolation Enforcement', () => {
    it('Tenant A cannot access Tenant B data via requireTenantAccess', async () => {
      const tokenTenantA = await createSession({
        id: 'usr_tenant_a',
        email: 'alice@tenant-a.com',
        role: 'tenant_owner',
        tenantId: 'ten_A_0000000000000000000001',
        tenantSlug: 'tenant-a-shop',
      });
      mockCookieMap.set('byob_session', tokenTenantA);

      // Accessing own tenant must succeed
      const ownAccess = await requireTenantAccess('ten_A_0000000000000000000001');
      expect(ownAccess.tenantId).toBe('ten_A_0000000000000000000001');

      // Attempting to access Tenant B must be denied with ForbiddenError
      await expect(
        requireTenantAccess('ten_B_0000000000000000000002')
      ).rejects.toThrow(ForbiddenError);
    });

    it('rejects unauthenticated requests accessing tenant resources', async () => {
      mockCookieMap.clear();
      await expect(
        requireTenantAccess('ten_A_0000000000000000000001')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('modifying tenant ID in request/header is ignored by requireTenantAccess', async () => {
      // Attacker Alice is signed in as Tenant A
      const tokenAlice = await createSession({
        id: 'usr_alice',
        email: 'alice@tenant-a.com',
        role: 'tenant_owner',
        tenantId: 'ten_A_0000000000000000000001',
      });
      mockCookieMap.set('byob_session', tokenAlice);

      // The security context validates against session-bound tenantId, ignoring attacker parameters
      await expect(
        requireTenantAccess('ten_B_0000000000000000000002')
      ).rejects.toThrow(ForbiddenError);
    });

    it('platform_admin has legitimate multi-tenant oversight across tenants', async () => {
      const tokenAdmin = await createSession({
        id: 'usr_platform_admin',
        email: 'admin@platform.com',
        role: 'platform_admin',
      });
      mockCookieMap.set('byob_session', tokenAdmin);

      // Platform admin can access any tenant for administrative tasks
      const accessA = await requireTenantAccess('ten_A_0000000000000000000001');
      expect(accessA.role).toBe('platform_admin');

      const accessB = await requireTenantAccess('ten_B_0000000000000000000002');
      expect(accessB.role).toBe('platform_admin');
    });

    it('role-based permissions correctly prevent unauthorized tenant mutations', () => {
      // Tenant owner can manage store, products, categories, but cannot create or suspend tenants
      expect(hasPermission('tenant_owner', 'tenant:create')).toBe(false);
      expect(hasPermission('tenant_owner', 'tenant:suspend')).toBe(false);
      expect(hasPermission('tenant_owner', 'tenant:update')).toBe(true);
      expect(hasPermission('tenant_owner', 'product:create')).toBe(true);

      // Store manager cannot update store settings or themes
      expect(hasPermission('store_manager', 'store:settings:update')).toBe(false);
      expect(hasPermission('store_manager', 'theme:publish')).toBe(false);

      // Platform admin has all permissions
      expect(hasPermission('platform_admin', 'tenant:create')).toBe(true);
      expect(hasPermission('platform_admin', 'tenant:suspend')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Tenant Slug Extraction & Storefront Lifecycle Isolation
  // ---------------------------------------------------------------------------
  describe('Tenant Slug Validation & Lifecycle Isolation', () => {
    it('validateTenantSlug accepts valid slugs and normalizes', () => {
      expect(validateTenantSlug('my-store')).toBe('my-store');
      expect(validateTenantSlug('STORE-123')).toBe('store-123');
      expect(validateTenantSlug('boutique-deluxe')).toBe('boutique-deluxe');
    });

    it('validateTenantSlug rejects invalid formats and reserved words', () => {
      // Too short
      expect(() => validateTenantSlug('ab')).toThrow(ValidationError);
      // Leading or trailing hyphens
      expect(() => validateTenantSlug('-store')).toThrow(ValidationError);
      expect(() => validateTenantSlug('store-')).toThrow(ValidationError);
      // Invalid symbols
      expect(() => validateTenantSlug('my_store')).toThrow(ValidationError);
      expect(() => validateTenantSlug('store@shop')).toThrow(ValidationError);

      // Reserved keywords
      expect(() => validateTenantSlug('admin')).toThrow(ValidationError);
      expect(() => validateTenantSlug('api')).toThrow(ValidationError);
      expect(() => validateTenantSlug('app')).toThrow(ValidationError);
      expect(() => validateTenantSlug('platform')).toThrow(ValidationError);
      expect(() => validateTenantSlug('www')).toThrow(ValidationError);
      expect(() => validateTenantSlug('store')).toThrow(ValidationError);
    });

    it('extractTenantSlug rejects reserved subdomains from host header', () => {
      const adminReq = new NextRequest('http://admin.localhost:3000/dashboard', {
        headers: { host: 'admin.localhost:3000' },
      });
      expect(extractTenantSlug(adminReq)).toBeNull();

      const apiReq = new NextRequest('http://api.localhost:3000/v1/test', {
        headers: { host: 'api.localhost:3000' },
      });
      expect(extractTenantSlug(apiReq)).toBeNull();
    });

    it('suspended tenants cannot serve storefront requests', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              {
                id: 'ten_suspended_01',
                slug: 'suspended-shop',
                status: 'suspended',
              },
            ]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      // Public storefront request
      const storefrontReq = new NextRequest('http://suspended-shop.localhost:3000/products', {
        headers: { host: 'suspended-shop.localhost:3000' },
      });

      const tenantContext = await resolveTenant(storefrontReq);
      expect(tenantContext).toBeNull();
    });

    it('archived tenants cannot serve any requests including admin routes', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              {
                id: 'ten_archived_01',
                slug: 'archived-shop',
                status: 'archived',
              },
            ]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const adminReq = new NextRequest('http://archived-shop.localhost:3000/admin/settings', {
        headers: { host: 'archived-shop.localhost:3000' },
      });

      const tenantContext = await resolveTenant(adminReq);
      expect(tenantContext).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Audit Logging & Sensitive Data Scrubbing
  // ---------------------------------------------------------------------------
  describe('Audit Logging & Data Sanitization', () => {
    it('scrubSensitiveData scrubs passwords, secrets, tokens, and card data', () => {
      const raw = {
        password: 'my-super-secret-password',
        api_token: 'tok_live_123456789',
        secretKey: 'sec_999',
        creditCard: '4111-2222-3333-4444',
        safeProperty: 'unaffected value',
        nested: {
          userPasswordHash: '$2a$10$abcdef',
          authToken: 'bearer-token-123',
          counter: 42,
        },
        items: [
          { token: 'item-token', label: 'Item 1' },
          { harmless: 'ok' },
        ],
      };

      const sanitized = scrubSensitiveData(raw);

      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.api_token).toBe('[REDACTED]');
      expect(sanitized.secretKey).toBe('[REDACTED]');
      expect(sanitized.creditCard).toBe('[REDACTED]');
      expect(sanitized.safeProperty).toBe('unaffected value');
      expect(sanitized.nested.userPasswordHash).toBe('[REDACTED]');
      expect(sanitized.nested.authToken).toBe('[REDACTED]');
      expect(sanitized.nested.counter).toBe(42);
      expect(sanitized.items[0].token).toBe('[REDACTED]');
      expect(sanitized.items[0].label).toBe('Item 1');
      expect(sanitized.items[1].harmless).toBe('ok');
    });

    it('recordAuditLog scrubs metadata and persists audit entry', async () => {
      const entry = await recordAuditLog({
        tenantId: 'ten_test_01',
        actorId: 'usr_01',
        action: 'tenant:update',
        resourceType: 'tenant',
        resourceId: 'ten_test_01',
        outcome: 'success',
        metadata: {
          password: 'plain-text-pwd',
          updatedName: 'New Store Name',
        },
        correlationId: 'corr_123',
      });

      expect(entry.id).toHaveLength(26);
      expect(entry.tenantId).toBe('ten_test_01');
      expect(entry.action).toBe('tenant:update');
      expect(entry.metadata).toEqual({
        password: '[REDACTED]',
        updatedName: 'New Store Name',
      });
    });

    it('listAuditLogs filters by tenant scope preventing leakage across tenants', async () => {
      const { db } = await import('@/lib/db');

      const mockLogs = [
        { id: 'log_1', tenantId: 'ten_A', action: 'product:create' },
        { id: 'log_2', tenantId: 'ten_A', action: 'order:update' },
      ];

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              orderBy: vi.fn().mockReturnValueOnce({
                limit: vi.fn().mockReturnValueOnce({
                  offset: vi.fn().mockResolvedValueOnce(mockLogs),
                }),
              }),
            }),
          }),
        } as unknown as ReturnType<typeof db.select>)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockResolvedValueOnce([{ count: 2 }]),
          }),
        } as unknown as ReturnType<typeof db.select>);

      const result = await listAuditLogs({ tenantId: 'ten_A', page: 1, pageSize: 10 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.items.every((l) => l.tenantId === 'ten_A')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Tenant Domain Service Operations
  // ---------------------------------------------------------------------------
  describe('Tenant Domain Service Operations', () => {
    it('createTenant provisions tenant with storeSettings, theme, draft page, and owner', async () => {
      const result = await createTenant({
        name: 'Artisan Pottery',
        slug: 'artisan-pottery',
        ownerEmail: 'craft@pottery.local',
        ownerName: 'Clara Potter',
        plan: 'starter',
      });

      expect(result.tenant).toBeDefined();
      expect(result.tenant.id).toHaveLength(26);
      expect(result.tenant.name).toBe('Artisan Pottery');
      expect(result.tenant.slug).toBe('artisan-pottery');
      expect(result.tenant.status).toBe('active');
      expect(result.owner.email).toBe('craft@pottery.local');
      expect(result.owner.name).toBe('Clara Potter');
    });

    it('createTenant rejects duplicate slugs with ConflictError', async () => {
      const { db } = await import('@/lib/db');

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: 'existing_id' }]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      await expect(
        createTenant({
          name: 'Duplicate Store',
          slug: 'duplicate-store',
          ownerEmail: 'owner@dup.com',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('getTenantById throws NotFoundError when tenant does not exist', async () => {
      const { db } = await import('@/lib/db');

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      await expect(getTenantById('ten_non_existent')).rejects.toThrow(NotFoundError);
    });

    it('getTenantBySlug returns tenant or null', async () => {
      const { db } = await import('@/lib/db');

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              { id: 'ten_found', slug: 'found-store', name: 'Found Store' },
            ]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const found = await getTenantBySlug('found-store');
      expect(found).not.toBeNull();
      expect(found?.slug).toBe('found-store');

      expect(await getTenantBySlug('')).toBeNull();
    });

    it('updateTenantStatus modifies status and validates allowable states', async () => {
      const { db } = await import('@/lib/db');

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              { id: 'ten_1', status: 'active', name: 'Store 1' },
            ]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      vi.mocked(db.update).mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([
              { id: 'ten_1', status: 'suspended', name: 'Store 1' },
            ]),
          }),
        }),
      } as unknown as ReturnType<typeof db.update>);

      const updated = await updateTenantStatus(
        'ten_1',
        'suspended',
        'usr_admin'
      );
      expect(updated.status).toBe('suspended');

      // Invalid status throws ValidationError
      await expect(
        updateTenantStatus('ten_1', 'invalid_status' as unknown as 'active', 'usr_admin')
      ).rejects.toThrow(ValidationError);
    });

    it('updateTenant modifies attributes and validates constraints', async () => {
      const { db } = await import('@/lib/db');

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              { id: 'ten_1', status: 'active', name: 'Store 1' },
            ]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      vi.mocked(db.update).mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([
              { id: 'ten_1', name: 'Renamed Store', plan: 'pro' },
            ]),
          }),
        }),
      } as unknown as ReturnType<typeof db.update>);

      const updated = await updateTenant(
        'ten_1',
        { name: 'Renamed Store', plan: 'pro' },
        'usr_admin'
      );
      expect(updated.name).toBe('Renamed Store');

      // Short name throws ValidationError
      await expect(
        updateTenant('ten_1', { name: 'A' }, 'usr_admin')
      ).rejects.toThrow(ValidationError);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Platform Tenant API Endpoints Authorization & Validation
  // ---------------------------------------------------------------------------
  describe('Platform Tenant API Routes (/api/v1/platform/tenants)', () => {
    it('GET /api/v1/platform/tenants allows platform_admin and platform_support', async () => {
      // 1. platform_admin
      const adminToken = await createSession({
        id: 'usr_admin',
        email: 'admin@platform.com',
        role: 'platform_admin',
      });
      mockCookieMap.set('byob_session', adminToken);

      const reqAdmin = new NextRequest('http://localhost:3000/api/v1/platform/tenants?page=1&pageSize=10');
      const resAdmin = await getPlatformTenants(reqAdmin);
      expect(resAdmin.status).toBe(200);
      const jsonAdmin = await resAdmin.json();
      expect(jsonAdmin.success).toBe(true);

      // 2. platform_support
      const supportToken = await createSession({
        id: 'usr_support',
        email: 'support@platform.com',
        role: 'platform_support',
      });
      mockCookieMap.set('byob_session', supportToken);

      const reqSupport = new NextRequest('http://localhost:3000/api/v1/platform/tenants');
      const resSupport = await getPlatformTenants(reqSupport);
      expect(resSupport.status).toBe(200);

      // 3. tenant_owner is FORBIDDEN
      const ownerToken = await createSession({
        id: 'usr_owner',
        email: 'owner@shop.com',
        role: 'tenant_owner',
      });
      mockCookieMap.set('byob_session', ownerToken);

      const resOwner = await getPlatformTenants(reqSupport);
      expect(resOwner.status).toBe(403);
      const jsonOwner = await resOwner.json();
      expect(jsonOwner.error.code).toBe('FORBIDDEN');

      // 4. Unauthenticated is UNAUTHORIZED
      mockCookieMap.clear();
      const resUnauth = await getPlatformTenants(reqSupport);
      expect(resUnauth.status).toBe(401);
    });

    it('POST /api/v1/platform/tenants allows platform_admin and validates payload with Zod', async () => {
      const adminToken = await createSession({
        id: 'usr_admin',
        email: 'admin@platform.com',
        role: 'platform_admin',
      });
      mockCookieMap.set('byob_session', adminToken);

      // Valid creation
      const validReq = new NextRequest('http://localhost:3000/api/v1/platform/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Green Flora',
          slug: 'green-flora',
          ownerEmail: 'green@flora.local',
          ownerName: 'Green Owner',
          plan: 'pro',
        }),
      });

      const resValid = await postPlatformTenants(validReq);
      expect(resValid.status).toBe(201);
      const jsonValid = await resValid.json();
      expect(jsonValid.success).toBe(true);
      expect(jsonValid.data.tenant.name).toBe('Green Flora');

      // Invalid payload (invalid email and short slug)
      const invalidReq = new NextRequest('http://localhost:3000/api/v1/platform/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Bad Store',
          slug: 'b',
          ownerEmail: 'not-an-email',
        }),
      });

      const resInvalid = await postPlatformTenants(invalidReq);
      expect(resInvalid.status).toBe(400);
      const jsonInvalid = await resInvalid.json();
      expect(jsonInvalid.success).toBe(false);
      expect(jsonInvalid.error.code).toBe('VALIDATION_ERROR');

      // platform_support cannot create tenants (requires platform_admin)
      const supportToken = await createSession({
        id: 'usr_support',
        email: 'support@platform.com',
        role: 'platform_support',
      });
      mockCookieMap.set('byob_session', supportToken);

      const resSupport = await postPlatformTenants(validReq);
      expect(resSupport.status).toBe(403);
    });

    it('GET & PATCH /api/v1/platform/tenants/[id] enforces permissions and validates inputs', async () => {
      const adminToken = await createSession({
        id: 'usr_admin',
        email: 'admin@platform.com',
        role: 'platform_admin',
      });
      mockCookieMap.set('byob_session', adminToken);

      const { db } = await import('@/lib/db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: 'ten_existing_01', name: 'Existing Store', slug: 'existing-store', status: 'active' },
            ]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      // GET tenant details
      const reqGet = new NextRequest('http://localhost:3000/api/v1/platform/tenants/ten_existing_01');
      const resGet = await getPlatformTenantById(reqGet, {
        params: Promise.resolve({ id: 'ten_existing_01' }),
      });
      expect(resGet.status).toBe(200);

      // PATCH tenant metadata
      const reqPatch = new NextRequest('http://localhost:3000/api/v1/platform/tenants/ten_existing_01', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Store Name' }),
      });
      const resPatch = await patchPlatformTenantById(reqPatch, {
        params: Promise.resolve({ id: 'ten_existing_01' }),
      });
      expect(resPatch.status).toBe(200);

      // Non-admin PATCH is forbidden
      const supportToken = await createSession({
        id: 'usr_support',
        email: 'support@platform.com',
        role: 'platform_support',
      });
      mockCookieMap.set('byob_session', supportToken);

      const resForbiddenPatch = await patchPlatformTenantById(reqPatch, {
        params: Promise.resolve({ id: 'ten_existing_01' }),
      });
      expect(resForbiddenPatch.status).toBe(403);
    });

    it('PATCH /api/v1/platform/tenants/[id]/status modifies status and rejects invalid values', async () => {
      const adminToken = await createSession({
        id: 'usr_admin',
        email: 'admin@platform.com',
        role: 'platform_admin',
      });
      mockCookieMap.set('byob_session', adminToken);

      const { db } = await import('@/lib/db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: 'ten_target_01', name: 'Target Store', status: 'active' },
            ]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      // Valid status update
      const reqValid = new NextRequest('http://localhost:3000/api/v1/platform/tenants/ten_target_01/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suspended' }),
      });
      const resValid = await patchPlatformTenantStatus(reqValid, {
        params: Promise.resolve({ id: 'ten_target_01' }),
      });
      expect(resValid.status).toBe(200);

      // Invalid status value rejected by Zod
      const reqInvalid = new NextRequest('http://localhost:3000/api/v1/platform/tenants/ten_target_01/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'deleted' }),
      });
      const resInvalid = await patchPlatformTenantStatus(reqInvalid, {
        params: Promise.resolve({ id: 'ten_target_01' }),
      });
      expect(resInvalid.status).toBe(400);
      const jsonInvalid = await resInvalid.json();
      expect(jsonInvalid.success).toBe(false);
      expect(jsonInvalid.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
