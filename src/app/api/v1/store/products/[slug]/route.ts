import { NextRequest } from 'next/server';
import { RouteContext, withApiHandler } from '@/lib/api/response';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { resolveTenant } from '@/lib/middleware/tenant';
import { getProductBySlug } from '@/modules/catalog/product-service';

/**
 * GET /api/v1/store/products/[slug]
 * Public Storefront API for retrieving an active product by slug.
 * Tenant-scoped via resolved host/subdomain/header/slug.
 * Enforces product status must be 'active'.
 */
export const GET = withApiHandler<unknown, { slug: string }>(
  async (_req: NextRequest, context?: RouteContext<{ slug: string }>) => {
    const tenantContext = await resolveTenant(_req);
    if (!tenantContext) {
      throw new NotFoundError('Store not found or unavailable');
    }

    const params = await context?.params;
    const slug = params?.slug;
    if (!slug) {
      throw new ValidationError('Product slug is required');
    }

    const product = await getProductBySlug(tenantContext.tenantId, slug);
    if (!product || product.status !== 'active') {
      throw new NotFoundError(`Product '${slug}' not found`);
    }

    // Filter to only active variants for storefront display
    const activeVariants = product.variants?.filter((v) => v.isActive) ?? [];

    return {
      ...product,
      variants: activeVariants,
    };
  }
);
