import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { addresses, customers, orders } from '@/lib/db/schema';
import { BadRequestError, NotFoundError } from '@/lib/errors';
import { createMoney, formatMoney } from '@/lib/money';
import { csvEscape } from '@/lib/utils';
import { recordAuditLog } from '@/modules/audit/audit-service';

export interface ListCustomersOptions {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CustomerListItem {
  id: string;
  tenantId: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  marketingConsent: boolean;
  ordersCount: number;
  totalSpentMinor: number;
  totalSpentFormatted: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerDetailsResult {
  customer: {
    id: string;
    tenantId: string;
    email: string | null;
    phone: string | null;
    name: string | null;
    marketingConsent: boolean;
    consentUpdatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  stats: {
    ordersCount: number;
    totalSpentMinor: number;
    totalSpentFormatted: string;
  };
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    paymentMode: string;
    paymentStatus: string;
    total: number;
    totalFormatted: string;
    createdAt: Date;
  }>;
  addresses: Array<{
    id: string;
    fullName: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string | null;
  }>;
}

/**
 * Lists customers for a tenant with order statistics, search, and pagination.
 */
export async function listCustomers(
  tenantId: string,
  options: ListCustomersOptions = {}
): Promise<{
  items: CustomerListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  if (!tenantId) {
    throw new BadRequestError('Tenant ID is required to list customers');
  }

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const conditions = [eq(customers.tenantId, tenantId)];

  if (options.search && options.search.trim().length > 0) {
    const term = `%${options.search.trim()}%`;
    const searchFilter = or(
      ilike(customers.name, term),
      ilike(customers.email, term),
      ilike(customers.phone, term)
    );
    if (searchFilter) {
      conditions.push(searchFilter);
    }
  }

  const whereClause = and(...conditions);

  const [customerRows, countResult] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(whereClause)
      .orderBy(desc(customers.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(whereClause),
  ]);

  const total = Number(countResult[0]?.count ?? customerRows.length);

  if (customerRows.length === 0) {
    return {
      items: [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  const customerIds = customerRows.map((c) => c.id);

  // Aggregate orders for these customers
  const orderStats = await db
    .select({
      customerId: orders.customerId,
      orderCount: sql<number>`count(*)::int`,
      totalSpent: sql<number>`coalesce(sum(${orders.total}), 0)::int`,
    })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), inArray(orders.customerId, customerIds)))
    .groupBy(orders.customerId);

  const statsMap = new Map<string, { count: number; spent: number }>();
  for (const s of orderStats) {
    if (s.customerId) {
      statsMap.set(s.customerId, {
        count: Number(s.orderCount || 0),
        spent: Number(s.totalSpent || 0),
      });
    }
  }

  const items: CustomerListItem[] = customerRows.map((c) => {
    const s = statsMap.get(c.id) || { count: 0, spent: 0 };
    const money = createMoney(s.spent, 'INR');
    return {
      id: c.id,
      tenantId: c.tenantId,
      email: c.email,
      phone: c.phone,
      name: c.name,
      marketingConsent: c.marketingConsent,
      ordersCount: s.count,
      totalSpentMinor: s.spent,
      totalSpentFormatted: formatMoney(money),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

/**
 * Retrieves full customer details including order history and address records.
 */
export async function getCustomerDetails(
  tenantId: string,
  customerId: string
): Promise<CustomerDetailsResult> {
  if (!tenantId || !customerId) {
    throw new BadRequestError('Tenant ID and Customer ID are required');
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
    .limit(1);

  if (!customer) {
    throw new NotFoundError(`Customer not found: ${customerId}`);
  }

  const [customerOrders, customerAddresses] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.customerId, customerId)))
      .orderBy(desc(orders.createdAt)),
    db
      .select()
      .from(addresses)
      .where(and(eq(addresses.tenantId, tenantId), eq(addresses.customerId, customerId))),
  ]);

  const totalSpentMinor = customerOrders.reduce((sum, o) => sum + o.total, 0);
  const spentMoney = createMoney(totalSpentMinor, 'INR');

  return {
    customer,
    stats: {
      ordersCount: customerOrders.length,
      totalSpentMinor,
      totalSpentFormatted: formatMoney(spentMoney),
    },
    orders: customerOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      paymentMode: o.paymentMode,
      paymentStatus: o.paymentStatus,
      total: o.total,
      totalFormatted: formatMoney(createMoney(o.total, 'INR')),
      createdAt: o.createdAt,
    })),
    addresses: customerAddresses.map((a) => ({
      id: a.id,
      fullName: a.fullName,
      addressLine1: a.addressLine1,
      addressLine2: a.addressLine2,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      country: a.country,
      phone: a.phone,
    })),
  };
}

/**
 * Exports customers to a formula-injection safe CSV string.
 * All cell contents are sanitized with csvEscape against DDE/formula injection attacks.
 */
export async function exportCustomersCsv(tenantId: string): Promise<string> {
  if (!tenantId) {
    throw new BadRequestError('Tenant ID is required to export customers');
  }

  const allCustomers = await db
    .select()
    .from(customers)
    .where(eq(customers.tenantId, tenantId))
    .orderBy(desc(customers.createdAt));

  const customerIds = allCustomers.map((c) => c.id);
  const statsMap = new Map<string, { count: number; spent: number }>();

  if (customerIds.length > 0) {
    const orderStats = await db
      .select({
        customerId: orders.customerId,
        orderCount: sql<number>`count(*)::int`,
        totalSpent: sql<number>`coalesce(sum(${orders.total}), 0)::int`,
      })
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), inArray(orders.customerId, customerIds)))
      .groupBy(orders.customerId);

    for (const s of orderStats) {
      if (s.customerId) {
        statsMap.set(s.customerId, {
          count: Number(s.orderCount || 0),
          spent: Number(s.totalSpent || 0),
        });
      }
    }
  }

  const headers = [
    'Customer ID',
    'Full Name',
    'Email Address',
    'Phone Number',
    'Marketing Consent',
    'Total Orders',
    'Total Spent (INR)',
    'Created At',
  ];

  const rows: string[][] = [headers];

  for (const c of allCustomers) {
    const s = statsMap.get(c.id) || { count: 0, spent: 0 };
    const spentRupees = (s.spent / 100).toFixed(2);
    const row = [
      c.id,
      c.name || '',
      c.email || '',
      c.phone || '',
      c.marketingConsent ? 'Yes' : 'No',
      s.count.toString(),
      spentRupees,
      c.createdAt.toISOString(),
    ];
    rows.push(row);
  }

  // Format as CSV with csvEscape on every cell to neutralize `=, +, -, @` injection
  return rows
    .map((row) => row.map((cell) => csvEscape(cell)).join(','))
    .join('\r\n');
}

/**
 * GDPR & India Digital Personal Data Protection (DPDP) Act Compliant Anonymization:
 * Anonymizes customer PII (name, email, phone) while strictly preserving
 * financial order history and invoice transaction records required by tax and accounting law.
 *
 * @param tenantId - The tenant ULID
 * @param customerId - The customer ULID to anonymize
 * @param actorId - Administrator executing the erasure
 */
export async function deleteCustomerData(
  tenantId: string,
  customerId: string,
  actorId: string
): Promise<{ id: string; anonymized: boolean }> {
  if (!tenantId || !customerId) {
    throw new BadRequestError('Tenant ID and Customer ID are required');
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
    .limit(1);

  if (!customer) {
    throw new NotFoundError(`Customer not found: ${customerId}`);
  }

  const anonymizedSuffix = customerId.slice(-8).toLowerCase();
  const anonymizedEmail = `anonymized-${anonymizedSuffix}@deleted.local`;
  const anonymizedName = 'Anonymized Customer';

  // 1. Anonymize customer record
  await db
    .update(customers)
    .set({
      name: anonymizedName,
      email: anonymizedEmail,
      phone: null,
      marketingConsent: false,
      updatedAt: new Date(),
    })
    .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)));

  // 2. Anonymize or prune customer non-order address book entries
  await db
    .update(addresses)
    .set({
      fullName: anonymizedName,
      phone: null,
    })
    .where(
      and(
        eq(addresses.customerId, customerId),
        eq(addresses.tenantId, tenantId)
      )
    );

  // 3. Audit trail recording
  await recordAuditLog({
    tenantId,
    actorId,
    action: 'customer:anonymize',
    resourceType: 'customer',
    resourceId: customerId,
    outcome: 'success',
    metadata: {
      reason: 'GDPR_DPDP_RIGHT_TO_ERASURE',
      financialOrdersRetained: true,
    },
  });

  return {
    id: customerId,
    anonymized: true,
  };
}
