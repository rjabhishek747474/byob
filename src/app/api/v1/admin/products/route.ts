import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { ValidationError } from '@/lib/errors';
import {
  createProduct,
  listProducts,
} from '@/modules/catalog/product-service';
import type { ProductFilterOptions, ProductStatus } from '@/modules/catalog/types';

/**
 * GET /api/v1/admin/products
 * Lists products for the current tenant store.
 * Requires `product:read` permission.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const session = await requirePermission('product:read');
  const tenantId = session.tenantId;

  if (!tenantId) {
    throw new ValidationError('Tenant context is required', [
      { field: 'tenantId', message: 'No active tenant in session' },
    ]);
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || undefined;
  const categoryId = searchParams.get('categoryId') || undefined;
  const status = (searchParams.get('status') as ProductStatus) || undefined;
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

  const result = await listProducts(tenantId, {
    search,
    categoryId,
    status,
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

/**
 * POST /api/v1/admin/products
 * Creates a new product for the current tenant store.
 * Requires `product:create` permission.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  const session = await requirePermission('product:create');
  const tenantId = session.tenantId;

  if (!tenantId) {
    throw new ValidationError('Tenant context is required', [
      { field: 'tenantId', message: 'No active tenant in session' },
    ]);
  }

  const body = await req.json();
  const product = await createProduct(tenantId, body, session.userId);
  return product;
});
