import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api/response';
import { requireAuth, requireTenantAccess } from '@/lib/auth/context';
import { getCorrelationId } from '@/lib/middleware/correlation';
import { BadRequestError } from '@/lib/errors';
import {
  deleteCustomerData,
  getCustomerDetails,
} from '@/modules/customers/customer-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/customers/[id]
 * Retrieves customer profile, order history, and saved addresses.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const headerTenantId = req.headers.get('x-tenant-id');
    const tenantId = headerTenantId || session.tenantId;

    if (!tenantId) {
      throw new BadRequestError('Tenant context is required');
    }

    await requireTenantAccess(tenantId);

    const details = await getCustomerDetails(tenantId, id);
    return successResponse(details);
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}

/**
 * DELETE /api/v1/admin/customers/[id]
 * GDPR / DPDP Right to Erasure anonymization endpoint.
 * Anonymizes personal PII while preserving financial orders for tax compliance.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const headerTenantId = req.headers.get('x-tenant-id');
    const tenantId = headerTenantId || session.tenantId;

    if (!tenantId) {
      throw new BadRequestError('Tenant context is required');
    }

    await requireTenantAccess(tenantId);

    const result = await deleteCustomerData(tenantId, id, session.userId);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}
