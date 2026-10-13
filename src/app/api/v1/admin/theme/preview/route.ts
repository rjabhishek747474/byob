import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/response';
import { requireAuth } from '@/lib/auth/context';
import { evaluateThemeContrast } from '@/modules/theme/contrast';
import { validateThemeConfig } from '@/modules/theme/theme-service';

/**
 * POST /api/v1/admin/theme/preview
 * Validates candidate theme tokens and returns contrast analysis without persisting to the database.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  await requireAuth();

  const body = await req.json();
  const validated = validateThemeConfig(body);
  const contrastReport = evaluateThemeContrast(validated.colors);

  return {
    valid: true,
    theme: validated,
    contrastReport,
  };
});

