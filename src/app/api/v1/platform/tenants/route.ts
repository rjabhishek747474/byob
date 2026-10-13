import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import { errorResponse, successResponse } from '@/lib/api/response';
import { requireAuth } from '@/lib/auth/context';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { getCorrelationId } from '@/lib/middleware/correlation';
import {
  createTenant,
  listTenants,
  type TenantStatus,
} from '@/modules/tenant/tenant-service';

/**
 * Zod validation schema for tenant creation payload.
 */
const createTenantSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters long')
    .max(255, 'Name must not exceed 255 characters'),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters long')
    .max(50, 'Slug must not exceed 50 characters'),
  ownerEmail: z
    .string()
    .email('Valid owner email address is required'),
  ownerName: z
    .string()
    .max(255)
    .optional()
    .nullable(),
  plan: z
    .string()
    .max(50)
    .optional(),
});

/**
 * GET /api/v1/platform/tenants
 * Lists tenants across the platform.
 * Requires `platform_admin` or `platform_support` role.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    if (session.role !== 'platform_admin' && session.role !== 'platform_support') {
      throw new ForbiddenError(
        'Platform admin or support role required to view platform tenants'
      );
    }

    const { searchParams } = new URL(req.url);
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
    const pageSize = searchParams.get('pageSize')
      ? Number(searchParams.get('pageSize'))
      : 20;
    const statusParam = searchParams.get('status');
    const search = searchParams.get('search') ?? undefined;

    const validStatuses: TenantStatus[] = ['active', 'suspended', 'archived'];
    const status = validStatuses.includes(statusParam as TenantStatus)
      ? (statusParam as TenantStatus)
      : undefined;

    const result = await listTenants({
      status,
      page,
      pageSize,
      search,
    });

    return successResponse(result.items, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}

/**
 * POST /api/v1/platform/tenants
 * Provisions a new tenant store with starter settings, theme, and draft page.
 * Requires `platform_admin` role.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    if (session.role !== 'platform_admin') {
      throw new ForbiddenError(
        'Platform admin role required to provision new tenants'
      );
    }

    const correlationId = getCorrelationId(req);
    let rawBody: unknown;

    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON in request body');
    }

    const parseResult = createTenantSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return errorResponse(parseResult.error, correlationId);
    }

    const { name, slug, ownerEmail, ownerName, plan } = parseResult.data;

    const created = await createTenant({
      name,
      slug,
      ownerEmail,
      ownerName: ownerName ?? undefined,
      plan: plan ?? 'free',
      actorId: session.userId,
      correlationId,
    });

    return successResponse(created, undefined, { status: 201 });
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}
