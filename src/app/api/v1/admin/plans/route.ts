import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api/response';
import { requireAuth, requireTenantAccess } from '@/lib/auth/context';
import { getCorrelationId } from '@/lib/middleware/correlation';
import { BadRequestError } from '@/lib/errors';
import {
  createSubscriptionPlan,
  listCustomerSubscriptions,
  listSubscriptionPlans,
} from '@/modules/plans/plan-service';

/**
 * GET /api/v1/admin/plans
 * Lists subscription plans or customer subscribers for the active tenant.
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

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view'); // 'subscribers' | 'plans'

    if (view === 'subscribers') {
      const status = searchParams.get('status') || undefined;
      const data = await listCustomerSubscriptions(tenantId, { status });
      return successResponse(data);
    }

    const data = await listSubscriptionPlans(tenantId);
    return successResponse(data);
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}

/**
 * POST /api/v1/admin/plans
 * Creates a new subscription plan with upfront/prepaid duration.
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
    const created = await createSubscriptionPlan(tenantId, body, session.userId);

    return successResponse(created, undefined, { status: 201 });
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}
