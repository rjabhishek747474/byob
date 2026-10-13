import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api/response';
import { requireAuth, requireTenantAccess } from '@/lib/auth/context';
import { getCorrelationId } from '@/lib/middleware/correlation';
import { getDashboardKPIs } from '@/modules/dashboard/dashboard-service';
import { BadRequestError } from '@/lib/errors';

/**
 * GET /api/v1/admin/dashboard
 * Retrieves dashboard KPIs for the active tenant including revenue, order breakdown,
 * active products, total customers, recent orders, and daily timeline.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    // Determine target tenant ID from header or active session
    const headerTenantId = req.headers.get('x-tenant-id');
    const tenantId = headerTenantId || session.tenantId;

    if (!tenantId) {
      throw new BadRequestError('Tenant context is required to access dashboard metrics');
    }

    await requireTenantAccess(tenantId);

    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get('fromDate');
    const toParam = searchParams.get('toDate');

    const fromDate = fromParam ? new Date(fromParam) : undefined;
    const toDate = toParam ? new Date(toParam) : undefined;

    const kpis = await getDashboardKPIs(tenantId, { fromDate, toDate });

    return successResponse(kpis);
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}
