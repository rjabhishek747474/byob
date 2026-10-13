import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import { successResponse, errorResponse } from '@/lib/api/response';
import { getAuthSession } from '@/lib/auth/context';
import { rollbackPage } from '@/modules/pages/page-service';

const rollbackPayloadSchema = z.object({
  targetVersion: z.number().int().positive('targetVersion must be a positive integer'),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/admin/pages/[id]/rollback
 * Restores blocks from an earlier version snapshot into a new draft.
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

    const body = await request.json();
    const parseResult = rollbackPayloadSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse(parseResult.error);
    }

    const result = await rollbackPage(
      tenantId,
      id,
      parseResult.data.targetVersion,
      actorId
    );

    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
