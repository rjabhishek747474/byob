import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { tenants } from '@/lib/db/schema/tenants';
import type { TenantContext } from '@/lib/auth/types';

/**
 * Cache entry holding resolved tenant context and expiration epoch.
 */
interface TenantCacheEntry {
  context: TenantContext | null;
  expiresAt: number;
}

/**
 * In-memory TTL cache for tenant lookups by slug (MVP in-memory cache).
 */
const tenantCache = new Map<string, TenantCacheEntry>();

/**
 * Cache time-to-live in milliseconds (60 seconds).
 */
const CACHE_TTL_MS = 60 * 1000;

/**
 * Reserved subdomain slugs that must not be treated as tenant stores.
 */
const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'admin',
  'app',
  'static',
  'assets',
  'cdn',
  'mail',
  'auth',
  'dashboard',
]);

/**
 * Strips port numbers from hostname strings.
 */
function cleanHost(host: string): string {
  return host.split(':')[0].toLowerCase();
}

/**
 * Extracts candidate tenant slug from the incoming request without trusting query/body params.
 * Priority:
 * 1. Subdomain from Host header (<slug>.platform-domain)
 * 2. Header 'x-tenant-slug' in development only (NODE_ENV !== 'production')
 * 3. URL path prefix pattern /s/<slug>/
 *
 * @param request - NextRequest object
 * @returns Clean slug string or null if unresolvable
 */
export function extractTenantSlug(request: NextRequest): string | null {
  // 1. Host header / Subdomain resolution
  const hostHeader = request.headers.get('host') || request.nextUrl.host;
  if (hostHeader) {
    const rawHost = cleanHost(hostHeader);
    const platformDomain = cleanHost(process.env.PLATFORM_DOMAIN || 'localhost:3000');

    if (rawHost !== platformDomain && rawHost.endsWith(`.${platformDomain}`)) {
      const candidate = rawHost.slice(0, rawHost.length - platformDomain.length - 1);
      if (candidate && !RESERVED_SUBDOMAINS.has(candidate)) {
        return candidate;
      }
    } else if (rawHost !== 'localhost' && !rawHost.endsWith('.localhost')) {
      // Custom domains or single-level subdomain support
      const parts = rawHost.split('.');
      if (parts.length > 2) {
        const candidate = parts[0];
        if (!RESERVED_SUBDOMAINS.has(candidate)) {
          return candidate;
        }
      }
    }
  }

  // 2. Fallback: query param (?tenant=) or x-tenant-slug header in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const querySlug = request.nextUrl.searchParams.get('tenant');
    if (querySlug && querySlug.trim().length > 0) {
      const sanitized = querySlug.trim().toLowerCase();
      if (!RESERVED_SUBDOMAINS.has(sanitized)) {
        return sanitized;
      }
    }

    const headerSlug = request.headers.get('x-tenant-slug');
    if (headerSlug && headerSlug.trim().length > 0) {
      const sanitized = headerSlug.trim().toLowerCase();
      if (!RESERVED_SUBDOMAINS.has(sanitized)) {
        return sanitized;
      }
    }
  }

  // 3. Fallback: URL path prefix matching /s/<slug>/ or /s/<slug>
  const pathname = request.nextUrl.pathname;
  const pathMatch = pathname.match(/^\/s\/([a-z0-9_-]+)(?:\/|$)/i);
  if (pathMatch?.[1]) {
    const candidate = pathMatch[1].toLowerCase();
    if (!RESERVED_SUBDOMAINS.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Resolves tenant context from request headers, subdomains, and database.
 * Enforces tenant status rules (rejects suspended/archived tenants on storefronts).
 *
 * @param request - NextRequest to evaluate
 * @returns TenantContext or null if not found or unauthorized for route
 */
export async function resolveTenant(request: NextRequest): Promise<TenantContext | null> {
  const slug = extractTenantSlug(request);
  if (!slug) {
    return null;
  }

  const now = Date.now();
  const cached = tenantCache.get(slug);

  let tenantContext: TenantContext | null = null;

  if (cached && cached.expiresAt > now) {
    tenantContext = cached.context;
  } else {
    try {
      const [record] = await db
        .select({
          id: tenants.id,
          slug: tenants.slug,
          status: tenants.status,
        })
        .from(tenants)
        .where(eq(tenants.slug, slug))
        .limit(1);

      if (record) {
        tenantContext = {
          tenantId: record.id,
          tenantSlug: record.slug,
          tenantStatus: record.status,
        };
      } else {
        tenantContext = null;
      }

      // Store in memory cache
      tenantCache.set(slug, {
        context: tenantContext,
        expiresAt: now + CACHE_TTL_MS,
      });
    } catch (error) {
      console.error(`[TENANT_RESOLVE_ERROR] Failed database query for slug: ${slug}`, error);
      return null;
    }
  }

  if (!tenantContext) {
    return null;
  }

  const pathname = request.nextUrl.pathname;
  const isAdminRoute =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/v1/admin');

  // Enforce storefront tenant lifecycle rules:
  // - Archived tenants are never accessible on public or store routes
  // - Suspended tenants are prohibited on storefronts, but accessible on admin triage routes
  if (tenantContext.tenantStatus === 'archived') {
    return null;
  }

  if (tenantContext.tenantStatus === 'suspended' && !isAdminRoute) {
    return null;
  }

  return tenantContext;
}

/**
 * Clears cached entries for a given tenant slug or the entire cache.
 * Useful when tenant status or details are updated.
 */
export function clearTenantCache(slug?: string): void {
  if (slug) {
    tenantCache.delete(slug);
  } else {
    tenantCache.clear();
  }
}
