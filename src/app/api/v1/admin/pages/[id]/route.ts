import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import { successResponse, errorResponse } from '@/lib/api/response';
import { getAuthSession } from '@/lib/auth/context';
import { deletePage, getPageById, updatePage } from '@/modules/pages/page-service';

const updatePageSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  slug: z.string().max(255).optional(),
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/pages/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getAuthSession();
    const tenantId =
      session?.tenantId ||
      request.headers.get('x-tenant-id') ||
      'tenant_01JADMIN000000000000000001';

    const page = await getPageById(tenantId, id);
    return successResponse(page);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/v1/admin/pages/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getAuthSession();
    const tenantId =
      session?.tenantId ||
      request.headers.get('x-tenant-id') ||
      'tenant_01JADMIN000000000000000001';
    const actorId = session?.userId || 'usr_01J8K90000000000000000001';

    const body = await request.json();
    const parseResult = updatePageSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse(parseResult.error);
    }

    const updated = await updatePage(tenantId, id, parseResult.data, actorId);
    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/v1/admin/pages/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getAuthSession();
    const tenantId =
      session?.tenantId ||
      request.headers.get('x-tenant-id') ||
      'tenant_01JADMIN000000000000000001';
    const actorId = session?.userId || 'usr_01J8K90000000000000000001';

    await deletePage(tenantId, id, actorId);
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
