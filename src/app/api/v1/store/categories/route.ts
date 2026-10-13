import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/response';
import { NotFoundError } from '@/lib/errors';
import { resolveTenant } from '@/lib/middleware/tenant';
import { listCategories } from '@/modules/catalog/category-service';

/**
 * GET /api/v1/store/categories
 * Public Storefront API for retrieving active categories.
 * Tenant-scoped via resolved host/subdomain/header/slug.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const tenantContext = await resolveTenant(req);
  if (!tenantContext) {
    throw new NotFoundError('Store not found or unavailable');
  }

  const { searchParams } = new URL(req.url);
  const parentIdParam = searchParams.get('parentId');
  const parentId =
    parentIdParam === 'null' ? null : parentIdParam ? parentIdParam : undefined;
  const includeChildren = searchParams.get('includeChildren') === 'true';

  // Enforce storefront invariant: only active categories returned to storefront visitors
  const categoriesList = await listCategories(tenantContext.tenantId, {
    status: 'active',
    parentId,
    includeChildren,
  });

  return categoriesList;
});
