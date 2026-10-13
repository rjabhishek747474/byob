import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { ValidationError } from '@/lib/errors';
import { updateOrderStatus } from '@/modules/orders/order-service';

/**
 * POST /api/v1/admin/orders/[id]/transitions
 * Triggers a validated state machine status transition for an order.
 */
export const POST = withApiHandler(async (req: NextRequest, context) => {
  const session = await requirePermission('order:update');
  const tenantId = session.tenantId;

  if (!tenantId) {
    throw new ValidationError('Tenant context is required');
  }

  const params = context?.params ? await context.params : {};
  const id = params.id as string;

  if (!id) {
    throw new ValidationError('Order ID is required in URL path');
  }

  const body = await req.json();
  const { targetStatus, reason } = body;

  if (!targetStatus) {
    throw new ValidationError('targetStatus is required in request body', [
      { field: 'targetStatus', message: 'targetStatus must be specified' },
    ]);
  }

  const updatedOrder = await updateOrderStatus(
    tenantId,
    id,
    targetStatus,
    reason || 'Updated via admin dashboard',
    session.userId
  );

  return updatedOrder;
});

