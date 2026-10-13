import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api/response';
import { requireAuth, requireTenantAccess } from '@/lib/auth/context';
import { getCorrelationId } from '@/lib/middleware/correlation';
import { BadRequestError } from '@/lib/errors';
import { createCoupon, listCoupons } from '@/modules/promotions/coupon-service';

/**
 * GET /api/v1/admin/coupons
 * Lists all coupons belonging to the tenant.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const headerTenantId = req.headers.get('x-tenant-id');
    const tenantId = headerTenantId || session.tenantId;

    if (!tenantId) {
      throw new BadRequestError('Tenant context is required');
    }

    await requireTenantAccess(tenantId);

    const coupons = await listCoupons(tenantId);
    return successResponse(coupons);
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}

/**
 * POST /api/v1/admin/coupons
 * Creates a new discount coupon.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const headerTenantId = req.headers.get('x-tenant-id');
    const tenantId = headerTenantId || session.tenantId;

    if (!tenantId) {
      throw new BadRequestError('Tenant context is required');
    }

    await requireTenantAccess(tenantId);

    const body = await req.json();
    const created = await createCoupon(tenantId, body, session.userId);

    return successResponse(created, undefined, { status: 201 });
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}
