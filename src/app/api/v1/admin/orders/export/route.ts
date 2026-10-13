import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/context';
import { ValidationError } from '@/lib/errors';
import { exportOrdersCsv } from '@/modules/orders/order-service';

/**
 * GET /api/v1/admin/orders/export
 * Exports orders matching filter as a CSV spreadsheet.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const session = await requirePermission('order:export');
  const tenantId = session.tenantId;

  if (!tenantId) {
    throw new ValidationError('Tenant context is required');
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status') || undefined;

  const csvContent = await exportOrdersCsv(tenantId, { status });

  const filename = `orders-${tenantId.slice(-6)}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

