import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api/response';
import { getCorrelationId } from '@/lib/middleware/correlation';
import { resolveTenant } from '@/lib/middleware/tenant';
import { BadRequestError } from '@/lib/errors';
import { validateCoupon } from '@/modules/promotions/coupon-service';

/**
 * POST /api/v1/store/coupons/validate
 * Public checkout endpoint validating coupon codes against cart totals, limits, and customer eligibility.
 */
export async function POST(req: NextRequest) {
  try {
    const tenantHeader = req.headers.get('x-tenant-id');
    let tenantId = tenantHeader;

    if (!tenantId) {
      const resolved = await resolveTenant(req);
      tenantId = resolved?.tenantId || null;
    }

    if (!tenantId) {
      throw new BadRequestError('Tenant context could not be identified');
    }

    const body = await req.json();

    if (!body.code || typeof body.code !== 'string') {
      throw new BadRequestError('Coupon code is required');
    }

    const subtotal = typeof body.subtotal === 'number' ? body.subtotal : 0;
    const customerId = typeof body.customerId === 'string' ? body.customerId : undefined;

    const validationResult = await validateCoupon(
      tenantId,
      body.code,
      customerId,
      subtotal,
      body.items
    );

    return successResponse(validationResult);
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}
