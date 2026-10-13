import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { publishTheme } from '@/modules/theme/theme-service';
import { ValidationError } from '@/lib/errors';

/**
 * POST /api/v1/admin/theme/publish
 * Copies draft theme config to published, increments version, and logs audit record.
 */
export const POST = withApiHandler(async (_req: NextRequest) => {
  const session = await requirePermission('theme:publish');
  const tenantId = session.tenantId;

  if (!tenantId) {
    throw new ValidationError('Tenant context is required', [
      { field: 'tenantId', message: 'No active tenant in session' },
    ]);
  }

  const published = await publishTheme(tenantId, session.userId);
  return published;
});

