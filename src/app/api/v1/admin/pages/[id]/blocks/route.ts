import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import { successResponse, errorResponse } from '@/lib/api/response';
import { getAuthSession } from '@/lib/auth/context';
import { updateDraftBlocks } from '@/modules/pages/page-service';

const blocksPayloadSchema = z.object({
  blocks: z.array(z.unknown()),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/v1/admin/pages/[id]/blocks
 * Updates the draft blocks for a page.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getAuthSession();
    const tenantId =
      session?.tenantId ||
      request.headers.get('x-tenant-id') ||
      'tenant_01JADMIN000000000000000001';
    const actorId = session?.userId || 'usr_01J8K90000000000000000001';

    const body = await request.json();
    const parseResult = blocksPayloadSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse(parseResult.error);
    }

    const result = await updateDraftBlocks(
      tenantId,
      id,
      parseResult.data.blocks,
      actorId
    );

    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
