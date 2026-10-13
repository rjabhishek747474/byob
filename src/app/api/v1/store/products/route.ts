import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/response';
import { NotFoundError } from '@/lib/errors';
import { resolveTenant } from '@/lib/middleware/tenant';
import { listProducts } from '@/modules/catalog/product-service';
import type { ProductFilterOptions } from '@/modules/catalog/types';

/**
 * GET /api/v1/store/products
 * Public Storefront API for retrieving active products.
 * Tenant-scoped via resolved host/subdomain/header/slug.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const tenantContext = await resolveTenant(req);
  if (!tenantContext) {
    throw new NotFoundError('Store not found or unavailable');
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || undefined;
  const categoryId = searchParams.get('categoryId') || undefined;
  const isFeatured =
    searchParams.get('isFeatured') === 'true'
      ? true
      : searchParams.get('isFeatured') === 'false'
        ? false
        : undefined;
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
  const pageSize = searchParams.get('pageSize')
    ? Number(searchParams.get('pageSize'))
    : 20;
  const sort = (searchParams.get('sort') as ProductFilterOptions['sort']) || undefined;

  // Enforce storefront invariant: only active products are returned to public customers
  const result = await listProducts(tenantContext.tenantId, {
    search,
    categoryId,
    status: 'active',
    isFeatured,
    page,
    pageSize,
    sort,
  });

  return {
    items: result.items,
    meta: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    },
  };
});
