import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/response';
import { RateLimitError, ValidationError } from '@/lib/errors';
import { RateLimiter } from '@/lib/middleware/rate-limit';
import { getPublicOrderTracking } from '@/modules/orders/order-service';

/**
 * Public order tracking rate limiter: 30 requests per minute per IP / token
 * Prevents brute force scanning of public tracking tokens.
 */
const trackingLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
});

/**
 * GET /api/v1/store/orders/[token]/tracking
 * Retrieves public-safe order tracking details using publicToken ONLY.
 */
export const GET = withApiHandler(async (req: NextRequest, context) => {
  const params = context?.params ? await context.params : {};
  const token = params.token as string;

  if (!token) {
    throw new ValidationError('Public tracking token is required in URL path');
  }

  // Rate limiting to prevent token enumeration
  const forwardedFor = req.headers.get('x-forwarded-for');
  const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
  const rateLimitKey = `tracking:${clientIp}:${token}`;

  const rateCheck = trackingLimiter.checkLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    const retryAfter = Math.max(1, Math.ceil((rateCheck.resetAt - Date.now()) / 1000));
    throw new RateLimitError('Too many tracking requests. Please try again in a moment.', retryAfter);
  }

  const trackingInfo = await getPublicOrderTracking(token);
  return trackingInfo;
});

