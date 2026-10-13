import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers, orders, products } from '@/lib/db/schema';
import { createMoney, formatMoney, Money } from '@/lib/money';
import { BadRequestError } from '@/lib/errors';

export interface DashboardKPIOptions {
  fromDate?: Date;
  toDate?: Date;
}

export interface StatusBreakdown {
  pending: number;
  processing: number;
  delivered: number;
  cancelled: number;
  other: number;
}

export interface DailyRevenuePoint {
  date: string;
  revenueMinor: number;
  ordersCount: number;
}

export interface RecentOrderItem {
  id: string;
  orderNumber: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  totalMinor: number;
  totalFormatted: string;
  status: string;
  paymentMode: string;
  paymentStatus: string;
  createdAt: Date;
}

export interface DashboardKPIResult {
  totalRevenueMinor: number;
  totalRevenueFormatted: string;
  totalRevenueMoney: Money;
  totalOrders: number;
  ordersBreakdown: StatusBreakdown;
  activeProducts: number;
  totalCustomers: number;
  recentOrders: RecentOrderItem[];
  timeline: DailyRevenuePoint[];
}

/**
 * Calculates dashboard KPIs and business metrics strictly scoped to a tenant.
 *
 * @param tenantId - The unique tenant ULID
 * @param options - Optional date boundary filters
 * @returns Dashboard metrics including revenue, orders breakdown, products, customers, and timeline
 */
export async function getDashboardKPIs(
  tenantId: string,
  options: DashboardKPIOptions = {}
): Promise<DashboardKPIResult> {
  if (!tenantId) {
    throw new BadRequestError('Tenant ID is required for retrieving dashboard KPIs');
  }

  // 1. Base order conditions (tenant isolation + optional date bounds)
  const orderConditions = [eq(orders.tenantId, tenantId)];

  if (options.fromDate) {
    orderConditions.push(gte(orders.createdAt, options.fromDate));
  }
  if (options.toDate) {
    orderConditions.push(lte(orders.createdAt, options.toDate));
  }

  const baseOrderWhere = and(...orderConditions);

  // Revenue statuses: orders that are confirmed, processing, shipped, or delivered
  const revenueStatuses = ['confirmed', 'processing', 'shipped', 'delivered'] as const;

  // 2. Query orders for metrics within date window
  const tenantOrders = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      customerId: orders.customerId,
      paymentMode: orders.paymentMode,
      paymentStatus: orders.paymentStatus,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(baseOrderWhere)
    .orderBy(desc(orders.createdAt));

  // Compute revenue and breakdown from tenant orders
  let totalRevenueMinor = 0;
  const ordersBreakdown: StatusBreakdown = {
    pending: 0,
    processing: 0,
    delivered: 0,
    cancelled: 0,
    other: 0,
  };

  const timelineMap = new Map<string, { revenueMinor: number; count: number }>();

  for (const ord of tenantOrders) {
    // Breakdown by standard UI statuses
    if (ord.status === 'pending_confirmation') {
      ordersBreakdown.pending += 1;
    } else if (ord.status === 'processing') {
      ordersBreakdown.processing += 1;
    } else if (ord.status === 'delivered') {
      ordersBreakdown.delivered += 1;
    } else if (ord.status === 'cancelled') {
      ordersBreakdown.cancelled += 1;
    } else {
      ordersBreakdown.other += 1;
    }

    // Revenue calculation
    const isRevenueEligible = (revenueStatuses as readonly string[]).includes(ord.status);
    if (isRevenueEligible) {
      totalRevenueMinor += ord.total;
    }

    // Daily timeline grouping (YYYY-MM-DD)
    const dateKey = ord.createdAt.toISOString().slice(0, 10);
    const existing = timelineMap.get(dateKey) || { revenueMinor: 0, count: 0 };
    existing.count += 1;
    if (isRevenueEligible) {
      existing.revenueMinor += ord.total;
    }
    timelineMap.set(dateKey, existing);
  }

  // Format sorted timeline
  const timeline: DailyRevenuePoint[] = Array.from(timelineMap.entries())
    .map(([date, data]) => ({
      date,
      revenueMinor: data.revenueMinor,
      ordersCount: data.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 3. Active Products Count
  const [activeProductsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(
      and(
        eq(products.tenantId, tenantId),
        eq(products.status, 'active')
      )
    );
  const activeProducts = Number(activeProductsResult?.count ?? 0);

  // 4. Total Customers Count
  const [totalCustomersResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customers)
    .where(eq(customers.tenantId, tenantId));
  const totalCustomers = Number(totalCustomersResult?.count ?? 0);

  // 5. Recent Orders (Last 10 orders with customer names)
  const recentOrdersRaw = tenantOrders.slice(0, 10);
  const customerIds = recentOrdersRaw
    .map((o) => o.customerId)
    .filter((id): id is string => Boolean(id));

  const customerMap = new Map<string, { name: string | null; email: string | null }>();
  if (customerIds.length > 0) {
    const fetchedCustomers = await db
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
      })
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), inArray(customers.id, customerIds)));

    for (const c of fetchedCustomers) {
      customerMap.set(c.id, { name: c.name, email: c.email });
    }
  }

  const recentOrders: RecentOrderItem[] = recentOrdersRaw.map((ord) => {
    const cust = ord.customerId ? customerMap.get(ord.customerId) : undefined;
    const money = createMoney(ord.total, 'INR');
    return {
      id: ord.id,
      orderNumber: ord.orderNumber,
      customerId: ord.customerId,
      customerName: cust?.name || 'Guest Shopper',
      customerEmail: cust?.email || 'N/A',
      totalMinor: ord.total,
      totalFormatted: formatMoney(money),
      status: ord.status,
      paymentMode: ord.paymentMode,
      paymentStatus: ord.paymentStatus,
      createdAt: ord.createdAt,
    };
  });

  const revenueMoney = createMoney(totalRevenueMinor, 'INR');

  return {
    totalRevenueMinor,
    totalRevenueFormatted: formatMoney(revenueMoney),
    totalRevenueMoney: revenueMoney,
    totalOrders: tenantOrders.length,
    ordersBreakdown,
    activeProducts,
    totalCustomers,
    recentOrders,
    timeline,
  };
}
