import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth/context';
import { CORRELATION_ID_HEADER, getCorrelationId } from '@/lib/middleware/correlation';
import { apiLimiter, authLimiter } from '@/lib/middleware/rate-limit';
import { extractTenantSlug } from '@/lib/middleware/tenant';

/**
 * Applies security headers to the outgoing response.
 */
function applySecurityHeaders(headers: Headers): void {
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('X-XSS-Protection', '1; mode=block');
}

/**
 * Next.js Edge Middleware handling:
 * 1. Distributed correlation tracking
 * 2. Rate limiting (in-memory)
 * 3. Administrative route authentication checks
 * 4. Tenant slug resolution from subdomains / paths
 * 5. Security headers
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  // 1. Correlation ID tracking
  const correlationId = getCorrelationId(request);

  // Clone headers for downstream server request propagation
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_ID_HEADER, correlationId);

  // Extract client IP address for rate limiting
  const forwardedFor = request.headers.get('x-forwarded-for');
  const clientIp = forwardedFor
    ? forwardedFor.split(',')[0].trim()
    : request.headers.get('x-real-ip') || '127.0.0.1';

  // 2. In-memory Rate Limiting Check
  const isAuthRoute =
    pathname.startsWith('/api/v1/auth') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/login';

  const isApiRoute = pathname.startsWith('/api/');

  if (isAuthRoute) {
    const rateCheck = authLimiter.checkLimit(clientIp);
    if (!rateCheck.allowed) {
      const retryAfter = Math.max(1, Math.ceil((rateCheck.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many authentication attempts. Please try again later.',
          },
        },
        {
          status: 429,
          headers: {
            [CORRELATION_ID_HEADER]: correlationId,
            'Retry-After': String(retryAfter),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(rateCheck.resetAt / 1000)),
          },
        }
      );
    }
  } else if (isApiRoute) {
    const rateCheck = apiLimiter.checkLimit(clientIp);
    if (!rateCheck.allowed) {
      const retryAfter = Math.max(1, Math.ceil((rateCheck.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please slow down.',
          },
        },
        {
          status: 429,
          headers: {
            [CORRELATION_ID_HEADER]: correlationId,
            'Retry-After': String(retryAfter),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(rateCheck.resetAt / 1000)),
          },
        }
      );
    }
  }

  // 3. Admin Route Authentication Enforcement
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authHeader = request.headers.get('authorization');
  const hasAuthToken = Boolean(
    (sessionToken && sessionToken.trim().length > 0) ||
    (authHeader && authHeader.startsWith('Bearer '))
  );

  // Protected Admin API routes
  if (pathname.startsWith('/api/v1/admin')) {
    if (!hasAuthToken) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required to access administrative API endpoints.',
          },
        },
        { status: 401 }
      );
      response.headers.set(CORRELATION_ID_HEADER, correlationId);
      applySecurityHeaders(response.headers);
      return response;
    }
  }

  // Protected Admin UI routes
  if (pathname.startsWith('/admin')) {
    // Allow public login routes if under /admin/login
    if (!pathname.startsWith('/admin/login') && !hasAuthToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', `${pathname}${search}`);
      const redirectResponse = NextResponse.redirect(loginUrl);
      redirectResponse.headers.set(CORRELATION_ID_HEADER, correlationId);
      applySecurityHeaders(redirectResponse.headers);
      return redirectResponse;
    }
  }

  // 4. Storefront Tenant Resolution
  const tenantSlug = extractTenantSlug(request);
  if (tenantSlug) {
    requestHeaders.set('x-tenant-slug', tenantSlug);
  }

  // Forward request with mutated headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 5. Response Headers (Correlation ID & Security Headers)
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  if (tenantSlug) {
    response.headers.set('x-tenant-slug', tenantSlug);
  }
  applySecurityHeaders(response.headers);

  return response;
}

/**
 * Route matching configuration:
 * Exclude static assets, next internals, and icons.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
