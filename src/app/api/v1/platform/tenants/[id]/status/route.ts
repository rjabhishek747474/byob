import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import { errorResponse, successResponse, type RouteContext } from '@/lib/api/response';
import { requireAuth } from '@/lib/auth/context';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { getCorrelationId } from '@/lib/middleware/correlation';
import { updateTenantStatus } from '@/modules/tenant/tenant-service';

/**
 * Zod validation schema for updating tenant status.
 */
const updateStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'archived'], {
    message: "Status must be one of: 'active', 'suspended', 'archived'",
  }),
});

type TenantStatusRouteParams = { id: string };

/**
 * PATCH /api/v1/platform/tenants/[id]/status
 * Updates tenant lifecycle status (active, suspended, archived).
 * Requires `platform_admin` role.
 */
export async function PATCH(
  req: NextRequest,
  context?: RouteContext<TenantStatusRouteParams>
) {
  try {
    const session = await requireAuth();

    if (session.role !== 'platform_admin') {
      throw new ForbiddenError(
        'Platform admin role required to modify tenant lifecycle status'
      );
    }

    const params = await context?.params;
    const id = params?.id;

    if (!id || typeof id !== 'string') {
      throw new ValidationError('Tenant ID is required in URL parameter');
    }

    const correlationId = getCorrelationId(req);
    let rawBody: unknown;

    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON in request body');
    }

    const parseResult = updateStatusSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return errorResponse(parseResult.error, correlationId);
    }

    const updated = await updateTenantStatus(
      id,
      parseResult.data.status,
      session.userId,
      correlationId
    );

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}
