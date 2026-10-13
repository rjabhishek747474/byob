import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import {
  getTheme,
  updateDraftTheme,
} from '@/modules/theme/theme-service';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/v1/admin/theme
 * Retrieves the theme settings (draft, published, contrast report) for the tenant.
 */
export const GET = withApiHandler(async (_req: NextRequest) => {
  const session = await requirePermission('theme:read');
  const tenantId = session.tenantId;

  if (!tenantId) {
    throw new ValidationError('Tenant context is required', [
      { field: 'tenantId', message: 'No active tenant in session' },
    ]);
  }

  const theme = await getTheme(tenantId);
  return theme;
});

/**
 * PATCH /api/v1/admin/theme
 * Updates the draft theme configuration.
 */
export const PATCH = withApiHandler(async (req: NextRequest) => {
  const session = await requirePermission('theme:update');
  const tenantId = session.tenantId;

  if (!tenantId) {
    throw new ValidationError('Tenant context is required', [
      { field: 'tenantId', message: 'No active tenant in session' },
    ]);
  }

  const body = await req.json();
  const updated = await updateDraftTheme(tenantId, body, session.userId);
  return updated;
});

