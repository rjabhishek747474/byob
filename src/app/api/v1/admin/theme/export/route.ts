import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { exportTheme } from '@/modules/theme/theme-service';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/v1/admin/theme/export
 * Exports validated clean theme configuration package for download/backup.
 */
export const GET = withApiHandler(async (_req: NextRequest) => {
  const session = await requirePermission('theme:read');
  const tenantId = session.tenantId;

  if (!tenantId) {
    throw new ValidationError('Tenant context is required', [
      { field: 'tenantId', message: 'No active tenant in session' },
    ]);
  }

  const exported = await exportTheme(tenantId);
  return exported;
});

