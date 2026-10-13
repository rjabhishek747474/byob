import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { ValidationError } from '@/lib/errors';
import { getOrderById } from '@/modules/orders/order-service';

/**
 * GET /api/v1/admin/orders/[id]
 * Retrieves single order details including snapshot items and status history.
 */
export const GET = withApiHandler(async (_req: NextRequest, context) => {
  const session = await requirePermission('order:read');
  const tenantId = session.tenantId;

  if (!tenantId) {
    throw new ValidationError('Tenant context is required');
  }

  const params = context?.params ? await context.params : {};
  const id = params.id as string;

  if (!id) {
    throw new ValidationError('Order ID is required in URL path');
  }

  const order = await getOrderById(tenantId, id);
  return order;
});

