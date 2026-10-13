import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api/response';
import { requireAuth, requireTenantAccess } from '@/lib/auth/context';
import { getCorrelationId } from '@/lib/middleware/correlation';
import { BadRequestError } from '@/lib/errors';
import {
  deleteCoupon,
  getCouponById,
  updateCouponStatus,
} from '@/modules/promotions/coupon-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/coupons/[id]
 * Retrieves details of a specific coupon.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const headerTenantId = req.headers.get('x-tenant-id');
    const tenantId = headerTenantId || session.tenantId;

    if (!tenantId) {
      throw new BadRequestError('Tenant context is required');
    }

    await requireTenantAccess(tenantId);

    const coupon = await getCouponById(tenantId, id);
    return successResponse(coupon);
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}

/**
 * PATCH /api/v1/admin/coupons/[id]
 * Updates coupon active status or details.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const headerTenantId = req.headers.get('x-tenant-id');
    const tenantId = headerTenantId || session.tenantId;

    if (!tenantId) {
      throw new BadRequestError('Tenant context is required');
    }

    await requireTenantAccess(tenantId);

    const body = await req.json();

    if (body.isActive !== undefined) {
      const updated = await updateCouponStatus(tenantId, id, Boolean(body.isActive), session.userId);
      return successResponse(updated);
    }

    // Default return current coupon if no status changed
    const current = await getCouponById(tenantId, id);
    return successResponse(current);
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}

/**
 * DELETE /api/v1/admin/coupons/[id]
 * Deletes a coupon.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const headerTenantId = req.headers.get('x-tenant-id');
    const tenantId = headerTenantId || session.tenantId;

    if (!tenantId) {
      throw new BadRequestError('Tenant context is required');
    }

    await requireTenantAccess(tenantId);

    await deleteCoupon(tenantId, id, session.userId);
    return successResponse({ deleted: true, id });
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}
