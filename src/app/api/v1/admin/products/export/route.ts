import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/context';
import { ValidationError } from '@/lib/errors';
import { exportProductsCsv } from '@/modules/catalog/product-service';

/**
 * GET /api/v1/admin/products/export
 * Exports product and variant catalog to CSV.
 * Requires `product:export` permission.
 * Streams/attaches CSV content directly with safe injection escaping.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await requirePermission('product:export');
    const tenantId = session.tenantId;

    if (!tenantId) {
      throw new ValidationError('Tenant context is required', [
        { field: 'tenantId', message: 'No active tenant in session' },
      ]);
    }

    const csvData = await exportProductsCsv(tenantId);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `products-export-${dateStr}.csv`;

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'UnauthorizedError') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: err.message } },
        { status: 401 }
      );
    }
    if (err instanceof Error && err.name === 'ForbiddenError') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: err.message } },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Failed to export products',
        },
      },
      { status: 500 }
    );
  }
}
