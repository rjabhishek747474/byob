import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db } from '@/lib/db';
import type { DbOrTx } from '@/lib/db';
import {
  addresses,
  cartItems,
  carts,
  customers,
  orderItems,
  orderStatusHistory,
  orders,
} from '@/lib/db/schema/orders';
import { inventoryMovements, productVariants, products, productImages } from '@/lib/db/schema/catalog';
import { coupons, couponRedemptions } from '@/lib/db/schema/content';
import { storeSettings } from '@/lib/db/schema/store';
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import { generateId } from '@/lib/utils';
import { recordAuditLog } from '@/modules/audit/audit-service';

/**
 * Zod schema for checkout input validation.
 */
export const shippingAddressSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(255),
  addressLine1: z.string().min(1, 'Address line 1 is required').max(500),
  addressLine2: z.string().max(500).optional(),
  city: z.string().min(1, 'City is required').max(255),
  state: z.string().min(1, 'State is required').max(255),
  postalCode: z.string().min(1, 'Postal code is required').max(20),
  country: z.string().max(100).default('India'),
  phone: z.string().max(50).optional(),
});

export const checkoutInputSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  shippingAddress: shippingAddressSchema,
  customerEmail: z.string().email('Valid email is required').max(255),
  customerPhone: z.string().max(50).optional(),
  customerName: z.string().min(1, 'Customer name is required').max(255),
  paymentMode: z.enum(['cod', 'online']).default('cod'),
  couponCode: z.string().max(100).optional(),
  idempotencyKey: z.string().min(1, 'Idempotency key is required').max(255),
  notes: z.string().max(1000).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

/**
 * Processed checkout order summary.
 */
export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  publicToken: string;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  taxAmount: number;
  total: number;
  currency: string;
  status: string;
  paymentMode: string;
  paymentStatus: string;
  isExistingOrder?: boolean;
}

/**
 * Generates human-friendly order numbers: e.g. ORD-100234
 */
function generateOrderNumber(): string {
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `ORD-${randomDigits}`;
}

/**
 * Processes checkout in an atomic transaction:
 * 1. Checks idempotency: if idempotencyKey already exists for tenant, returns existing order safely.
 * 2. In transaction:
 *    - Re-validates cart items against DB products and variants.
 *    - Re-validates stock for every variant using pessimistic locking (for update / atomic decrement).
 *    - Rollbacks if insufficient stock with ValidationError.
 *    - Atomically decrements stock and inserts inventoryMovements.
 *    - Re-calculates subtotal, delivery fee, and taxes.
 *    - Re-validates coupon if provided, creates couponRedemptions, increments usedCount.
 *    - Calculates final total = max(0, subtotal - discount + deliveryFee + tax).
 *    - Creates or updates customers record.
 *    - Generates orderNumber and unguessable publicToken (ULID).
 *    - Creates orders and immutable snapshots of address & items.
 *    - Inserts orderStatusHistory.
 *    - Clears cart items.
 *    - Records audit log.
 *
 * @param tenantId - Tenant identifier
 * @param input - Validated or unvalidated checkout parameters
 * @param correlationId - Optional request correlation ID
 */
export async function processCheckout(
  tenantId: string,
  rawInput: CheckoutInput,
  correlationId?: string
): Promise<CheckoutResult> {
  if (!tenantId) {
    throw new ValidationError('Tenant context is required');
  }

  const input = checkoutInputSchema.parse(rawInput);

  // 1. Idempotency Check: if idempotencyKey already used for this tenant, return existing order safely
  const existingOrder = await db.query.orders.findFirst({
    where: and(
      eq(orders.tenantId, tenantId),
      eq(orders.idempotencyKey, input.idempotencyKey)
    ),
  });

  if (existingOrder) {
    return {
      orderId: existingOrder.id,
      orderNumber: existingOrder.orderNumber,
      publicToken: existingOrder.publicToken,
      subtotal: existingOrder.subtotal,
      discountAmount: existingOrder.discountAmount,
      deliveryFee: existingOrder.deliveryFee,
      taxAmount: existingOrder.taxAmount,
      total: existingOrder.total,
      currency: existingOrder.currency,
      status: existingOrder.status,
      paymentMode: existingOrder.paymentMode,
      paymentStatus: existingOrder.paymentStatus,
      isExistingOrder: true,
    };
  }

  // Execute checkout in a managed database transaction
  return await db.transaction(async (tx) => {
    // A. Fetch active cart
    const cart = await tx.query.carts.findFirst({
      where: and(
        eq(carts.tenantId, tenantId),
        eq(carts.sessionId, input.sessionId)
      ),
      with: {
        items: true,
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new ValidationError('Your shopping cart is empty');
    }

    // B. Re-validate cart items against current database products and variants
    const rawCartItems = cart.items;
    const variantIds = rawCartItems.map((item) => item.variantId);

    // Pessimistic Locking: Lock variant rows FOR UPDATE to prevent race conditions
    // In Drizzle ORM: tx.select().from(productVariants).where(...).for('update')
    const lockedVariants = await tx
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        sku: productVariants.sku,
        name: productVariants.name,
        priceOverride: productVariants.priceOverride,
        stockQuantity: productVariants.stockQuantity,
        isActive: productVariants.isActive,
      })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.tenantId, tenantId),
          sql`${productVariants.id} IN ${variantIds}`
        )
      )
      .for('update');

    const variantMap = new Map(lockedVariants.map((v) => [v.id, v]));

    // Fetch products
    const productIds = Array.from(new Set(lockedVariants.map((v) => v.productId)));
    const lockedProducts = await tx
      .select({
        id: products.id,
        title: products.title,
        status: products.status,
        listPrice: products.listPrice,
        salePrice: products.salePrice,
        deliveryFeeOverride: products.deliveryFeeOverride,
      })
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId),
          sql`${products.id} IN ${productIds}`
        )
      );

    const productMap = new Map(lockedProducts.map((p) => [p.id, p]));

    // Fetch primary product images
    const images = productIds.length > 0
      ? await tx
          .select({
            productId: productImages.productId,
            assetId: productImages.assetId,
          })
          .from(productImages)
          .where(
            and(
              eq(productImages.tenantId, tenantId),
              sql`${productImages.productId} IN ${productIds}`
            )
          )
          .orderBy(productImages.sortOrder)
      : [];

    const imageMap = new Map<string, string>();
    for (const img of images) {
      if (!imageMap.has(img.productId)) {
        imageMap.set(img.productId, img.assetId);
      }
    }

    // C. Validate stock and calculate subtotal
    let subtotal = 0;
    interface PreparedItem {
      variantId: string;
      productId: string;
      productTitle: string;
      variantName: string | null;
      sku: string;
      unitPrice: number;
      quantity: number;
      lineTotal: number;
      imageUrl: string | null;
    }

    const preparedItems: PreparedItem[] = [];

    for (const cartItem of rawCartItems) {
      const variant = variantMap.get(cartItem.variantId);
      if (!variant) {
        throw new ValidationError(`Variant '${cartItem.variantId}' is no longer available`);
      }

      const product = productMap.get(variant.productId);
      if (!product || product.status !== 'active' || !variant.isActive) {
        throw new ValidationError(`Product '${product?.title || variant.sku}' is not currently available`);
      }

      // Stock re-validation
      if (variant.stockQuantity < cartItem.quantity) {
        throw new ValidationError(
          `Item '${product.title}${variant.name ? ` (${variant.name})` : ''}' has only ${variant.stockQuantity} units left in stock`,
          [
            {
              field: 'stockQuantity',
              message: `Requested ${cartItem.quantity}, but only ${variant.stockQuantity} units available`,
            },
          ]
        );
      }

      // Server-authoritative unit price in minor units
      const unitPrice =
        variant.priceOverride !== null && variant.priceOverride !== undefined
          ? variant.priceOverride
          : product.salePrice !== null && product.salePrice !== undefined
          ? product.salePrice
          : product.listPrice;

      const lineTotal = unitPrice * cartItem.quantity;
      subtotal += lineTotal;

      preparedItems.push({
        variantId: variant.id,
        productId: product.id,
        productTitle: product.title,
        variantName: variant.name,
        sku: variant.sku,
        unitPrice,
        quantity: cartItem.quantity,
        lineTotal,
        imageUrl: imageMap.get(product.id) ?? null,
      });
    }

    // D. Fetch store delivery settings
    const settings = await tx.query.storeSettings.findFirst({
      where: eq(storeSettings.tenantId, tenantId),
    });

    let deliveryFee = settings?.deliveryFeeDefault ?? 0;
    if (
      settings?.freeDeliveryThreshold !== null &&
      settings?.freeDeliveryThreshold !== undefined &&
      subtotal >= settings.freeDeliveryThreshold
    ) {
      deliveryFee = 0;
    }

    // Check if any product has delivery fee override
    for (const p of lockedProducts) {
      if (p.deliveryFeeOverride !== null && p.deliveryFeeOverride !== undefined) {
        // If highest override applies or defaults
        deliveryFee = Math.max(deliveryFee, p.deliveryFeeOverride);
      }
    }

    // E. Coupon validation & discount calculation
    let discountAmount = 0;
    let redeemedCouponId: string | null = null;
    let redeemedCouponCode: string | null = null;

    if (input.couponCode) {
      const cleanCouponCode = input.couponCode.trim().toUpperCase();
      const now = new Date();

      const [coupon] = await tx
        .select()
        .from(coupons)
        .where(
          and(
            eq(coupons.tenantId, tenantId),
            sql`UPPER(${coupons.code}) = ${cleanCouponCode}`
          )
        )
        .for('update');

      if (!coupon) {
        throw new ValidationError(`Coupon '${input.couponCode}' is invalid`, [
          { field: 'couponCode', message: 'Coupon code not found' },
        ]);
      }

      if (!coupon.isActive) {
        throw new ValidationError(`Coupon '${input.couponCode}' is inactive`, [
          { field: 'couponCode', message: 'Coupon is no longer active' },
        ]);
      }

      if (coupon.startsAt && new Date(coupon.startsAt) > now) {
        throw new ValidationError(`Coupon '${input.couponCode}' has not started yet`, [
          { field: 'couponCode', message: 'Coupon promotion has not started' },
        ]);
      }

      if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
        throw new ValidationError(`Coupon '${input.couponCode}' has expired`, [
          { field: 'couponCode', message: 'Coupon code expired' },
        ]);
      }

      if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
        throw new ValidationError(`Coupon '${input.couponCode}' usage limit has been reached`, [
          { field: 'couponCode', message: 'Coupon usage limit exceeded' },
        ]);
      }

      if (subtotal < coupon.minSubtotal) {
        throw new ValidationError(
          `Minimum order subtotal of ${coupon.minSubtotal / 100} required for coupon '${input.couponCode}'`,
          [{ field: 'couponCode', message: `Order subtotal must be at least ₹${coupon.minSubtotal / 100}` }]
        );
      }

      // Calculate discount amount in minor units
      if (coupon.discountType === 'percentage') {
        discountAmount = Math.round((subtotal * coupon.discountValue) / 100);
      } else {
        // fixed amount
        discountAmount = Math.min(subtotal, coupon.discountValue);
      }

      redeemedCouponId = coupon.id;
      redeemedCouponCode = coupon.code;
    }

    // F. Final total calculation: max(0, subtotal - discount + deliveryFee + tax)
    const taxAmount = 0; // MVP tax included in prices or flat 0
    const total = Math.max(0, subtotal - discountAmount + deliveryFee + taxAmount);

    // G. Create or update customer record
    let customer = await tx.query.customers.findFirst({
      where: and(
        eq(customers.tenantId, tenantId),
        eq(customers.email, input.customerEmail)
      ),
    });

    const now = new Date();
    if (!customer) {
      const newCustomerId = generateId();
      const [createdCustomer] = await tx
        .insert(customers)
        .values({
          id: newCustomerId,
          tenantId,
          email: input.customerEmail,
          phone: input.customerPhone ?? null,
          name: input.customerName,
          marketingConsent: false,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      customer = createdCustomer;
    } else {
      // Update phone or name if provided
      const [updatedCustomer] = await tx
        .update(customers)
        .set({
          name: input.customerName,
          phone: input.customerPhone ?? customer.phone,
          updatedAt: now,
        })
        .where(
          and(
            eq(customers.tenantId, tenantId),
            eq(customers.id, customer.id)
          )
        )
        .returning();
      customer = updatedCustomer;
    }

    // Check perCustomerLimit for coupon if applicable
    if (redeemedCouponId && customer) {
      const [redemptionCount] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(couponRedemptions)
        .where(
          and(
            eq(couponRedemptions.tenantId, tenantId),
            eq(couponRedemptions.couponId, redeemedCouponId),
            eq(couponRedemptions.customerId, customer.id)
          )
        );

      const couponRec = await tx.query.coupons.findFirst({
        where: eq(coupons.id, redeemedCouponId),
      });

      if (couponRec && redemptionCount.count >= couponRec.perCustomerLimit) {
        throw new ValidationError(
          `You have already reached the maximum usage limit for coupon '${input.couponCode}'`,
          [{ field: 'couponCode', message: 'Per-customer coupon usage limit reached' }]
        );
      }
    }

    // H. Generate unguessable publicToken (ULID) and human-friendly orderNumber
    const orderId = generateId();
    const publicToken = generateId(); // ULID for unguessable tracking
    const orderNumber = generateOrderNumber();

    // I. Atomically decrement stock and insert inventoryMovements
    for (const item of preparedItems) {
      await tx
        .update(productVariants)
        .set({
          stockQuantity: sql`${productVariants.stockQuantity} - ${item.quantity}`,
          updatedAt: now,
        })
        .where(
          and(
            eq(productVariants.tenantId, tenantId),
            eq(productVariants.id, item.variantId)
          )
        );

      await tx.insert(inventoryMovements).values({
        id: generateId(),
        tenantId,
        variantId: item.variantId,
        delta: -item.quantity,
        reason: 'order_placed',
        referenceId: orderId,
        actorId: null, // System checkout operation
      });
    }

    // J. Create immutable address snapshot
    const addressId = generateId();
    await tx.insert(addresses).values({
      id: addressId,
      tenantId,
      customerId: customer.id,
      orderId,
      fullName: input.shippingAddress.fullName,
      addressLine1: input.shippingAddress.addressLine1,
      addressLine2: input.shippingAddress.addressLine2 ?? null,
      city: input.shippingAddress.city,
      state: input.shippingAddress.state,
      postalCode: input.shippingAddress.postalCode,
      country: input.shippingAddress.country ?? 'India',
      phone: input.shippingAddress.phone ?? input.customerPhone ?? null,
    });

    // K. Create orders record
    const [createdOrder] = await tx
      .insert(orders)
      .values({
        id: orderId,
        tenantId,
        orderNumber,
        publicToken,
        customerId: customer.id,
        status: 'pending_confirmation',
        paymentMode: input.paymentMode,
        paymentStatus: input.paymentMode === 'online' ? 'pending' : 'pending',
        subtotal,
        discountAmount,
        deliveryFee,
        taxAmount,
        total,
        currency: 'INR',
        couponCode: redeemedCouponCode,
        couponId: redeemedCouponId,
        addressSnapshot: {
          fullName: input.shippingAddress.fullName,
          addressLine1: input.shippingAddress.addressLine1,
          addressLine2: input.shippingAddress.addressLine2 ?? null,
          city: input.shippingAddress.city,
          state: input.shippingAddress.state,
          postalCode: input.shippingAddress.postalCode,
          country: input.shippingAddress.country ?? 'India',
          phone: input.shippingAddress.phone ?? input.customerPhone ?? null,
          email: input.customerEmail,
        },
        idempotencyKey: input.idempotencyKey,
        notes: input.notes ?? null,
      })
      .returning();

    // L. Create immutable orderItems snapshots
    for (const item of preparedItems) {
      await tx.insert(orderItems).values({
        id: generateId(),
        tenantId,
        orderId,
        productId: item.productId,
        variantId: item.variantId,
        productTitle: item.productTitle,
        variantName: item.variantName,
        sku: item.sku,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        imageUrl: item.imageUrl,
      });
    }

    // M. Record coupon redemption if coupon applied
    if (redeemedCouponId) {
      await tx.insert(couponRedemptions).values({
        id: generateId(),
        tenantId,
        couponId: redeemedCouponId,
        orderId,
        customerId: customer.id,
        discountApplied: discountAmount,
      });

      await tx
        .update(coupons)
        .set({
          usedCount: sql`${coupons.usedCount} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(coupons.tenantId, tenantId),
            eq(coupons.id, redeemedCouponId)
          )
        );
    }

    // N. Create initial orderStatusHistory record
    await tx.insert(orderStatusHistory).values({
      id: generateId(),
      tenantId,
      orderId,
      oldStatus: null,
      newStatus: 'pending_confirmation',
      reason: 'Order placed by customer',
      actorId: null,
    });

    // O. Clear cart items
    await tx
      .delete(cartItems)
      .where(
        and(
          eq(cartItems.tenantId, tenantId),
          eq(cartItems.cartId, cart.id)
        )
      );

    // P. Record audit log
    await recordAuditLog(
      {
        tenantId,
        actorId: customer.id,
        action: 'order:create',
        resourceType: 'order',
        resourceId: orderId,
        outcome: 'success',
        metadata: {
          orderNumber,
          total,
          itemCount: preparedItems.length,
          paymentMode: input.paymentMode,
        },
        correlationId,
      },
      tx
    );

    return {
      orderId: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
      publicToken: createdOrder.publicToken,
      subtotal: createdOrder.subtotal,
      discountAmount: createdOrder.discountAmount,
      deliveryFee: createdOrder.deliveryFee,
      taxAmount: createdOrder.taxAmount,
      total: createdOrder.total,
      currency: createdOrder.currency,
      status: createdOrder.status,
      paymentMode: createdOrder.paymentMode,
      paymentStatus: createdOrder.paymentStatus,
      isExistingOrder: false,
    };
  });
}

