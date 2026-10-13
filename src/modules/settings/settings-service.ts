import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod/v4';
import { db } from '@/lib/db';
import { auditLogs, storeSettings } from '@/lib/db/schema';
import { NotFoundError, ValidationError } from '@/lib/errors';

export const updateStoreSettingsSchema = z.object({
  storeName: z.string().min(1).max(255).optional(),
  timezone: z.string().min(1).max(50).optional(),
  locale: z.string().min(1).max(10).optional(),
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/, 'Currency must be 3 uppercase letters')
    .optional(),
  logoAssetId: z.string().nullable().optional(),
  faviconAssetId: z.string().nullable().optional(),
  contactEmail: z.string().email('Invalid email address').nullable().optional(),
  contactPhone: z
    .string()
    .max(50)
    .regex(/^(\+?[0-9\s\-()]+)?$/, 'Invalid phone number format')
    .nullable()
    .optional(),
  address: z.string().nullable().optional(),
  socialFacebook: z.string().url('Invalid Facebook URL').nullable().optional().or(z.literal('')),
  socialInstagram: z.string().url('Invalid Instagram URL').nullable().optional().or(z.literal('')),
  socialTwitter: z.string().url('Invalid Twitter/X URL').nullable().optional().or(z.literal('')),
  socialYoutube: z.string().url('Invalid YouTube URL').nullable().optional().or(z.literal('')),
  socialWhatsapp: z.string().max(500).nullable().optional(),
  announcementText: z.string().nullable().optional(),
  announcementActive: z.boolean().optional(),
  deliveryFeeDefault: z
    .number()
    .int('Delivery fee must be integer minor units')
    .min(0, 'Delivery fee cannot be negative')
    .optional(),
  freeDeliveryThreshold: z
    .number()
    .int('Threshold must be integer minor units')
    .min(0)
    .nullable()
    .optional(),
  analyticsEnabled: z.boolean().optional(),
  consentRequired: z.boolean().optional(),
  metaTitle: z.string().max(255).nullable().optional(),
  metaDescription: z.string().nullable().optional(),
});

export type UpdateStoreSettingsInput = z.infer<typeof updateStoreSettingsSchema>;

export type StoreSettingsDto = typeof storeSettings.$inferSelect;

/**
 * Retrieves store settings for a specific tenant, creating default row if none exists.
 */
export async function getStoreSettings(tenantId: string): Promise<StoreSettingsDto> {
  const [existing] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.tenantId, tenantId))
    .limit(1);

  if (existing) {
    return existing;
  }

  // Create default store settings if not initialized yet
  const newId = ulid();
  const [created] = await db
    .insert(storeSettings)
    .values({
      id: newId,
      tenantId,
      storeName: 'My Online Store',
      timezone: 'Asia/Kolkata',
      locale: 'en-IN',
      currency: 'INR',
      deliveryFeeDefault: 0,
      analyticsEnabled: true,
      consentRequired: true,
      announcementActive: false,
    })
    .returning();

  return created;
}

/**
 * Updates store settings, validates inputs, and records an audit log.
 */
export async function updateStoreSettings(
  tenantId: string,
  data: UpdateStoreSettingsInput,
  actorId: string
): Promise<StoreSettingsDto> {
  const parsed = updateStoreSettingsSchema.safeParse(data);
  if (!parsed.success) {
    throw new ValidationError(
      'Invalid store settings',
      parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))
    );
  }

  // Ensure record exists
  const current = await getStoreSettings(tenantId);
  if (!current) {
    throw new NotFoundError(`Store settings not found for tenant: ${tenantId}`);
  }

  const cleanData = parsed.data;

  // Clean empty string URLs to null
  const sanitizedUpdate: Record<string, unknown> = {
    ...cleanData,
    socialFacebook: cleanData.socialFacebook === '' ? null : cleanData.socialFacebook,
    socialInstagram: cleanData.socialInstagram === '' ? null : cleanData.socialInstagram,
    socialTwitter: cleanData.socialTwitter === '' ? null : cleanData.socialTwitter,
    socialYoutube: cleanData.socialYoutube === '' ? null : cleanData.socialYoutube,
    updatedAt: new Date(),
  };

  const [updated] = await db
    .update(storeSettings)
    .set(sanitizedUpdate)
    .where(eq(storeSettings.tenantId, tenantId))
    .returning();

  // Record audit log
  await db.insert(auditLogs).values({
    id: ulid(),
    tenantId,
    actorId,
    action: 'store:settings:update',
    resourceType: 'store_settings',
    resourceId: updated.id,
    outcome: 'success',
    metadata: {
      changedKeys: Object.keys(cleanData),
      previousSettings: {
        storeName: current.storeName,
        currency: current.currency,
        deliveryFeeDefault: current.deliveryFeeDefault,
      },
    },
  });

  return updated;
}

