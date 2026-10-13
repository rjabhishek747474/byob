import { NextRequest } from 'next/server';
import { resolveTenant } from '@/lib/middleware/tenant';
import { successResponse, errorResponse } from '@/lib/api/response';
import { analyticsService } from '@/modules/analytics/analytics-service';
import { recordConsentSchema } from '@/modules/analytics/types';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

/**
 * POST /api/v1/analytics/consent
 * Logs or updates cookie & tracking consent preferences per visitor/customer.
 */
export async function POST(req: NextRequest) {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) {
      throw new UnauthorizedError('Unable to resolve active tenant for consent logging');
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      throw new ValidationError('Invalid JSON body');
    }

    const parsed = recordConsentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((i) => i.message).join('; ')
      );
    }

    const result = await analyticsService.recordConsent(
      tenant.tenantId,
      parsed.data.visitorId,
      parsed.data.policyVersion,
      parsed.data.categoriesGranted,
      parsed.data.customerId
    );

    return successResponse(result, undefined as unknown as import('@/lib/api/response').ApiResponseMeta, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
