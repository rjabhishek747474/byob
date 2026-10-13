import { NextRequest } from 'next/server';
import { resolveTenant } from '@/lib/middleware/tenant';
import { successResponse, errorResponse } from '@/lib/api/response';
import { analyticsService } from '@/modules/analytics/analytics-service';
import { batchIngestionSchema } from '@/modules/analytics/types';
import { UnauthorizedError, ValidationError } from '@/lib/errors';
import { getCorrelationId } from '@/lib/middleware/correlation';

/**
 * POST /api/v1/analytics/events
 * Batch ingestion endpoint for behavioral telemetry events.
 */
export async function POST(req: NextRequest) {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) {
      throw new UnauthorizedError('Unable to resolve active tenant for event ingestion');
    }

    const correlationId = getCorrelationId(req);

    const body = await req.json().catch(() => null);
    if (!body) {
      throw new ValidationError('Invalid JSON body');
    }

    const parsed = batchIngestionSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((i) => i.message).join('; ')
      );
    }

    const result = await analyticsService.ingestEvents(
      tenant.tenantId,
      parsed.data.events,
      correlationId
    );

    return successResponse(result, undefined, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
