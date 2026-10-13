import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { successResponse, errorResponse } from '@/lib/api/response';
import { analyticsService } from '@/modules/analytics/analytics-service';
import { ValidationError } from '@/lib/errors';

/**
 * Parses fromDate and toDate query parameters from request URL with defaults (last 30 days).
 */
function parseDateRange(req: NextRequest): { fromDate: Date; toDate: Date } {
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

  return { fromDate, toDate };
}

/**
 * GET /api/v1/admin/analytics/overview
 * Returns high-level funnel metrics, last observed step breakdown, and verified revenue attribution.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const tenantId = session.tenantId;
    if (!tenantId) {
      throw new ValidationError('No active tenant associated with this session');
    }

    const { fromDate, toDate } = parseDateRange(req);

    const [funnel, revenue, lastObserved] = await Promise.all([
      analyticsService.getConversionFunnel(tenantId, { fromDate, toDate }),
      analyticsService.getRevenueAttribution(tenantId, { fromDate, toDate }),
      analyticsService.getLastObservedSteps(tenantId, { fromDate, toDate }),
    ]);

    return successResponse({
      funnel,
      revenue,
      lastObserved,
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
