import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api/response';
import { requireAuth, requireTenantAccess } from '@/lib/auth/context';
import { getCorrelationId } from '@/lib/middleware/correlation';
import { BadRequestError } from '@/lib/errors';
import {
  deleteSubscriptionPlan,
  updateSubscriptionPlan,
} from '@/modules/plans/plan-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/admin/plans/[id]
 * Updates subscription plan metadata or status.
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
    const updated = await updateSubscriptionPlan(tenantId, id, body, session.userId);

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}

/**
 * DELETE /api/v1/admin/plans/[id]
 * Deletes a subscription plan.
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

    await deleteSubscriptionPlan(tenantId, id, session.userId);
    return successResponse({ deleted: true, id });
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}
