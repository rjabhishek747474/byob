import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod/v4';
import { db } from '@/lib/db';
import { bannerSlides, campaigns } from '@/lib/db/schema';
import { BadRequestError, NotFoundError, ValidationError } from '@/lib/errors';
import { recordAuditLog } from '@/modules/audit/audit-service';

/**
 * Validation schema for campaign creation and update.
 */
export const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(255),
  placement: z.string().max(50).default('homepage'),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const bannerSlideSchema = z.object({
  assetId: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional().or(z.literal('')),
  altText: z.string().max(500).nullable().optional(),
  heading: z.string().max(255).nullable().optional(),
  subheading: z.string().nullable().optional(),
  ctaLabel: z.string().max(100).nullable().optional(),
  ctaHref: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export type CreateCampaignInput = z.input<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.input<typeof updateCampaignSchema>;
export type BannerSlideInput = z.input<typeof bannerSlideSchema>;

export interface BannerSlideDto {
  id: string;
  tenantId: string;
  campaignId: string;
  assetId: string | null;
  imageUrl: string | null;
  altText: string | null;
  heading: string | null;
  subheading: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  sortOrder: number;
  createdAt: Date;
}

export interface CampaignWithSlides {
  id: string;
  tenantId: string;
  name: string;
  placement: string;
  dayOfWeek: number | null;
  startDate: Date | null;
  endDate: Date | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  slides: BannerSlideDto[];
}

export interface ActiveBannersResult {
  dayOfWeek: number;
  isDaySpecific: boolean;
  campaigns: CampaignWithSlides[];
  slides: BannerSlideDto[];
}

/**
 * Lists all marketing campaigns configured for a tenant.
 */
export async function listCampaigns(
  tenantId: string,
  options?: { dayOfWeek?: number | null; placement?: string }
): Promise<CampaignWithSlides[]> {
  if (!tenantId) {
    throw new BadRequestError('Tenant ID is required to list campaigns');
  }

  const conditions = [eq(campaigns.tenantId, tenantId)];

  if (options?.dayOfWeek !== undefined) {
    if (options.dayOfWeek === null) {
      conditions.push(isNull(campaigns.dayOfWeek));
    } else {
      conditions.push(eq(campaigns.dayOfWeek, options.dayOfWeek));
    }
  }

  if (options?.placement) {
    conditions.push(eq(campaigns.placement, options.placement));
  }

  const foundCampaigns = await db
    .select()
    .from(campaigns)
    .where(and(...conditions))
    .orderBy(asc(campaigns.sortOrder), desc(campaigns.createdAt));

  if (foundCampaigns.length === 0) {
    return [];
  }

  const campaignIds = foundCampaigns.map((c) => c.id);
  const slides = await db
    .select()
    .from(bannerSlides)
    .where(and(eq(bannerSlides.tenantId, tenantId), inArray(bannerSlides.campaignId, campaignIds)))
    .orderBy(asc(bannerSlides.sortOrder), asc(bannerSlides.createdAt));

  const slidesByCampaign = new Map<string, BannerSlideDto[]>();
  for (const s of slides) {
    const list = slidesByCampaign.get(s.campaignId) || [];
    list.push(s);
    slidesByCampaign.set(s.campaignId, list);
  }

  return foundCampaigns.map((c) => ({
    ...c,
    slides: slidesByCampaign.get(c.id) || [],
  }));
}

/**
 * Retrieves a single campaign with slides.
 */
export async function getCampaignById(
  tenantId: string,
  id: string
): Promise<CampaignWithSlides> {
  if (!tenantId || !id) {
    throw new BadRequestError('Tenant ID and Campaign ID are required');
  }

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
    .limit(1);

  if (!campaign) {
    throw new NotFoundError(`Campaign not found: ${id}`);
  }

  const slides = await db
    .select()
    .from(bannerSlides)
    .where(and(eq(bannerSlides.tenantId, tenantId), eq(bannerSlides.campaignId, id)))
    .orderBy(asc(bannerSlides.sortOrder), asc(bannerSlides.createdAt));

  return {
    ...campaign,
    slides,
  };
}

/**
 * 7-Day Day-Specific Banner Scheduler:
 * Retrieves active banners for the given day of the week (0 = Sun, 1 = Mon ... 6 = Sat).
 * If no active day-specific campaigns with slides exist for today, gracefully falls back
 * to default/any-day banners (where dayOfWeek IS NULL).
 *
 * @param tenantId - The tenant ULID
 * @param targetDay - Day of week (0-6). Defaults to current server day.
 */
export async function getActiveBanners(
  tenantId: string,
  targetDay?: number
): Promise<ActiveBannersResult> {
  if (!tenantId) {
    throw new BadRequestError('Tenant ID is required to fetch active banners');
  }

  const dayOfWeek = targetDay !== undefined ? targetDay : new Date().getDay();
  if (dayOfWeek < 0 || dayOfWeek > 6) {
    throw new ValidationError(`Invalid dayOfWeek: ${dayOfWeek}. Must be between 0 (Sunday) and 6 (Saturday).`);
  }

  const now = new Date();

  // Helper to query active campaigns
  const fetchActiveByDay = async (day: number | null) => {
    const dayCondition = day === null ? isNull(campaigns.dayOfWeek) : eq(campaigns.dayOfWeek, day);

    const activeList = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.tenantId, tenantId),
          eq(campaigns.isActive, true),
          dayCondition
        )
      )
      .orderBy(asc(campaigns.sortOrder), desc(campaigns.createdAt));

    // Filter by date window in application layer for reliable timezone/null handling
    const eligible = activeList.filter((c) => {
      if (c.startDate && new Date(c.startDate) > now) return false;
      if (c.endDate && new Date(c.endDate) < now) return false;
      return true;
    });

    if (eligible.length === 0) return { campaigns: [], slides: [] };

    const ids = eligible.map((c) => c.id);
    const slides = await db
      .select()
      .from(bannerSlides)
      .where(and(eq(bannerSlides.tenantId, tenantId), inArray(bannerSlides.campaignId, ids)))
      .orderBy(asc(bannerSlides.sortOrder), asc(bannerSlides.createdAt));

    const slidesByCamp = new Map<string, BannerSlideDto[]>();
    for (const s of slides) {
      const list = slidesByCamp.get(s.campaignId) || [];
      list.push(s);
      slidesByCamp.set(s.campaignId, list);
    }

    const fullCampaigns: CampaignWithSlides[] = eligible.map((c) => ({
      ...c,
      slides: slidesByCamp.get(c.id) || [],
    }));

    return { campaigns: fullCampaigns, slides };
  };

  // 1. Try today's specific banners
  const daySpecific = await fetchActiveByDay(dayOfWeek);
  if (daySpecific.slides.length > 0) {
    return {
      dayOfWeek,
      isDaySpecific: true,
      campaigns: daySpecific.campaigns,
      slides: daySpecific.slides,
    };
  }

  // 2. Fall back to default / any-day banners (dayOfWeek is null)
  const fallback = await fetchActiveByDay(null);
  return {
    dayOfWeek,
    isDaySpecific: false,
    campaigns: fallback.campaigns,
    slides: fallback.slides,
  };
}

/**
 * Creates a marketing banner campaign scoped to a tenant.
 */
export async function createCampaign(
  tenantId: string,
  data: CreateCampaignInput,
  actorId: string
): Promise<CampaignWithSlides> {
  if (!tenantId) {
    throw new BadRequestError('Tenant ID is required to create a campaign');
  }

  const validated = createCampaignSchema.parse(data);

  if (validated.startDate && validated.endDate && validated.startDate > validated.endDate) {
    throw new ValidationError('Campaign startDate cannot be after endDate');
  }

  const id = ulid();
  const [created] = await db
    .insert(campaigns)
    .values({
      id,
      tenantId,
      name: validated.name,
      placement: validated.placement,
      dayOfWeek: validated.dayOfWeek ?? null,
      startDate: validated.startDate ?? null,
      endDate: validated.endDate ?? null,
      isActive: validated.isActive,
      sortOrder: validated.sortOrder,
    })
    .returning();

  await recordAuditLog({
    tenantId,
    actorId,
    action: 'campaign:create',
    resourceType: 'campaign',
    resourceId: id,
    outcome: 'success',
    metadata: { name: validated.name, dayOfWeek: validated.dayOfWeek },
  });

  return {
    ...created,
    slides: [],
  };
}

/**
 * Updates a marketing campaign.
 */
export async function updateCampaign(
  tenantId: string,
  id: string,
  data: UpdateCampaignInput,
  actorId: string
): Promise<CampaignWithSlides> {
  if (!tenantId || !id) {
    throw new BadRequestError('Tenant ID and Campaign ID are required');
  }

  const validated = updateCampaignSchema.parse(data);

  const existing = await getCampaignById(tenantId, id);

  const newStartDate = validated.startDate !== undefined ? validated.startDate : existing.startDate;
  const newEndDate = validated.endDate !== undefined ? validated.endDate : existing.endDate;

  if (newStartDate && newEndDate && newStartDate > newEndDate) {
    throw new ValidationError('Campaign startDate cannot be after endDate');
  }

  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (validated.name !== undefined) updateValues.name = validated.name;
  if (validated.placement !== undefined) updateValues.placement = validated.placement;
  if (validated.dayOfWeek !== undefined) updateValues.dayOfWeek = validated.dayOfWeek;
  if (validated.startDate !== undefined) updateValues.startDate = validated.startDate;
  if (validated.endDate !== undefined) updateValues.endDate = validated.endDate;
  if (validated.isActive !== undefined) updateValues.isActive = validated.isActive;
  if (validated.sortOrder !== undefined) updateValues.sortOrder = validated.sortOrder;

  const [updated] = await db
    .update(campaigns)
    .set(updateValues)
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
    .returning();

  await recordAuditLog({
    tenantId,
    actorId,
    action: 'campaign:update',
    resourceType: 'campaign',
    resourceId: id,
    outcome: 'success',
    metadata: { changed: Object.keys(validated) },
  });

  const slides = await db
    .select()
    .from(bannerSlides)
    .where(and(eq(bannerSlides.tenantId, tenantId), eq(bannerSlides.campaignId, id)))
    .orderBy(asc(bannerSlides.sortOrder), asc(bannerSlides.createdAt));

  return {
    ...updated,
    slides,
  };
}

/**
 * Deletes a marketing campaign and its associated banner slides.
 */
export async function deleteCampaign(
  tenantId: string,
  id: string,
  actorId: string
): Promise<void> {
  if (!tenantId || !id) {
    throw new BadRequestError('Tenant ID and Campaign ID are required');
  }

  await getCampaignById(tenantId, id);

  await db
    .delete(bannerSlides)
    .where(and(eq(bannerSlides.tenantId, tenantId), eq(bannerSlides.campaignId, id)));

  await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)));

  await recordAuditLog({
    tenantId,
    actorId,
    action: 'campaign:delete',
    resourceType: 'campaign',
    resourceId: id,
    outcome: 'success',
  });
}

/**
 * Adds a banner slide to a marketing campaign.
 */
export async function addBannerSlide(
  tenantId: string,
  campaignId: string,
  slideData: BannerSlideInput,
  actorId: string
): Promise<BannerSlideDto> {
  if (!tenantId || !campaignId) {
    throw new BadRequestError('Tenant ID and Campaign ID are required');
  }

  // Ensure parent campaign belongs to tenant
  await getCampaignById(tenantId, campaignId);

  const validated = bannerSlideSchema.parse(slideData);
  const slideId = ulid();

  const [slide] = await db
    .insert(bannerSlides)
    .values({
      id: slideId,
      tenantId,
      campaignId,
      assetId: validated.assetId ?? null,
      imageUrl: validated.imageUrl || null,
      altText: validated.altText ?? null,
      heading: validated.heading ?? null,
      subheading: validated.subheading ?? null,
      ctaLabel: validated.ctaLabel ?? null,
      ctaHref: validated.ctaHref ?? null,
      sortOrder: validated.sortOrder,
    })
    .returning();

  await recordAuditLog({
    tenantId,
    actorId,
    action: 'campaign:slide:add',
    resourceType: 'banner_slide',
    resourceId: slideId,
    outcome: 'success',
    metadata: { campaignId },
  });

  return slide;
}

/**
 * Reorders banner slides within a campaign.
 */
export async function reorderBannerSlides(
  tenantId: string,
  campaignId: string,
  slideIds: string[],
  actorId: string
): Promise<BannerSlideDto[]> {
  if (!tenantId || !campaignId) {
    throw new BadRequestError('Tenant ID and Campaign ID are required');
  }

  await getCampaignById(tenantId, campaignId);

  // Update sortOrder for each slide sequentially
  for (let i = 0; i < slideIds.length; i++) {
    const sId = slideIds[i];
    await db
      .update(bannerSlides)
      .set({ sortOrder: i })
      .where(
        and(
          eq(bannerSlides.id, sId),
          eq(bannerSlides.campaignId, campaignId),
          eq(bannerSlides.tenantId, tenantId)
        )
      );
  }

  await recordAuditLog({
    tenantId,
    actorId,
    action: 'campaign:slides:reorder',
    resourceType: 'campaign',
    resourceId: campaignId,
    outcome: 'success',
    metadata: { slideIdsCount: slideIds.length },
  });

  return db
    .select()
    .from(bannerSlides)
    .where(and(eq(bannerSlides.tenantId, tenantId), eq(bannerSlides.campaignId, campaignId)))
    .orderBy(asc(bannerSlides.sortOrder));
}

/**
 * Deletes a single banner slide.
 */
export async function deleteBannerSlide(
  tenantId: string,
  slideId: string,
  actorId: string
): Promise<void> {
  if (!tenantId || !slideId) {
    throw new BadRequestError('Tenant ID and Slide ID are required');
  }

  const [slide] = await db
    .select()
    .from(bannerSlides)
    .where(and(eq(bannerSlides.id, slideId), eq(bannerSlides.tenantId, tenantId)))
    .limit(1);

  if (!slide) {
    throw new NotFoundError(`Banner slide not found: ${slideId}`);
  }

  await db
    .delete(bannerSlides)
    .where(and(eq(bannerSlides.id, slideId), eq(bannerSlides.tenantId, tenantId)));

  await recordAuditLog({
    tenantId,
    actorId,
    action: 'campaign:slide:delete',
    resourceType: 'banner_slide',
    resourceId: slideId,
    outcome: 'success',
  });
}
