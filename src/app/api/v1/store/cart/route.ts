import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/response';
import { ValidationError } from '@/lib/errors';
import { resolveTenant } from '@/lib/middleware/tenant';
import {
  addItemToCart,
  getCartSummary,
  removeItemFromCart,
  updateCartItem,
} from '@/modules/checkout/cart-service';

/**
 * Cookie name used for guest or customer shopping cart session.
 */
export const CART_SESSION_COOKIE = 'byob_cart_session';

/**
 * Resolves or extracts tenantId and cart sessionId from request.
 */
async function resolveCartContext(req: NextRequest): Promise<{ tenantId: string; sessionId: string }> {
  const tenant = await resolveTenant(req);
  const tenantId =
    tenant?.tenantId ||
    req.headers.get('x-tenant-id') ||
    '';

  if (!tenantId) {
    throw new ValidationError('Tenant context could not be resolved for this storefront');
  }

  // Get sessionId from header, cookie, or query param
  const sessionId =
    req.headers.get('x-cart-session-id') ||
    req.cookies.get(CART_SESSION_COOKIE)?.value ||
    req.nextUrl.searchParams.get('sessionId') ||
    '';

  if (!sessionId) {
    throw new ValidationError('Cart session ID is required', [
      { field: 'sessionId', message: 'No cart session found in request headers or cookies' },
    ]);
  }

  return { tenantId, sessionId };
}

/**
 * GET /api/v1/store/cart
 * Retrieves the server-authoritative cart summary.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const { tenantId, sessionId } = await resolveCartContext(req);
  const summary = await getCartSummary(tenantId, sessionId);
  return summary;
});

/**
 * POST /api/v1/store/cart
 * Adds an item to the shopping cart.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const tenant = await resolveTenant(req);
  const tenantId =
    tenant?.tenantId ||
    req.headers.get('x-tenant-id') ||
    body.tenantId ||
    '';

  const sessionId =
    body.sessionId ||
    req.headers.get('x-cart-session-id') ||
    req.cookies.get(CART_SESSION_COOKIE)?.value ||
    '';

  if (!tenantId) {
    throw new ValidationError('Tenant context is required');
  }
  if (!sessionId) {
    throw new ValidationError('Session ID is required');
  }
  if (!body.variantId) {
    throw new ValidationError('Variant ID is required', [
      { field: 'variantId', message: 'variantId must be specified' },
    ]);
  }

  const quantity = typeof body.quantity === 'number' ? body.quantity : 1;
  await addItemToCart(tenantId, sessionId, body.variantId, quantity);

  // Return updated cart summary
  return await getCartSummary(tenantId, sessionId);
});

/**
 * PATCH /api/v1/store/cart
 * Updates line item quantity in cart.
 */
export const PATCH = withApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const { tenantId, sessionId } = await resolveCartContext(req);

  if (!body.cartItemId) {
    throw new ValidationError('cartItemId is required');
  }
  if (typeof body.quantity !== 'number') {
    throw new ValidationError('quantity must be a number');
  }

  await updateCartItem(tenantId, sessionId, body.cartItemId, body.quantity);
  return await getCartSummary(tenantId, sessionId);
});

/**
 * DELETE /api/v1/store/cart
 * Removes line item from cart.
 */
export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { tenantId, sessionId } = await resolveCartContext(req);
  const cartItemId = req.nextUrl.searchParams.get('cartItemId');

  if (!cartItemId) {
    throw new ValidationError('cartItemId query parameter is required');
  }

  await removeItemFromCart(tenantId, sessionId, cartItemId);
  return await getCartSummary(tenantId, sessionId);
});

