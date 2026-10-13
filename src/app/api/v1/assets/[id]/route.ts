import { NextRequest } from 'next/server';
import { RouteContext, withApiHandler } from '@/lib/api/response';
import { requireAuth, requirePermission } from '@/lib/auth/context';
import { deleteAsset, getAssetById } from '@/modules/assets/asset-service';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/v1/assets/[id]
 * Returns asset metadata scoped strictly to tenant.
 */
export const GET = withApiHandler<unknown, { id: string }>(
  async (_req: NextRequest, context?: RouteContext<{ id: string }>) => {
    const session = await requireAuth();
    const tenantId = session.tenantId;

    if (!tenantId) {
      throw new ValidationError('Tenant context is required', [
        { field: 'tenantId', message: 'No active tenant in session' },
      ]);
    }

    const params = await context?.params;
    const assetId = params?.id;
    if (!assetId || typeof assetId !== 'string') {
      throw new ValidationError('Asset ID parameter is missing', [
        { field: 'id', message: 'Asset ID is required' },
      ]);
    }

    const asset = await getAssetById(tenantId, assetId);
    return asset;
  }
);

/**
 * DELETE /api/v1/assets/[id]
 * Deletes asset scoped strictly to tenant. Requires `asset:delete` permission.
 */
export const DELETE = withApiHandler<unknown, { id: string }>(
  async (_req: NextRequest, context?: RouteContext<{ id: string }>) => {
    const session = await requirePermission('asset:delete');
    const tenantId = session.tenantId;

    if (!tenantId) {
      throw new ValidationError('Tenant context is required', [
        { field: 'tenantId', message: 'No active tenant in session' },
      ]);
    }

    const params = await context?.params;
    const assetId = params?.id;
    if (!assetId || typeof assetId !== 'string') {
      throw new ValidationError('Asset ID parameter is missing', [
        { field: 'id', message: 'Asset ID is required' },
      ]);
    }

    await deleteAsset(tenantId, assetId);
    return { deleted: true, id: assetId };
  }
);

