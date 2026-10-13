import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/response';
import { requirePermission } from '@/lib/auth/context';
import { importTheme } from '@/modules/theme/theme-service';
import { ValidationError } from '@/lib/errors';

/**
 * POST /api/v1/admin/theme/import
 * Imports and strictly validates a JSON theme package, rejecting unsupported or malicious tokens.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  const session = await requirePermission('theme:update');
  const tenantId = session.tenantId;

  if (!tenantId) {
    throw new ValidationError('Tenant context is required', [
      { field: 'tenantId', message: 'No active tenant in session' },
    ]);
  }

  const body = await req.json();
  const imported = await importTheme(tenantId, body, session.userId);
  return imported;
});

