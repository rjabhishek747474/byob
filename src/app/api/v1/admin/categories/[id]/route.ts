import { NextRequest } from 'next/server';
import { RouteContext, withApiHandler } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { ValidationError } from '@/lib/errors';
import {
  deleteCategory,
  getCategoryById,
  updateCategory,
} from '@/modules/catalog/category-service';

/**
 * GET /api/v1/admin/categories/[id]
 * Retrieves a category by ID.
 * Requires `category:read` permission.
 */
export const GET = withApiHandler<unknown, { id: string }>(
  async (_req: NextRequest, context?: RouteContext<{ id: string }>) => {
    const session = await requirePermission('category:read');
    const tenantId = session.tenantId;

    if (!tenantId) {
      throw new ValidationError('Tenant context is required', [
        { field: 'tenantId', message: 'No active tenant in session' },
      ]);
    }

    const params = await context?.params;
    const id = params?.id;
    if (!id) {
      throw new ValidationError('Category ID is required');
    }

    const category = await getCategoryById(tenantId, id);
    return category;
  }
);

/**
 * PATCH /api/v1/admin/categories/[id]
 * Updates a category.
 * Requires `category:update` permission.
 */
export const PATCH = withApiHandler<unknown, { id: string }>(
  async (req: NextRequest, context?: RouteContext<{ id: string }>) => {
    const session = await requirePermission('category:update');
    const tenantId = session.tenantId;

    if (!tenantId) {
      throw new ValidationError('Tenant context is required', [
        { field: 'tenantId', message: 'No active tenant in session' },
      ]);
    }

    const params = await context?.params;
    const id = params?.id;
    if (!id) {
      throw new ValidationError('Category ID is required');
    }

    const body = await req.json();
    const updated = await updateCategory(tenantId, id, body, session.userId);
    return updated;
  }
);

/**
 * DELETE /api/v1/admin/categories/[id]
 * Deletes or cascades a category.
 * Requires `category:delete` permission.
 */
export const DELETE = withApiHandler<unknown, { id: string }>(
  async (req: NextRequest, context?: RouteContext<{ id: string }>) => {
    const session = await requirePermission('category:delete');
    const tenantId = session.tenantId;

    if (!tenantId) {
      throw new ValidationError('Tenant context is required', [
        { field: 'tenantId', message: 'No active tenant in session' },
      ]);
    }

    const params = await context?.params;
    const id = params?.id;
    if (!id) {
      throw new ValidationError('Category ID is required');
    }

    const { searchParams } = new URL(req.url);
    const cascadeToInactive = searchParams.get('cascade') === 'true';

    const result = await deleteCategory(
      tenantId,
      id,
      session.userId,
      { cascadeToInactive }
    );

    return result;
  }
);
