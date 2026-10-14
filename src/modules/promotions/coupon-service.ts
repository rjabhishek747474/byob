import { and, desc, eq, sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod/v4';
import { db } from '@/lib/db';
import { couponRedemptions, coupons } from '@/lib/db/schema';
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { createMoney, formatMoney } from '@/lib/money';
import { recordAuditLog } from '@/modules/audit/audit-service';

/**
 * Validation schema for coupon creation.
 */
export const createCouponSchema = z.object({
  code: z
    .string()
    .min(2, 'Coupon code must be at least 2 characters')
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, 'Coupon code can only contain alphanumeric characters, hyphens, and underscores'),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().int().positive('Discount value must be greater than zero'),
  minSubtotal: z.number().int().nonnegative().default(0),
  maxUses: z.number().int().positive().nullable().optional(),
  perCustomerLimit: z.number().int().positive().default(1),
  startsAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  isActive: z.boolean().default(true),
  eligibleProductIds: z.array(z.string()).nullable().optional(),
  eligibleCategoryIds: z.array(z.string()).nullable().optional(),
});

export const updateCouponSchema = createCouponSchema.partial();

export type CreateCouponInput = z.input<typeof createCouponSchema>;
export type UpdateCouponInput = z.input<typeof updateCouponSchema>;

export interface CouponValidationResult {
  valid: boolean;
  discountAmount: number; // minor units
  message: string;
  coupon?: {
    id: string;
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    minSubtotal: number;
  };
}

export interface CouponDto {
  id: string;
  tenantId: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minSubtotal: number;
  maxUses: number | null;
  usedCount: number;
  perCustomerLimit: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  eligibleProductIds: unknown;
  eligibleCategoryIds: unknown;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Lists all coupons belonging to a tenant.
 */
export async function listCoupons(tenantId: string): Promise<CouponDto[]> {
  if (!tenantId) {
    throw new BadRequestError('Tenant ID is required to list coupons');
  }

  const result = await db
    .select()
    .from(coupons)
    .where(eq(coupons.tenantId, tenantId))
    .orderBy(desc(coupons.createdAt));

  return result;
}

/**
 * Retrieves a single coupon by ID.
 */
export async function getCouponById(
  tenantId: string,
  id: string
): Promise<CouponDto> {
  if (!tenantId || !id) {
    throw new BadRequestError('Tenant ID and Coupon ID are required');
  }

  const [coupon] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.id, id), eq(coupons.tenantId, tenantId)))
    .limit(1);

  if (!coupon) {
    throw new NotFoundError(`Coupon not found: ${id}`);
  }

  return coupon;
}

/**
 * Creates a promotional coupon strictly isolated to the specified tenant.
 * The code is normalized to uppercase and verified for tenant-level uniqueness.
 */
export async function createCoupon(
  tenantId: string,
  data: CreateCouponInput,
  actorId: string
): Promise<CouponDto> {
  if (!tenantId) {
    throw new BadRequestError('Tenant ID is required to create a coupon');
  }

  const validated = createCouponSchema.parse(data);
  const normalizedCode = validated.code.trim().toUpperCase();

  // Percentage discount validation: capped at 100%
  if (validated.discountType === 'percentage' && validated.discountValue > 100) {
    throw new ValidationError('Percentage discount cannot exceed 100%');
  }

  // Date window validation
  if (validated.startsAt && validated.expiresAt && validated.startsAt > validated.expiresAt) {
    throw new ValidationError('Coupon start date cannot be after expiry date');
  }

  // Uniqueness check within tenant
  const [existing] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.tenantId, tenantId), eq(coupons.code, normalizedCode)))
    .limit(1);

  if (existing) {
    throw new ConflictError(`Coupon code "${normalizedCode}" already exists for this store`);
  }

  const id = ulid();
  const [created] = await db
    .insert(coupons)
    .values({
      id,
      tenantId,
      code: normalizedCode,
      discountType: validated.discountType,
      discountValue: validated.discountValue,
      minSubtotal: validated.minSubtotal,
      maxUses: validated.maxUses ?? null,
      usedCount: 0,
      perCustomerLimit: validated.perCustomerLimit,
      startsAt: validated.startsAt ?? null,
      expiresAt: validated.expiresAt ?? null,
      isActive: validated.isActive,
      eligibleProductIds: validated.eligibleProductIds ?? null,
      eligibleCategoryIds: validated.eligibleCategoryIds ?? null,
    })
    .returning();

  await recordAuditLog({
    tenantId,
    actorId,
    action: 'coupon:create',
    resourceType: 'coupon',
    resourceId: id,
    outcome: 'success',
    metadata: {
      code: normalizedCode,
      discountType: validated.discountType,
      discountValue: validated.discountValue,
    },
  });

  return created;
}

/**
 * Validates a coupon during cart checkout or storefront promotion testing.
 * Checks active status, date windows, usage limits, and calculates the discount minor units.
 */
export async function validateCoupon(
  tenantId: string,
  code: string,
  customerId?: string,
  subtotal: number = 0,
  _items?: unknown[]
): Promise<CouponValidationResult> {
  const safeSubtotal = typeof subtotal === 'number' && Number.isFinite(subtotal) ? Math.max(0, Math.floor(subtotal)) : 0;

  if (!tenantId || !code) {
    return {
      valid: false,
      discountAmount: 0,
      message: 'Tenant ID and coupon code are required',
    };
  }

  const normalizedCode = code.trim().toUpperCase();

  const [coupon] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.tenantId, tenantId), eq(coupons.code, normalizedCode)))
    .limit(1);

  if (!coupon) {
    return {
      valid: false,
      discountAmount: 0,
      message: `Coupon code "${normalizedCode}" is invalid`,
    };
  }

  if (!coupon.isActive) {
    return {
      valid: false,
      discountAmount: 0,
      message: 'This coupon is currently inactive',
    };
  }

  const now = new Date();

  // Validate start date
  if (coupon.startsAt && now < new Date(coupon.startsAt)) {
    return {
      valid: false,
      discountAmount: 0,
      message: 'This promotional coupon has not started yet',
    };
  }

  // Validate expiration date
  if (coupon.expiresAt && now > new Date(coupon.expiresAt)) {
    return {
      valid: false,
      discountAmount: 0,
      message: 'This coupon has expired',
    };
  }

  // Validate global max uses
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return {
      valid: false,
      discountAmount: 0,
      message: 'This coupon has reached its maximum redemption limit',
    };
  }

  // Validate minimum subtotal requirement
  if (coupon.minSubtotal > 0 && safeSubtotal < coupon.minSubtotal) {
    const minRequiredFormatted = formatMoney(createMoney(coupon.minSubtotal, 'INR'));
    return {
      valid: false,
      discountAmount: 0,
      message: `Minimum order subtotal of ${minRequiredFormatted} is required to use this coupon`,
    };
  }

  // Validate per-customer redemption limit
  if (customerId && coupon.perCustomerLimit > 0) {
    const [redemptionCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(couponRedemptions)
      .where(
        and(
          eq(couponRedemptions.tenantId, tenantId),
          eq(couponRedemptions.couponId, coupon.id),
          eq(couponRedemptions.customerId, customerId)
        )
      );

    const redemptionsSoFar = Number(redemptionCountResult?.count ?? 0);
    if (redemptionsSoFar >= coupon.perCustomerLimit) {
      return {
        valid: false,
        discountAmount: 0,
        message: 'You have already reached the maximum usage limit for this coupon',
      };
    }
  }

  // Calculate discount in minor units
  let discountAmount = 0;
  if (coupon.discountType === 'percentage') {
    discountAmount = Math.round((safeSubtotal * coupon.discountValue) / 100);
    discountAmount = Math.max(0, Math.min(discountAmount, safeSubtotal));
  } else {
    // Fixed amount discount
    discountAmount = Math.max(0, Math.min(coupon.discountValue, safeSubtotal));
  }

  return {
    valid: true,
    discountAmount,
    message: 'Coupon applied successfully',
    coupon: {
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minSubtotal: coupon.minSubtotal,
    },
  };
}

/**
 * Updates a coupon's active status.
 */
export async function updateCouponStatus(
  tenantId: string,
  id: string,
  isActive: boolean,
  actorId: string
): Promise<CouponDto> {
  if (!tenantId || !id) {
    throw new BadRequestError('Tenant ID and Coupon ID are required');
  }

  await getCouponById(tenantId, id);

  const [updated] = await db
    .update(coupons)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(coupons.id, id), eq(coupons.tenantId, tenantId)))
    .returning();

  await recordAuditLog({
    tenantId,
    actorId,
    action: 'coupon:status:update',
    resourceType: 'coupon',
    resourceId: id,
    outcome: 'success',
    metadata: { isActive },
  });

  return updated;
}

/**
 * Deletes a coupon.
 */
export async function deleteCoupon(
  tenantId: string,
  id: string,
  actorId: string
): Promise<void> {
  if (!tenantId || !id) {
    throw new BadRequestError('Tenant ID and Coupon ID are required');
  }

  await getCouponById(tenantId, id);

  await db
    .delete(coupons)
    .where(and(eq(coupons.id, id), eq(coupons.tenantId, tenantId)));

  await recordAuditLog({
    tenantId,
    actorId,
    action: 'coupon:delete',
    resourceType: 'coupon',
    resourceId: id,
    outcome: 'success',
  });
}

/**
 * Records a coupon redemption upon successful order completion.
 */
export async function recordCouponRedemption(
  tenantId: string,
  couponId: string,
  orderId: string,
  customerId: string | undefined,
  discountApplied: number
): Promise<void> {
  const redemptionId = ulid();

  await db.insert(couponRedemptions).values({
    id: redemptionId,
    tenantId,
    couponId,
    orderId,
    customerId: customerId ?? null,
    discountApplied,
  });

  // Increment used count on coupon
  await db
    .update(coupons)
    .set({
      usedCount: sql`${coupons.usedCount} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(coupons.id, couponId), eq(coupons.tenantId, tenantId)));
}
