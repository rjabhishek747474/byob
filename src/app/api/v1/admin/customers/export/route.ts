import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/api/response';
import { requireAuth, requireTenantAccess } from '@/lib/auth/context';
import { getCorrelationId } from '@/lib/middleware/correlation';
import { BadRequestError } from '@/lib/errors';
import { exportCustomersCsv } from '@/modules/customers/customer-service';

/**
 * GET /api/v1/admin/customers/export
 * Exports customer records as a formula-injection safe CSV file.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const headerTenantId = req.headers.get('x-tenant-id');
    const tenantId = headerTenantId || session.tenantId;

    if (!tenantId) {
      throw new BadRequestError('Tenant context is required');
    }

    await requireTenantAccess(tenantId);

    const csvContent = await exportCustomersCsv(tenantId);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `customers-${tenantId.slice(-6)}-${dateStr}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'x-correlation-id': getCorrelationId(req),
      },
    });
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}
