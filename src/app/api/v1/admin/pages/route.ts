import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import { successResponse, errorResponse } from '@/lib/api/response';
import { getAuthSession, requireAuth } from '@/lib/auth/context';
import { createPage, listPages } from '@/modules/pages/page-service';
import { blockSchema } from '@/modules/pages/blocks/schemas';

const createPageSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  slug: z.string().max(255).optional(),
  pageType: z
    .enum(['home', 'collection', 'product', 'about', 'contact', 'policy', 'custom', 'landing'])
    .optional(),
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().optional(),
  initialBlocks: z.array(blockSchema).optional(),
});

/**
 * GET /api/v1/admin/pages
 * Lists all pages for the current authenticated tenant.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    // In multi-tenant admin, resolve tenantId from session or development tenant header
    const tenantId =
      session?.tenantId ||
      request.headers.get('x-tenant-id') ||
      'tenant_01JADMIN000000000000000001';

    const pages = await listPages(tenantId);
    return successResponse(pages);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/v1/admin/pages
 * Creates a new page within the tenant.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    const tenantId =
      session?.tenantId ||
      request.headers.get('x-tenant-id') ||
      'tenant_01JADMIN000000000000000001';
    const actorId = session?.userId || 'usr_01J8K90000000000000000001';

    const body = await request.json();
    const parseResult = createPageSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse(parseResult.error);
    }

    const newPage = await createPage(tenantId, parseResult.data, actorId);
    return successResponse(newPage, undefined as unknown as import('@/lib/api/response').ApiResponseMeta, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
