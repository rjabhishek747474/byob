import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/response';
import { RateLimitError, ValidationError } from '@/lib/errors';
import { checkoutLimiter } from '@/lib/middleware/rate-limit';
import { resolveTenant } from '@/lib/middleware/tenant';
import { processCheckout } from '@/modules/checkout/checkout-service';

/**
 * POST /api/v1/store/checkout
 * Submits checkout order attempt.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  const tenant = await resolveTenant(req);
  const body = await req.json();

  const tenantId =
    tenant?.tenantId ||
    req.headers.get('x-tenant-id') ||
    body.tenantId ||
    '';

  if (!tenantId) {
    throw new ValidationError('Tenant context could not be resolved');
  }

  const sessionId =
    body.sessionId ||
    req.headers.get('x-cart-session-id') ||
    '';

  // Apply checkout rate limiting per session or client IP
  const rateLimitKey = `${tenantId}:${sessionId || 'anonymous'}`;
  const rateCheck = checkoutLimiter.checkLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    const retryAfter = Math.max(1, Math.ceil((rateCheck.resetAt - Date.now()) / 1000));
    throw new RateLimitError('Too many checkout attempts. Please try again shortly.', retryAfter);
  }

  const correlationId = req.headers.get('x-correlation-id') || undefined;
  const result = await processCheckout(tenantId, body, correlationId);
  return result;
});

