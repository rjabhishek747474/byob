import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api/response';
import { getAuthSession } from '@/lib/auth/context';
import { publishPage } from '@/modules/pages/page-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/admin/pages/[id]/publish
 * Publishes the current draft blocks with strict schema, CTA, and asset isolation validation.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getAuthSession();
    const tenantId =
      session?.tenantId ||
      request.headers.get('x-tenant-id') ||
      'tenant_01JADMIN000000000000000001';
    const actorId = session?.userId || 'usr_01J8K90000000000000000001';

    const result = await publishPage(tenantId, id, actorId);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
