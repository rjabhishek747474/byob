import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api/response';
import { getCorrelationId } from '@/lib/middleware/correlation';
import { resolveTenant } from '@/lib/middleware/tenant';
import { BadRequestError } from '@/lib/errors';
import { getActiveBanners } from '@/modules/campaigns/campaign-service';

/**
 * GET /api/v1/store/banners
 * Public storefront endpoint retrieving active day-specific banner slides for today,
 * with automatic fallback to any-day default banners.
 */
export async function GET(req: NextRequest) {
  try {
    // Resolve tenant from header or domain host
    const tenantHeader = req.headers.get('x-tenant-id');
    let tenantId = tenantHeader;

    if (!tenantId) {
      const resolved = await resolveTenant(req);
      tenantId = resolved?.tenantId || null;
    }

    if (!tenantId) {
      throw new BadRequestError('Tenant context could not be identified');
    }

    const { searchParams } = new URL(req.url);
    const dayParam = searchParams.get('dayOfWeek');
    const dayOfWeek = dayParam !== null ? Number(dayParam) : undefined;

    const result = await getActiveBanners(tenantId, dayOfWeek);

    return successResponse(result);
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}
