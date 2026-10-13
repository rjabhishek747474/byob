import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api/response';
import { requireAuth, requireTenantAccess } from '@/lib/auth/context';
import { getCorrelationId } from '@/lib/middleware/correlation';
import { BadRequestError } from '@/lib/errors';
import { listCustomers } from '@/modules/customers/customer-service';

/**
 * GET /api/v1/admin/customers
 * Lists customer accounts with order metrics, search, and pagination.
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
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
    const pageSize = searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : 20;
    const search = searchParams.get('search') || undefined;

    const result = await listCustomers(tenantId, { search, page, pageSize });

    return successResponse(result.items, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}
