import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { successResponse, errorResponse } from '@/lib/api/response';
import { analyticsService } from '@/modules/analytics/analytics-service';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/v1/admin/analytics/funnel
 * Returns 6-step conversion funnel with drop-off percentages per step.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const tenantId = session.tenantId;
    if (!tenantId) {
      throw new ValidationError('No active tenant associated with this session');
    }

    const url = req.nextUrl;
    const fromParam = url.searchParams.get('fromDate');
    const toParam = url.searchParams.get('toDate');

    const toDate = toParam ? new Date(toParam) : new Date();
    const fromDate = fromParam
      ? new Date(fromParam)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new ValidationError('Invalid date parameter format');
    }

    const funnel = await analyticsService.getConversionFunnel(tenantId, {
      fromDate,
      toDate,
    });

    return successResponse({
      funnel,
      dateRange: {
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
      },
      freshness: 'Events processed in real time',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
