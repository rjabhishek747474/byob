import { NextRequest } from 'next/server';
import { RouteContext, withApiHandler } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { ValidationError } from '@/lib/errors';
import {
  deleteProduct,
  getProductById,
  updateProduct,
} from '@/modules/catalog/product-service';

/**
 * GET /api/v1/admin/products/[id]
 * Retrieves a product by ID.
 * Requires `product:read` permission.
 */
export const GET = withApiHandler<unknown, { id: string }>(
  async (_req: NextRequest, context?: RouteContext<{ id: string }>) => {
    const session = await requirePermission('product:read');
    const tenantId = session.tenantId;

    if (!tenantId) {
      throw new ValidationError('Tenant context is required', [
        { field: 'tenantId', message: 'No active tenant in session' },
      ]);
    }

    const params = await context?.params;
    const id = params?.id;
    if (!id) {
      throw new ValidationError('Product ID is required');
    }

    const product = await getProductById(tenantId, id);
    return product;
  }
);

/**
 * PATCH /api/v1/admin/products/[id]
 * Updates a product.
 * Requires `product:update` permission.
 */
export const PATCH = withApiHandler<unknown, { id: string }>(
  async (req: NextRequest, context?: RouteContext<{ id: string }>) => {
    const session = await requirePermission('product:update');
    const tenantId = session.tenantId;

    if (!tenantId) {
      throw new ValidationError('Tenant context is required', [
        { field: 'tenantId', message: 'No active tenant in session' },
      ]);
    }

    const params = await context?.params;
    const id = params?.id;
    if (!id) {
      throw new ValidationError('Product ID is required');
    }

    const body = await req.json();
    const updated = await updateProduct(tenantId, id, body, session.userId);
    return updated;
  }
);

/**
 * DELETE /api/v1/admin/products/[id]
 * Soft-deletes (archives) a product.
 * Requires `product:delete` permission.
 */
export const DELETE = withApiHandler<unknown, { id: string }>(
  async (_req: NextRequest, context?: RouteContext<{ id: string }>) => {
    const session = await requirePermission('product:delete');
    const tenantId = session.tenantId;

    if (!tenantId) {
      throw new ValidationError('Tenant context is required', [
        { field: 'tenantId', message: 'No active tenant in session' },
      ]);
    }

    const params = await context?.params;
    const id = params?.id;
    if (!id) {
      throw new ValidationError('Product ID is required');
    }

    const result = await deleteProduct(tenantId, id, session.userId);
    return result;
  }
);
