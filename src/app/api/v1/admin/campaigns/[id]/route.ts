import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api/response';
import { requireAuth, requireTenantAccess } from '@/lib/auth/context';
import { getCorrelationId } from '@/lib/middleware/correlation';
import { BadRequestError } from '@/lib/errors';
import {
  addBannerSlide,
  deleteCampaign,
  getCampaignById,
  reorderBannerSlides,
  updateCampaign,
} from '@/modules/campaigns/campaign-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/campaigns/[id]
 * Retrieves campaign details with all banner slides.
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

    const campaign = await getCampaignById(tenantId, id);
    return successResponse(campaign);
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}

/**
 * PATCH /api/v1/admin/campaigns/[id]
 * Updates campaign metadata, or performs slide addition / reorder operations.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const headerTenantId = req.headers.get('x-tenant-id');
    const tenantId = headerTenantId || session.tenantId;

    if (!tenantId) {
      throw new BadRequestError('Tenant context is required');
    }

    await requireTenantAccess(tenantId);

    const body = await req.json();

    // Check for sub-operations
    if (body.action === 'add_slide') {
      const slide = await addBannerSlide(tenantId, id, body.slide, session.userId);
      return successResponse(slide, undefined, { status: 201 });
    }

    if (body.action === 'reorder_slides') {
      const slides = await reorderBannerSlides(tenantId, id, body.slideIds, session.userId);
      return successResponse(slides);
    }

    const updated = await updateCampaign(tenantId, id, body, session.userId);
    return successResponse(updated);
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}

/**
 * DELETE /api/v1/admin/campaigns/[id]
 * Deletes campaign and all its slides.
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

    await deleteCampaign(tenantId, id, session.userId);
    return successResponse({ deleted: true, id });
  } catch (error) {
    return errorResponse(error, getCorrelationId(req));
  }
}
