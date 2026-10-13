import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api/response';
import { getAuthSession } from '@/lib/auth/context';
import { listPageVersions } from '@/modules/pages/page-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/pages/[id]/versions
 * Lists all version snapshots for the specified page.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await getAuthSession();
    const tenantId =
      session?.tenantId ||
      request.headers.get('x-tenant-id') ||
      'tenant_01JADMIN000000000000000001';

    const versions = await listPageVersions(tenantId, id);
    return successResponse(versions);
  } catch (error) {
    return errorResponse(error);
  }
}
