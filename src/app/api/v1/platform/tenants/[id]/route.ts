import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import { errorResponse, successResponse, type RouteContext } from '@/lib/api/response';
import { requireAuth } from '@/lib/auth/context';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { getCorrelationId } from '@/lib/middleware/correlation';
import {
  getTenantById,
  updateTenant,
} from '@/modules/tenant/tenant-service';

/**
 * Zod schema for updating tenant metadata.
 */
const updateTenantSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters long')
      .max(255, 'Name must not exceed 255 characters')
      .optional(),
    plan: z
      .string()
      .min(1, 'Plan must not be empty')
      .max(50, 'Plan must not exceed 50 characters')
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.plan !== undefined, {
    message: 'At least one field (name or plan) must be provided for update',
  });

type TenantRouteParams = { id: string };

/**
 * GET /api/v1/platform/tenants/[id]
 * Retrieves details for a specific tenant by ID.
 * Requires `platform_admin` or `platform_support` role.
 */
export async function GET(
  req: NextRequest,
  context?: RouteContext<TenantRouteParams>
) {
  try {
    const session = await requireAuth();

    if (session.role !== 'platform_admin' && session.role !== 'platform_support') {
      throw new ForbiddenError(
        'Platform admin or support role required to view tenant details'
      );
    }

    const params = await context?.params;
    const id = params?.id;

    if (!id || typeof id !== 'string') {
      throw new ValidationError('Tenant ID is required in URL parameter');
    }

    const tenant = await getTenantById(id);
    return successResponse(tenant);
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}

/**
 * PATCH /api/v1/platform/tenants/[id]
 * Updates metadata for a specific tenant (e.g. name, plan).
 * Requires `platform_admin` role.
 */
export async function PATCH(
  req: NextRequest,
  context?: RouteContext<TenantRouteParams>
) {
  try {
    const session = await requireAuth();

    if (session.role !== 'platform_admin') {
      throw new ForbiddenError(
        'Platform admin role required to update tenant metadata'
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

    const parseResult = updateTenantSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return errorResponse(parseResult.error, correlationId);
    }

    const updatedTenant = await updateTenant(
      id,
      parseResult.data,
      session.userId,
      correlationId
    );

    return successResponse(updatedTenant);
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}
