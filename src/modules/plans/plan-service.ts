import { and, desc, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod/v4';
import { db } from '@/lib/db';
import { customerSubscriptions, customers, subscriptionPlans } from '@/lib/db/schema';
import { BadRequestError, NotFoundError, ValidationError } from '@/lib/errors';
import { createMoney, formatMoney } from '@/lib/money';
import { recordAuditLog } from '@/modules/audit/audit-service';

/**
 * Mandatory compliance notice for MVP commerce subscriptions.
 */
export const MVP_SUBSCRIPTION_DISCLAIMER =
  'Notice: Automatic recurring card debits are not enabled in this MVP release. Membership plans operate strictly on manual upfront renewals or prepaid terms.';

export const createSubscriptionPlanSchema = z.object({
  name: z.string().min(2, 'Plan name must be at least 2 characters').max(255),
  description: z.string().max(1000).nullable().optional(),
  price: z.number().int().nonnegative('Price in minor units must be non-negative'),
  currency: z.string().length(3).default('INR'),
  durationDays: z.number().int().positive('Duration in days must be greater than zero'),
  isVisible: z.boolean().default(true),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const updateSubscriptionPlanSchema = createSubscriptionPlanSchema.partial();

export type CreateSubscriptionPlanInput = z.input<typeof createSubscriptionPlanSchema>;
export type UpdateSubscriptionPlanInput = z.input<typeof updateSubscriptionPlanSchema>;

export interface SubscriptionPlanDto {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  price: number;
  priceFormatted: string;
  currency: string;
  durationDays: number;
  isVisible: boolean;
  status: 'active' | 'inactive';
  disclaimer: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerSubscriptionItem {
  id: string;
  tenantId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  planId: string;
  planName: string;
  status: 'active' | 'expired' | 'cancelled';
  startDate: Date;
  endDate: Date;
}

/**
 * Lists all subscription plans defined for a tenant.
 */
export async function listSubscriptionPlans(tenantId: string): Promise<{
  plans: SubscriptionPlanDto[];
  disclaimer: string;
}> {
  if (!tenantId) {
    throw new BadRequestError('Tenant ID is required to list subscription plans');
  }

  const rows = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.tenantId, tenantId))
    .orderBy(desc(subscriptionPlans.createdAt));

  const plans: SubscriptionPlanDto[] = rows.map((p) => {
    const money = createMoney(p.price, p.currency);
    return {
      id: p.id,
      tenantId: p.tenantId,
      name: p.name,
      description: p.description,
      price: p.price,
      priceFormatted: formatMoney(money),
      currency: p.currency,
      durationDays: p.durationDays,
      isVisible: p.isVisible,
      status: p.status,
      disclaimer: MVP_SUBSCRIPTION_DISCLAIMER,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  });

  return {
    plans,
    disclaimer: MVP_SUBSCRIPTION_DISCLAIMER,
  };
}

/**
 * Creates a new subscription plan scoped to the tenant.
 */
export async function createSubscriptionPlan(
  tenantId: string,
  data: CreateSubscriptionPlanInput,
  actorId: string
): Promise<SubscriptionPlanDto> {
  if (!tenantId) {
    throw new BadRequestError('Tenant ID is required to create a subscription plan');
  }

  const validated = createSubscriptionPlanSchema.parse(data);
  const id = ulid();

  const [created] = await db
    .insert(subscriptionPlans)
    .values({
      id,
      tenantId,
      name: validated.name,
      description: validated.description ?? null,
      price: validated.price,
      currency: validated.currency,
      durationDays: validated.durationDays,
      isVisible: validated.isVisible,
      status: validated.status,
    })
    .returning();

  await recordAuditLog({
    tenantId,
    actorId,
    action: 'plan:create',
    resourceType: 'subscription_plan',
    resourceId: id,
    outcome: 'success',
    metadata: { name: validated.name, price: validated.price },
  });

  const money = createMoney(created.price, created.currency);
  return {
    ...created,
    priceFormatted: formatMoney(money),
    disclaimer: MVP_SUBSCRIPTION_DISCLAIMER,
  };
}

/**
 * Updates an existing subscription plan.
 */
export async function updateSubscriptionPlan(
  tenantId: string,
  id: string,
  data: UpdateSubscriptionPlanInput,
  actorId: string
): Promise<SubscriptionPlanDto> {
  if (!tenantId || !id) {
    throw new BadRequestError('Tenant ID and Plan ID are required');
  }

  const validated = updateSubscriptionPlanSchema.parse(data);

  const [existing] = await db
    .select()
    .from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.id, id), eq(subscriptionPlans.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError(`Subscription plan not found: ${id}`);
  }

  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (validated.name !== undefined) updateValues.name = validated.name;
  if (validated.description !== undefined) updateValues.description = validated.description;
  if (validated.price !== undefined) updateValues.price = validated.price;
  if (validated.durationDays !== undefined) updateValues.durationDays = validated.durationDays;
  if (validated.isVisible !== undefined) updateValues.isVisible = validated.isVisible;
  if (validated.status !== undefined) updateValues.status = validated.status;

  const [updated] = await db
    .update(subscriptionPlans)
    .set(updateValues)
    .where(and(eq(subscriptionPlans.id, id), eq(subscriptionPlans.tenantId, tenantId)))
    .returning();

  await recordAuditLog({
    tenantId,
    actorId,
    action: 'plan:update',
    resourceType: 'subscription_plan',
    resourceId: id,
    outcome: 'success',
  });

  const money = createMoney(updated.price, updated.currency);
  return {
    ...updated,
    priceFormatted: formatMoney(money),
    disclaimer: MVP_SUBSCRIPTION_DISCLAIMER,
  };
}

/**
 * Deletes a subscription plan.
 */
export async function deleteSubscriptionPlan(
  tenantId: string,
  id: string,
  actorId: string
): Promise<void> {
  if (!tenantId || !id) {
    throw new BadRequestError('Tenant ID and Plan ID are required');
  }

  const [existing] = await db
    .select()
    .from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.id, id), eq(subscriptionPlans.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError(`Subscription plan not found: ${id}`);
  }

  await db
    .delete(subscriptionPlans)
    .where(and(eq(subscriptionPlans.id, id), eq(subscriptionPlans.tenantId, tenantId)));

  await recordAuditLog({
    tenantId,
    actorId,
    action: 'plan:delete',
    resourceType: 'subscription_plan',
    resourceId: id,
    outcome: 'success',
  });
}

/**
 * Lists subscribed customer memberships for a tenant.
 */
export async function listCustomerSubscriptions(
  tenantId: string,
  options?: { status?: string }
): Promise<{
  subscriptions: CustomerSubscriptionItem[];
  disclaimer: string;
}> {
  if (!tenantId) {
    throw new BadRequestError('Tenant ID is required to list customer subscriptions');
  }

  const conditions = [eq(customerSubscriptions.tenantId, tenantId)];
  if (options?.status) {
    if (!['active', 'expired', 'cancelled'].includes(options.status)) {
      throw new ValidationError(`Invalid subscription status filter: ${options.status}`);
    }
    conditions.push(eq(customerSubscriptions.status, options.status as 'active' | 'expired' | 'cancelled'));
  }

  const subs = await db
    .select({
      id: customerSubscriptions.id,
      tenantId: customerSubscriptions.tenantId,
      customerId: customerSubscriptions.customerId,
      customerName: customers.name,
      customerEmail: customers.email,
      planId: customerSubscriptions.planId,
      planName: subscriptionPlans.name,
      status: customerSubscriptions.status,
      startDate: customerSubscriptions.startDate,
      endDate: customerSubscriptions.endDate,
    })
    .from(customerSubscriptions)
    .leftJoin(customers, eq(customerSubscriptions.customerId, customers.id))
    .leftJoin(subscriptionPlans, eq(customerSubscriptions.planId, subscriptionPlans.id))
    .where(and(...conditions))
    .orderBy(desc(customerSubscriptions.createdAt));

  const items: CustomerSubscriptionItem[] = subs.map((s) => ({
    id: s.id,
    tenantId: s.tenantId,
    customerId: s.customerId,
    customerName: s.customerName || 'Shopper',
    customerEmail: s.customerEmail || 'N/A',
    planId: s.planId,
    planName: s.planName || 'Membership Plan',
    status: s.status,
    startDate: s.startDate,
    endDate: s.endDate,
  }));

  return {
    subscriptions: items,
    disclaimer: MVP_SUBSCRIPTION_DISCLAIMER,
  };
}
