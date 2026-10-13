import { NextRequest } from 'next/server';
import { RouteContext, withApiHandler } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { ValidationError } from '@/lib/errors';
import { adjustInventory } from '@/modules/catalog/product-service';
import { inventoryAdjustmentSchema } from '@/modules/catalog/types';
import { z } from 'zod/v4';

const routeInventorySchema = inventoryAdjustmentSchema.extend({
  variantId: z.string().trim().min(1, 'Variant ID is required'),
});

/**
 * POST /api/v1/admin/products/[id]/inventory
 * Adjusts inventory for a product's variant.
 * Requires `product:update` permission.
 */
export const POST = withApiHandler<unknown, { id: string }>(
  async (req: NextRequest, context?: RouteContext<{ id: string }>) => {
    const session = await requirePermission('product:update');
    const tenantId = session.tenantId;

    if (!tenantId) {
      throw new ValidationError('Tenant context is required', [
        { field: 'tenantId', message: 'No active tenant in session' },
      ]);
    }

    const params = await context?.params;
    const productId = params?.id;
    if (!productId) {
      throw new ValidationError('Product ID is required');
    }

    const body = await req.json();
    const validated = routeInventorySchema.parse(body);

    const result = await adjustInventory(
      tenantId,
      validated.variantId,
      validated.delta,
      validated.reason,
      session.userId,
      validated.referenceId ?? productId,
      validated.allowBackorder
    );

    return result;
  }
);
