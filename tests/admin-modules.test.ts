import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { ZodError } from 'zod/v4';
import { getDashboardKPIs } from '@/modules/dashboard/dashboard-service';
import {
  addBannerSlide,
  createCampaign,
  getActiveBanners,
  reorderBannerSlides,
} from '@/modules/campaigns/campaign-service';
import {
  createCoupon,
  validateCoupon,
} from '@/modules/promotions/coupon-service';
import {
  deleteCustomerData,
  exportCustomersCsv,
} from '@/modules/customers/customer-service';
import {
  createSubscriptionPlan,
  listSubscriptionPlans,
  MVP_SUBSCRIPTION_DISCLAIMER,
} from '@/modules/plans/plan-service';
import { ConflictError, ValidationError } from '@/lib/errors';

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Admin Modules Tests
// -----------------------------------------------------------------------------
interface MockRecord {
  [key: string]: unknown;
}

const tableStores: Record<string, Map<string, MockRecord>> = {
  orders: new Map<string, MockRecord>(),
  products: new Map<string, MockRecord>(),
  customers: new Map<string, MockRecord>(),
  addresses: new Map<string, MockRecord>(),
  campaigns: new Map<string, MockRecord>(),
  banner_slides: new Map<string, MockRecord>(),
  coupons: new Map<string, MockRecord>(),
  coupon_redemptions: new Map<string, MockRecord>(),
  subscription_plans: new Map<string, MockRecord>(),
  customer_subscriptions: new Map<string, MockRecord>(),
  audit_logs: new Map<string, MockRecord>(),
};

function resetDb() {
  for (const store of Object.values(tableStores)) {
    store.clear();
  }
}

function resolveTableName(table: unknown): string {
  try {
    return getTableName(table as never);
  } catch {
    return (
      (table as { _: { name: string } })?._?.name ||
      (table as Record<string, unknown>)?.[Symbol.for('drizzle:Name') as unknown as string] as string ||
      'unknown'
    );
  }
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
}

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (g) => `_${g.toLowerCase()}`);
}

function getRecordValue(rec: MockRecord, col: string): unknown {
  return rec[col] ?? rec[snakeToCamel(col)] ?? rec[camelToSnake(col)];
}

interface FilterCriterion {
  column: string;
  op: 'eq' | 'isNull' | 'in';
  value?: unknown;
  values?: unknown[];
}

function extractFilters(cond: unknown, list: FilterCriterion[] = []): FilterCriterion[] {
  if (!cond || typeof cond !== 'object') return list;

  const chunks = (cond as { queryChunks?: unknown[] }).queryChunks;
  if (Array.isArray(chunks)) {
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i] as { name?: string; value?: string[] };
      // Check for isNull: [ [ '' ], 'col_name', [ ' is null' ] ]
      if (c && c.name && chunks[i + 1] && (chunks[i + 1] as { value?: string[] }).value?.[0]?.includes('is null')) {
        list.push({ column: c.name, op: 'isNull' });
      }
      // Check for inArray: [ [ '' ], 'col_name', [ ' in ' ], paramsArray, ... ]
      else if (c && c.name && chunks[i + 1] && (chunks[i + 1] as { value?: string[] }).value?.[0]?.includes('in') && Array.isArray(chunks[i + 2])) {
        const params = (chunks[i + 2] as Array<{ value: unknown }>).map((p) => p.value);
        list.push({ column: c.name, op: 'in', values: params });
      }
      // Check for eq: [ col, stringChunk, param ]
      else if (c && c.name && chunks[i + 2] && (chunks[i + 2] as { value?: unknown }).value !== undefined) {
        list.push({ column: c.name, op: 'eq', value: (chunks[i + 2] as { value: unknown }).value });
      } else {
        extractFilters(c, list);
      }
    }
  }

  return list;
}

function matchesFilters(rec: MockRecord, filters: FilterCriterion[]): boolean {
  for (const f of filters) {
    const val = getRecordValue(rec, f.column);
    if (f.op === 'eq') {
      if (val !== f.value) return false;
    } else if (f.op === 'isNull') {
      if (val !== null && val !== undefined) return false;
    } else if (f.op === 'in') {
      if (!f.values?.includes(val)) return false;
    }
  }
  return true;
}

vi.mock('@/modules/audit/audit-service', () => ({
  recordAuditLog: vi.fn(async () => {}),
  scrubSensitiveData: vi.fn((data) => data),
}));

vi.mock('@/lib/db', () => {
  const queryExecutor = {
    select: vi.fn((fields?: unknown) => ({
      from: vi.fn((table: unknown) => {
        const tableName = resolveTableName(table);
        const store = tableStores[tableName] ?? new Map<string, MockRecord>();

        const buildChain = (currentRecords: MockRecord[]) => {
          const chain: Record<string, unknown> = {
            leftJoin: vi.fn(() => chain),
            where: vi.fn((condition: unknown) => {
              const filters = extractFilters(condition);
              const filtered = filters.length > 0
                ? currentRecords.filter((r) => matchesFilters(r, filters))
                : currentRecords;
              return buildChain(filtered);
            }),
            orderBy: vi.fn(() => ({
              limit: vi.fn((lim: number) => ({
                offset: vi.fn((off: number) => Promise.resolve(currentRecords.slice(off, off + lim))),
                then: (resolve: (v: unknown) => void) => resolve(currentRecords.slice(0, lim)),
              })),
              then: (resolve: (v: unknown) => void) => resolve(currentRecords),
            })),
            limit: vi.fn((lim: number) => {
              const sliced = currentRecords.slice(0, lim);
              return {
                offset: vi.fn((off: number) => Promise.resolve(sliced.slice(off))),
                then: (resolve: (v: unknown) => void) => resolve(sliced),
              };
            }),
            groupBy: vi.fn(() => Promise.resolve(currentRecords)),
            then: (resolve: (v: unknown) => void) => {
              if (fields && typeof fields === 'object' && 'count' in fields) {
                return resolve([{ count: currentRecords.length }]);
              }
              return resolve(currentRecords);
            },
          };
          return chain;
        };

        return buildChain(Array.from(store.values()));
      }),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((vals: Record<string, unknown>) => {
        const tableName = resolveTableName(table);
        const store = tableStores[tableName];
        const record = { ...vals, createdAt: new Date(), updatedAt: new Date() };
        if (store && vals.id) {
          store.set(vals.id as string, record);
        }
        return {
          returning: vi.fn(() => Promise.resolve([record])),
          then: (resolve: (v: unknown) => void) => resolve([record]),
        };
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((vals: Record<string, unknown>) => ({
        where: vi.fn((condition: unknown) => {
          const tableName = resolveTableName(table);
          const store = tableStores[tableName];
          const filters = extractFilters(condition);
          const updated: MockRecord[] = [];
          if (store) {
            for (const [key, record] of store.entries()) {
              if (filters.length === 0 || matchesFilters(record, filters)) {
                const newRec = { ...record, ...vals, updatedAt: new Date() };
                store.set(key, newRec);
                updated.push(newRec);
              }
            }
          }
          return {
            returning: vi.fn(() => Promise.resolve(updated.length > 0 ? updated : [{ ...vals }])),
            then: (resolve: (v: unknown) => void) => resolve(updated.length > 0 ? updated : [{ ...vals }]),
          };
        }),
      })),
    })),
    delete: vi.fn((table: unknown) => ({
      where: vi.fn((condition: unknown) => {
        const tableName = resolveTableName(table);
        const store = tableStores[tableName];
        const filters = extractFilters(condition);
        if (store && filters.length > 0) {
          for (const [key, record] of Array.from(store.entries())) {
            if (matchesFilters(record, filters)) {
              store.delete(key);
            }
          }
        }
        return Promise.resolve([]);
      }),
    })),
  };

  return {
    db: queryExecutor,
  };
});

describe('Slice 7: Admin Modules Unit Tests', () => {
  const tenantId = 'ten_01J8K90001';
  const actorId = 'usr_admin_01';

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Dashboard KPI Calculations
  // ---------------------------------------------------------------------------
  describe('1. Dashboard KPI Calculations', () => {
    it('calculates total revenue from confirmed/processing/delivered orders in minor units', async () => {
      const now = new Date();
      tableStores.orders.set('ord_1', {
        id: 'ord_1',
        tenantId,
        orderNumber: 'ORD-101',
        status: 'delivered',
        total: 250000, // ₹2,500.00
        paymentMode: 'online',
        paymentStatus: 'paid',
        createdAt: now,
      });
      tableStores.orders.set('ord_2', {
        id: 'ord_2',
        tenantId,
        orderNumber: 'ORD-102',
        status: 'processing',
        total: 150000, // ₹1,500.00
        paymentMode: 'cod',
        paymentStatus: 'pending',
        createdAt: now,
      });
      tableStores.orders.set('ord_3', {
        id: 'ord_3',
        tenantId,
        orderNumber: 'ORD-103',
        status: 'cancelled',
        total: 99900,
        paymentMode: 'online',
        paymentStatus: 'failed',
        createdAt: now,
      });

      const kpis = await getDashboardKPIs(tenantId);

      expect(kpis.totalRevenueMinor).toBe(400000);
      expect(kpis.totalRevenueFormatted).toBe('₹4,000.00');
      expect(kpis.totalOrders).toBe(3);
      expect(kpis.ordersBreakdown.delivered).toBe(1);
      expect(kpis.ordersBreakdown.processing).toBe(1);
      expect(kpis.ordersBreakdown.cancelled).toBe(1);
    });

    it('aggregates daily timeline points for revenue chart', async () => {
      const day1 = new Date('2026-10-10T10:00:00Z');
      const day2 = new Date('2026-10-11T12:00:00Z');

      tableStores.orders.set('ord_1', {
        id: 'ord_1',
        tenantId,
        orderNumber: 'ORD-1',
        status: 'delivered',
        total: 100000,
        createdAt: day1,
      });
      tableStores.orders.set('ord_2', {
        id: 'ord_2',
        tenantId,
        orderNumber: 'ORD-2',
        status: 'delivered',
        total: 200000,
        createdAt: day2,
      });

      const kpis = await getDashboardKPIs(tenantId);

      expect(kpis.timeline.length).toBeGreaterThanOrEqual(1);
      const points = kpis.timeline;
      expect(points.some((p) => p.date === '2026-10-10' && p.revenueMinor === 100000)).toBe(true);
      expect(points.some((p) => p.date === '2026-10-11' && p.revenueMinor === 200000)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. 7-Day Banner Weekday Selection & Fallback
  // ---------------------------------------------------------------------------
  describe('2. 7-Day Day-Specific Banner Scheduler', () => {
    it('creates campaign and adds banner slides', async () => {
      const camp = await createCampaign(
        tenantId,
        {
          name: 'Monday Madness',
          placement: 'homepage',
          dayOfWeek: 1,
          isActive: true,
          sortOrder: 0,
        },
        actorId
      );

      expect(camp.name).toBe('Monday Madness');
      expect(camp.dayOfWeek).toBe(1);

      const slide = await addBannerSlide(
        tenantId,
        camp.id,
        {
          heading: 'Monday Mega Sale',
          subheading: 'Flat 25% Off Today',
          imageUrl: 'https://example.com/monday.jpg',
          ctaLabel: 'Shop Now',
          ctaHref: '/collection/monday',
          sortOrder: 0,
        },
        actorId
      );

      expect(slide.heading).toBe('Monday Mega Sale');
      expect(slide.campaignId).toBe(camp.id);
    });

    it('returns day-specific banner when available for the target day', async () => {
      tableStores.campaigns.set('camp_mon', {
        id: 'camp_mon',
        tenantId,
        name: 'Monday Banner',
        placement: 'homepage',
        dayOfWeek: 1,
        isActive: true,
        sortOrder: 0,
        startDate: null,
        endDate: null,
      });
      tableStores.banner_slides.set('slide_mon', {
        id: 'slide_mon',
        tenantId,
        campaignId: 'camp_mon',
        heading: 'Start Your Monday',
        sortOrder: 0,
      });

      const result = await getActiveBanners(tenantId, 1);
      expect(result.dayOfWeek).toBe(1);
      expect(result.isDaySpecific).toBe(true);
      expect(result.slides).toHaveLength(1);
      expect(result.slides[0].heading).toBe('Start Your Monday');
    });

    it('gracefully falls back to default any-day banners when target day has no banners', async () => {
      tableStores.campaigns.set('camp_default', {
        id: 'camp_default',
        tenantId,
        name: 'Evergreen Banner',
        placement: 'homepage',
        dayOfWeek: null,
        isActive: true,
        sortOrder: 0,
        startDate: null,
        endDate: null,
      });
      tableStores.banner_slides.set('slide_default', {
        id: 'slide_default',
        tenantId,
        campaignId: 'camp_default',
        heading: 'Welcome to Our Store',
        sortOrder: 0,
      });

      const result = await getActiveBanners(tenantId, 3); // Wednesday (no specific campaign)
      expect(result.dayOfWeek).toBe(3);
      expect(result.isDaySpecific).toBe(false);
      expect(result.slides).toHaveLength(1);
      expect(result.slides[0].heading).toBe('Welcome to Our Store');
    });

    it('reorders banner slides sequence accurately', async () => {
      tableStores.campaigns.set('camp_test', {
        id: 'camp_test',
        tenantId,
        name: 'Test Campaign',
        isActive: true,
      });
      tableStores.banner_slides.set('slide_1', {
        id: 'slide_1',
        campaignId: 'camp_test',
        tenantId,
        sortOrder: 0,
      });
      tableStores.banner_slides.set('slide_2', {
        id: 'slide_2',
        campaignId: 'camp_test',
        tenantId,
        sortOrder: 1,
      });

      const reordered = await reorderBannerSlides(
        tenantId,
        'camp_test',
        ['slide_2', 'slide_1'],
        actorId
      );

      expect(reordered).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Promotions & Coupons (Percentage, Fixed, Min Subtotal, Limits)
  // ---------------------------------------------------------------------------
  describe('3. Coupon Calculations & Validation', () => {
    it('creates coupon with uppercase code and enforces uniqueness', async () => {
      const created = await createCoupon(
        tenantId,
        {
          code: 'save20',
          discountType: 'percentage',
          discountValue: 20,
          minSubtotal: 50000,
        },
        actorId
      );

      expect(created.code).toBe('SAVE20');
      expect(created.discountValue).toBe(20);

      await expect(
        createCoupon(
          tenantId,
          {
            code: 'SAVE20',
            discountType: 'percentage',
            discountValue: 20,
          },
          actorId
        )
      ).rejects.toThrow(ConflictError);
    });

    it('rejects percentage discounts exceeding 100%', async () => {
      await expect(
        createCoupon(
          tenantId,
          {
            code: 'BONUS150',
            discountType: 'percentage',
            discountValue: 150,
          },
          actorId
        )
      ).rejects.toThrow(ValidationError);
    });

    it('calculates percentage discount accurately based on subtotal', async () => {
      tableStores.coupons.set('coup_20', {
        id: 'coup_20',
        tenantId,
        code: 'PERCENT20',
        discountType: 'percentage',
        discountValue: 20,
        minSubtotal: 100000,
        maxUses: null,
        usedCount: 0,
        perCustomerLimit: 1,
        isActive: true,
      });

      const res = await validateCoupon(tenantId, 'PERCENT20', undefined, 200000);
      expect(res.valid).toBe(true);
      expect(res.discountAmount).toBe(40000);
    });

    it('calculates fixed discount accurately and caps at subtotal', async () => {
      tableStores.coupons.set('coup_fixed', {
        id: 'coup_fixed',
        tenantId,
        code: 'FLAT500',
        discountType: 'fixed',
        discountValue: 50000,
        minSubtotal: 0,
        maxUses: null,
        usedCount: 0,
        perCustomerLimit: 1,
        isActive: true,
      });

      const res1 = await validateCoupon(tenantId, 'FLAT500', undefined, 150000);
      expect(res1.valid).toBe(true);
      expect(res1.discountAmount).toBe(50000);

      const res2 = await validateCoupon(tenantId, 'FLAT500', undefined, 30000);
      expect(res2.valid).toBe(true);
      expect(res2.discountAmount).toBe(30000);
    });

    it('rejects coupon when subtotal does not meet minSubtotal', async () => {
      tableStores.coupons.set('coup_min', {
        id: 'coup_min',
        tenantId,
        code: 'BIGSPENDER',
        discountType: 'fixed',
        discountValue: 100000,
        minSubtotal: 500000,
        maxUses: null,
        usedCount: 0,
        perCustomerLimit: 1,
        isActive: true,
      });

      const res = await validateCoupon(tenantId, 'BIGSPENDER', undefined, 200000);
      expect(res.valid).toBe(false);
      expect(res.discountAmount).toBe(0);
      expect(res.message).toContain('Minimum order subtotal');
    });

    it('rejects coupon when maximum global uses are exhausted', async () => {
      tableStores.coupons.set('coup_exhausted', {
        id: 'coup_exhausted',
        tenantId,
        code: 'LIMITED10',
        discountType: 'percentage',
        discountValue: 10,
        minSubtotal: 0,
        maxUses: 5,
        usedCount: 5,
        perCustomerLimit: 1,
        isActive: true,
      });

      const res = await validateCoupon(tenantId, 'LIMITED10', undefined, 100000);
      expect(res.valid).toBe(false);
      expect(res.message).toContain('maximum redemption limit');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Customer GDPR & DPDP Anonymization Workflow
  // ---------------------------------------------------------------------------
  describe('4. Customer Privacy & GDPR/DPDP Anonymization', () => {
    it('anonymizes customer PII while retaining financial orders for tax compliance', async () => {
      const customerId = 'cust_01J8K9PRIVACY';

      tableStores.customers.set(customerId, {
        id: customerId,
        tenantId,
        name: 'Jane Doe',
        email: 'jane.doe@personal.com',
        phone: '+919876500000',
        marketingConsent: true,
      });

      tableStores.orders.set('ord_cust_1', {
        id: 'ord_cust_1',
        tenantId,
        customerId,
        total: 199900,
        status: 'delivered',
      });

      const result = await deleteCustomerData(tenantId, customerId, actorId);
      expect(result.anonymized).toBe(true);

      const customerInDb = tableStores.customers.get(customerId);
      expect(customerInDb?.name).toBe('Anonymized Customer');
      expect(customerInDb?.email).toContain('@deleted.local');
      expect(customerInDb?.phone).toBeNull();
      expect(customerInDb?.marketingConsent).toBe(false);

      // Financial order record MUST remain preserved for tax/auditing
      expect(tableStores.orders.has('ord_cust_1')).toBe(true);
    });

    it('exports customers to CSV neutralizing formula injection vectors', async () => {
      tableStores.customers.set('cust_malicious', {
        id: 'cust_malicious',
        tenantId,
        name: '=cmd|’ /C calc’!A0',
        email: '+919999999999@test.com',
        phone: '-918888888888',
        marketingConsent: false,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });

      const csv = await exportCustomersCsv(tenantId);

      expect(csv).toContain('\t=cmd');
      expect(csv).toContain('\t+91999');
      expect(csv).toContain('\t-91888');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Subscription Plans & MVP Auto-Billing Disclaimer
  // ---------------------------------------------------------------------------
  describe('5. Commerce Subscriptions & Disclaimer', () => {
    it('creates subscription plan with durationDays and validates constraints', async () => {
      const plan = await createSubscriptionPlan(
        tenantId,
        {
          name: 'Annual VIP Pass',
          description: 'Year-long VIP access',
          price: 199900,
          currency: 'INR',
          durationDays: 365,
          isVisible: true,
          status: 'active',
        },
        actorId
      );

      expect(plan.name).toBe('Annual VIP Pass');
      expect(plan.durationDays).toBe(365);
      expect(plan.priceFormatted).toBe('₹1,999.00');
      expect(plan.disclaimer).toBe(MVP_SUBSCRIPTION_DISCLAIMER);
    });

    it('rejects plans with negative price or zero duration', async () => {
      await expect(
        createSubscriptionPlan(
          tenantId,
          {
            name: 'Bad Plan',
            price: -100,
            durationDays: 30,
          },
          actorId
        )
      ).rejects.toThrow(ZodError);

      await expect(
        createSubscriptionPlan(
          tenantId,
          {
            name: 'Zero Days Plan',
            price: 50000,
            durationDays: 0,
          },
          actorId
        )
      ).rejects.toThrow(ZodError);
    });

    it('includes MVP auto-billing disclaimer in plan listings', async () => {
      tableStores.subscription_plans.set('plan_1', {
        id: 'plan_1',
        tenantId,
        name: 'Coffee Club 30',
        price: 99900,
        currency: 'INR',
        durationDays: 30,
        isVisible: true,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await listSubscriptionPlans(tenantId);
      expect(res.disclaimer).toContain('Automatic recurring card debits are not enabled in this MVP release');
      expect(res.plans[0].disclaimer).toBe(MVP_SUBSCRIPTION_DISCLAIMER);
    });
  });
});
