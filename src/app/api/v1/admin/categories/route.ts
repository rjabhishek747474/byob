import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { ValidationError } from '@/lib/errors';
import {
  createCategory,
  listCategories,
} from '@/modules/catalog/category-service';
import type { CategoryStatus } from '@/modules/catalog/types';

/**
 * GET /api/v1/admin/categories
 * Lists categories for the current tenant store.
 * Requires `category:read` permission.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const session = await requirePermission('category:read');
  const tenantId = session.tenantId;

  if (!tenantId) {
    throw new ValidationError('Tenant context is required', [
      { field: 'tenantId', message: 'No active tenant in session' },
    ]);
  }

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get('status') as CategoryStatus) || undefined;
  const parentIdParam = searchParams.get('parentId');
  const parentId =
    parentIdParam === 'null' ? null : parentIdParam ? parentIdParam : undefined;
  const includeChildren = searchParams.get('includeChildren') === 'true';

  const categoriesList = await listCategories(tenantId, {
    status,
    parentId,
    includeChildren,
  });

  return categoriesList;
});

/**
 * POST /api/v1/admin/categories
 * Creates a new category for the current tenant store.
 * Requires `category:create` permission.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  const session = await requirePermission('category:create');
  const tenantId = session.tenantId;

  if (!tenantId) {
    throw new ValidationError('Tenant context is required', [
      { field: 'tenantId', message: 'No active tenant in session' },
    ]);
  }

  const body = await req.json();
  const category = await createCategory(tenantId, body, session.userId);
  return category;
});
