import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { ValidationError } from '@/lib/errors';
import { listOrders } from '@/modules/orders/order-service';

/**
 * GET /api/v1/admin/orders
 * Lists orders for tenant store with search and filters.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const session = await requirePermission('order:read');
  const tenantId = session.tenantId;

  if (!tenantId) {
    throw new ValidationError('Tenant context is required');
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status') || undefined;
  const search = searchParams.get('search') || undefined;
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
  const pageSize = searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : 20;

  const fromDateStr = searchParams.get('fromDate');
  const toDateStr = searchParams.get('toDate');

  const fromDate = fromDateStr ? new Date(fromDateStr) : undefined;
  const toDate = toDateStr ? new Date(toDateStr) : undefined;

  const result = await listOrders(tenantId, {
    status,
    search,
    page,
    pageSize,
    fromDate,
    toDate,
  });

  return result;
});

