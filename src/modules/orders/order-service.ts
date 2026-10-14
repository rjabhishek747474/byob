import { and, desc, eq, gte, lte, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import type { DbOrTx } from '@/lib/db';
import {
  addresses,
  customers,
  orderItems,
  orderStatusHistory,
  orders,
} from '@/lib/db/schema/orders';
import { inventoryMovements, productVariants } from '@/lib/db/schema/catalog';
import { users } from '@/lib/db/schema/tenants';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { csvEscape, generateId } from '@/lib/utils';
import { recordAuditLog } from '@/modules/audit/audit-service';
import { isValidStatusTransition, type OrderStatus } from './state-machine';

/**
 * Filter and pagination options for listing orders.
 */
export interface ListOrdersOptions {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Public order tracking response payload (PII-minimized).
 */
export interface PublicOrderTracking {
  orderNumber: string;
  status: string;
  createdAt: Date;
  statusHistory: Array<{
    status: string;
    timestamp: Date;
    reason?: string | null;
  }>;
  items: Array<{
    productTitle: string;
    variantName?: string | null;
    quantity: number;
    imageUrl?: string | null;
  }>;
  deliveryStatus: string;
}

/**
 * Retrieves an order by ID within the tenant scope, including items and status history.
 *
 * @param tenantId - Tenant identifier
 * @param orderId - Order identifier
 * @param tx - Optional transaction handle
 */
export async function getOrderById(
  tenantId: string,
  orderId: string,
  tx?: DbOrTx
) {
  const executor = tx ?? db;

  const order = await executor.query.orders.findFirst({
    where: and(
      eq(orders.tenantId, tenantId),
      eq(orders.id, orderId)
    ),
    with: {
      customer: true,
      items: true,
      statusHistory: {
        orderBy: [desc(orderStatusHistory.createdAt)],
      },
    },
  });

  if (!order) {
    throw new NotFoundError(`Order '${orderId}' not found`);
  }

  return order;
}

/**
 * Updates order status using state machine validation and transactions.
 * Restores inventory when transition is to 'cancelled' or 'returned'.
 *
 * @param tenantId - Tenant identifier
 * @param orderId - Order identifier
 * @param targetStatus - Target order status
 * @param reason - Explanation for state transition
 * @param actorId - Staff user ID executing transition
 */
export async function updateOrderStatus(
  tenantId: string,
  orderId: string,
  targetStatus: string,
  reason: string,
  actorId: string
) {
  if (!tenantId || !orderId || !targetStatus) {
    throw new ValidationError('Tenant ID, order ID, and target status are required');
  }

  return await db.transaction(async (tx) => {
    // 1. Fetch current order with pessimistic lock
    const [order] = await tx
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.id, orderId)
        )
      )
      .for('update');

    if (!order) {
      throw new NotFoundError(`Order '${orderId}' not found`);
    }

    const currentStatus = order.status;

    // 2. Validate transition against state machine
    if (!isValidStatusTransition(currentStatus, targetStatus)) {
      throw new ValidationError(
        `Cannot transition order status from '${currentStatus}' to '${targetStatus}'. Invalid state machine transition.`,
        [
          {
            field: 'targetStatus',
            message: `Transition from '${currentStatus}' to '${targetStatus}' is not allowed`,
          },
        ]
      );
    }

    const now = new Date();

    // 3. Update order status
    const [updatedOrder] = await tx
      .update(orders)
      .set({
        status: targetStatus as OrderStatus,
        updatedAt: now,
      })
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.id, orderId)
        )
      )
      .returning();

    // 4. Insert orderStatusHistory record
    await tx.insert(orderStatusHistory).values({
      id: generateId(),
      tenantId,
      orderId,
      oldStatus: currentStatus,
      newStatus: targetStatus,
      reason: reason || null,
      actorId: actorId || null,
      createdAt: now,
    });

    // 5. Restore inventory if cancelled or returned
    if (targetStatus === 'cancelled' || targetStatus === 'returned') {
      const items = await tx
        .select()
        .from(orderItems)
        .where(
          and(
            eq(orderItems.tenantId, tenantId),
            eq(orderItems.orderId, orderId)
          )
        );

      const movementReason = targetStatus === 'cancelled' ? 'order_cancelled' : 'order_returned';

      for (const item of items) {
        // Increment variant stock
        await tx
          .update(productVariants)
          .set({
            stockQuantity: sql`${productVariants.stockQuantity} + ${item.quantity}`,
            updatedAt: now,
          })
          .where(
            and(
              eq(productVariants.tenantId, tenantId),
              eq(productVariants.id, item.variantId)
            )
          );

        // Record inventory movement
        await tx.insert(inventoryMovements).values({
          id: generateId(),
          tenantId,
          variantId: item.variantId,
          delta: item.quantity,
          reason: movementReason,
          referenceId: orderId,
          actorId: actorId || null,
          createdAt: now,
        });
      }
    }

    // 6. Record audit log
    await recordAuditLog(
      {
        tenantId,
        actorId,
        action: 'order:status_update',
        resourceType: 'order',
        resourceId: orderId,
        outcome: 'success',
        metadata: {
          previousStatus: currentStatus,
          newStatus: targetStatus,
          reason,
        },
      },
      tx
    );

    return updatedOrder;
  });
}

/**
 * Lists orders for a tenant with pagination, filtering, and search.
 *
 * @param tenantId - Tenant identifier
 * @param options - Query filters and pagination
 */
export async function listOrders(
  tenantId: string,
  options: ListOrdersOptions = {}
) {
  const rawPage = Number(options.page);
  const rawPageSize = Number(options.pageSize);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize >= 1 ? Math.min(100, Math.floor(rawPageSize)) : 20;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(orders.tenantId, tenantId)];

  if (options.status && options.status !== 'all') {
    conditions.push(eq(orders.status, options.status as OrderStatus));
  }

  if (options.fromDate) {
    conditions.push(gte(orders.createdAt, options.fromDate));
  }

  if (options.toDate) {
    conditions.push(lte(orders.createdAt, options.toDate));
  }

  if (options.search && options.search.trim().length > 0) {
    const searchPattern = `%${options.search.trim()}%`;
    conditions.push(
      or(
        sql`${orders.orderNumber} ILIKE ${searchPattern}`,
        sql`EXISTS (
          SELECT 1 FROM ${customers}
          WHERE ${customers.id} = ${orders.customerId}
          AND (${customers.name} ILIKE ${searchPattern} OR ${customers.email} ILIKE ${searchPattern} OR ${customers.phone} ILIKE ${searchPattern})
        )`
      )!
    );
  }

  const whereClause = and(...conditions);

  const [items, [{ count }]] = await Promise.all([
    db.query.orders.findMany({
      where: whereClause,
      with: {
        customer: true,
        items: true,
      },
      orderBy: [desc(orders.createdAt)],
      limit: pageSize,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(whereClause),
  ]);

  return {
    items,
    total: count,
    page,
    pageSize,
    totalPages: Math.ceil(count / pageSize),
  };
}

/**
 * Exports orders as formula-injection safe CSV stream / string.
 *
 * @param tenantId - Tenant identifier
 * @param options - Optional filters
 */
export async function exportOrdersCsv(
  tenantId: string,
  options?: { status?: string }
): Promise<string> {
  const conditions = [eq(orders.tenantId, tenantId)];

  if (options?.status && options.status !== 'all') {
    conditions.push(eq(orders.status, options.status as OrderStatus));
  }

  const orderRows = await db.query.orders.findMany({
    where: and(...conditions),
    with: {
      customer: true,
      items: true,
    },
    orderBy: [desc(orders.createdAt)],
  });

  const headers = [
    'Order Number',
    'Date',
    'Customer Name',
    'Customer Email',
    'Customer Phone',
    'Status',
    'Payment Mode',
    'Payment Status',
    'Subtotal (INR)',
    'Discount (INR)',
    'Delivery Fee (INR)',
    'Total (INR)',
    'Items Count',
  ];

  const lines: string[] = [headers.map(csvEscape).join(',')];

  for (const o of orderRows) {
    const row = [
      o.orderNumber,
      o.createdAt.toISOString(),
      o.customer?.name ?? '',
      o.customer?.email ?? '',
      o.customer?.phone ?? '',
      o.status,
      o.paymentMode,
      o.paymentStatus,
      (o.subtotal / 100).toFixed(2),
      (o.discountAmount / 100).toFixed(2),
      (o.deliveryFee / 100).toFixed(2),
      (o.total / 100).toFixed(2),
      String(o.items?.length ?? 0),
    ];

    lines.push(row.map(csvEscape).join(','));
  }

  return lines.join('\r\n');
}

/**
 * Retrieves public order tracking information using publicToken ONLY.
 * Does NOT reveal sensitive PII (no customer full address, email, or phone number).
 *
 * @param publicToken - ULID public tracking token
 */
export async function getPublicOrderTracking(
  publicToken: string
): Promise<PublicOrderTracking> {
  if (!publicToken || publicToken.trim().length === 0) {
    throw new ValidationError('Public tracking token is required');
  }

  const order = await db.query.orders.findFirst({
    where: eq(orders.publicToken, publicToken.trim()),
    with: {
      items: true,
      statusHistory: {
        orderBy: [orderStatusHistory.createdAt],
      },
    },
  });

  if (!order) {
    throw new NotFoundError('Order not found with provided tracking token');
  }

  // Derive human-readable delivery status description
  let deliveryStatus = 'Order Placed';
  switch (order.status) {
    case 'pending_confirmation':
      deliveryStatus = 'Awaiting Confirmation';
      break;
    case 'confirmed':
      deliveryStatus = 'Order Confirmed';
      break;
    case 'processing':
      deliveryStatus = 'Processing & Packing';
      break;
    case 'shipped':
      deliveryStatus = 'Out for Delivery / Shipped';
      break;
    case 'delivered':
      deliveryStatus = 'Delivered';
      break;
    case 'cancelled':
      deliveryStatus = 'Cancelled';
      break;
    case 'returned':
      deliveryStatus = 'Returned';
      break;
    case 'refunded':
      deliveryStatus = 'Refunded';
      break;
    default:
      deliveryStatus = order.status;
  }

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    deliveryStatus,
    statusHistory: order.statusHistory.map((h) => ({
      status: h.newStatus,
      timestamp: h.createdAt,
      reason: h.reason,
    })),
    items: order.items.map((item) => ({
      productTitle: item.productTitle,
      variantName: item.variantName,
      quantity: item.quantity,
      imageUrl: item.imageUrl,
    })),
  };
}

