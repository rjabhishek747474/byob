import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api/response';
import { requireAuth, requireTenantAccess } from '@/lib/auth/context';
import { getCorrelationId } from '@/lib/middleware/correlation';
import { BadRequestError } from '@/lib/errors';
import { createCampaign, listCampaigns } from '@/modules/campaigns/campaign-service';

/**
 * GET /api/v1/admin/campaigns
 * Lists marketing campaigns for the active tenant.
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

    const { searchParams } = new URL(req.url);
    const dayParam = searchParams.get('dayOfWeek');
    const dayOfWeek = dayParam === 'null' ? null : dayParam !== null ? Number(dayParam) : undefined;
    const placement = searchParams.get('placement') || undefined;

    const items = await listCampaigns(tenantId, { dayOfWeek, placement });

    return successResponse(items);
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}

/**
 * POST /api/v1/admin/campaigns
 * Creates a new banner marketing campaign.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const headerTenantId = req.headers.get('x-tenant-id');
    const tenantId = headerTenantId || session.tenantId;

    if (!tenantId) {
      throw new BadRequestError('Tenant context is required');
    }

    await requireTenantAccess(tenantId);

    const body = await req.json();
    const campaign = await createCampaign(tenantId, body, session.userId);

    return successResponse(campaign, undefined, { status: 201 });
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}
