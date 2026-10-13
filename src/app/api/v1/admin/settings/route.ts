import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import {
  getStoreSettings,
  updateStoreSettings,
} from '@/modules/settings/settings-service';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/v1/admin/settings
 * Retrieves tenant store settings.
 */
export const GET = withApiHandler(async (_req: NextRequest) => {
  const session = await requirePermission('store:settings:read');
  const tenantId = session.tenantId;

  if (!tenantId) {
    throw new ValidationError('Tenant context is required', [
      { field: 'tenantId', message: 'No active tenant in session' },
    ]);
  }

  const settings = await getStoreSettings(tenantId);
  return settings;
});

/**
 * PATCH /api/v1/admin/settings
 * Updates tenant store settings.
 */
export const PATCH = withApiHandler(async (req: NextRequest) => {
  const session = await requirePermission('store:settings:update');
  const tenantId = session.tenantId;

  if (!tenantId) {
    throw new ValidationError('Tenant context is required', [
      { field: 'tenantId', message: 'No active tenant in session' },
    ]);
  }

  const body = await req.json();
  const updated = await updateStoreSettings(tenantId, body, session.userId);
  return updated;
});

