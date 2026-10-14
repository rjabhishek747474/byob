import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { validateCoupon } from '@/modules/promotions/coupon-service';
import { listOrders } from '@/modules/orders/order-service';
import { listProducts } from '@/modules/catalog/product-service';
import { listCustomers } from '@/modules/customers/customer-service';
import {
  ZERO_INR,
  addMoney,
  applyFixedDiscount,
  applyPercentageDiscount,
  createMoney,
  formatMoney,
  isValidMoney,
  multiplyMoney,
  subtractMoney,
} from '@/lib/money';
import { ValidationError } from '@/lib/errors';

// -----------------------------------------------------------------------------
// In-Memory Database Mock for QA Stability Tests
// -----------------------------------------------------------------------------
interface MockRecord {
  [key: string]: unknown;
}

const tableStores: Record<string, Map<string, MockRecord>> = {
  orders: new Map<string, MockRecord>(),
  products: new Map<string, MockRecord>(),
  product_variants: new Map<string, MockRecord>(),
  product_images: new Map<string, MockRecord>(),
  customers: new Map<string, MockRecord>(),
  coupons: new Map<string, MockRecord>(),
  coupon_redemptions: new Map<string, MockRecord>(),
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
      ((table as Record<string, unknown>)?.[
        Symbol.for('drizzle:Name') as unknown as string
      ] as string) ||
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
      if (
        c &&
        c.name &&
        chunks[i + 1] &&
        (chunks[i + 1] as { value?: string[] }).value?.[0]?.includes('is null')
      ) {
        list.push({ column: c.name, op: 'isNull' });
      } else if (
        c &&
        c.name &&
        chunks[i + 1] &&
        (chunks[i + 1] as { value?: string[] }).value?.[0]?.includes('in') &&
        Array.isArray(chunks[i + 2])
      ) {
        const params = (chunks[i + 2] as Array<{ value: unknown }>).map((p) => p.value);
        list.push({ column: c.name, op: 'in', values: params });
      } else if (
        c &&
        c.name &&
        chunks[i + 2] &&
        (chunks[i + 2] as { value?: unknown }).value !== undefined
      ) {
        list.push({
          column: c.name,
          op: 'eq',
          value: (chunks[i + 2] as { value: unknown }).value,
        });
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
              const filtered =
                filters.length > 0
                  ? currentRecords.filter((r) => matchesFilters(r, filters))
                  : currentRecords;
              return buildChain(filtered);
            }),
            orderBy: vi.fn(() => ({
              limit: vi.fn((lim: number) => ({
                offset: vi.fn((off: number) =>
                  Promise.resolve(currentRecords.slice(off, off + lim))
                ),
                then: (resolve: (v: unknown) => void) =>
                  resolve(currentRecords.slice(0, lim)),
              })),
              then: (resolve: (v: unknown) => void) => resolve(currentRecords),
            })),
            limit: vi.fn((lim: number) => {
              const sliced = currentRecords.slice(0, lim);
              return {
                offset: vi.fn((off: number) =>
                  Promise.resolve(sliced.slice(off))
                ),
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
        const record: MockRecord = { ...vals, createdAt: new Date(), updatedAt: new Date() };
        if (store && record.id) {
          store.set(String(record.id), record);
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
          let updatedRecord: MockRecord | null = null;
          if (store) {
            for (const [id, rec] of store.entries()) {
              if (matchesFilters(rec, filters)) {
                updatedRecord = { ...rec, ...vals, updatedAt: new Date() };
                store.set(id, updatedRecord);
              }
            }
          }
          return {
            returning: vi.fn(() => Promise.resolve(updatedRecord ? [updatedRecord] : [])),
            then: (resolve: (v: unknown) => void) =>
              resolve(updatedRecord ? [updatedRecord] : []),
          };
        }),
      })),
    })),
    delete: vi.fn((table: unknown) => ({
      where: vi.fn((condition: unknown) => {
        const tableName = resolveTableName(table);
        const store = tableStores[tableName];
        const filters = extractFilters(condition);
        if (store) {
          for (const [id, rec] of store.entries()) {
            if (matchesFilters(rec, filters)) {
              store.delete(id);
            }
          }
        }
        return Promise.resolve();
      }),
    })),
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      return callback(queryExecutor);
    }),
    query: {
      orders: {
        findMany: vi.fn(async () => []),
      },
    },
  };

  return {
    db: queryExecutor,
  };
});

describe('QA Stability & Boundary Enforcement Tests', () => {
  const tenantId = 'ten_stability_qa_2026';

  beforeEach(() => {
    resetDb();
  });

  // ===========================================================================
  // 1. Coupon Validation Stability: Negative & NaN Subtotals
  // ===========================================================================
  describe('1. Coupon Validation Stability & Edge Case Handling', () => {
    it('handles negative subtotal with fixed discount safely without throwing or returning NaN', async () => {
      tableStores.coupons.set('coup_fixed', {
        id: 'coup_fixed',
        tenantId,
        code: 'FIXED500',
        discountType: 'fixed',
        discountValue: 50000,
        minSubtotal: 0,
        maxUses: null,
        usedCount: 0,
        perCustomerLimit: 1,
        isActive: true,
      });

      // Negative subtotal should produce 0 discount and not throw or produce NaN
      const res = await validateCoupon(tenantId, 'FIXED500', undefined, -50000);
      expect(res).toBeDefined();
      expect(typeof res.valid).toBe('boolean');
      expect(typeof res.discountAmount).toBe('number');
      expect(Number.isNaN(res.discountAmount)).toBe(false);
      expect(res.discountAmount).toBe(0);
      expect(res.discountAmount).toBeGreaterThanOrEqual(0);
    });

    it('handles negative subtotal with percentage discount safely without producing negative discount', async () => {
      tableStores.coupons.set('coup_pct', {
        id: 'coup_pct',
        tenantId,
        code: 'PCT20',
        discountType: 'percentage',
        discountValue: 20,
        minSubtotal: 0,
        maxUses: null,
        usedCount: 0,
        perCustomerLimit: 1,
        isActive: true,
      });

      const res = await validateCoupon(tenantId, 'PCT20', undefined, -100000);
      expect(res).toBeDefined();
      expect(typeof res.valid).toBe('boolean');
      expect(typeof res.discountAmount).toBe('number');
      expect(Number.isNaN(res.discountAmount)).toBe(false);
      expect(res.discountAmount).toBe(0);
    });

    it('handles negative subtotal when coupon requires minimum order subtotal', async () => {
      tableStores.coupons.set('coup_min', {
        id: 'coup_min',
        tenantId,
        code: 'TIERED100',
        discountType: 'fixed',
        discountValue: 10000,
        minSubtotal: 50000,
        maxUses: null,
        usedCount: 0,
        perCustomerLimit: 1,
        isActive: true,
      });

      const res = await validateCoupon(tenantId, 'TIERED100', undefined, -25000);
      expect(res.valid).toBe(false);
      expect(res.discountAmount).toBe(0);
      expect(Number.isNaN(res.discountAmount)).toBe(false);
      expect(res.message).toContain('Minimum order subtotal');
    });

    it('handles NaN subtotal safely without throwing or returning NaN in discountAmount', async () => {
      tableStores.coupons.set('coup_pct', {
        id: 'coup_pct',
        tenantId,
        code: 'PCT20',
        discountType: 'percentage',
        discountValue: 20,
        minSubtotal: 0,
        maxUses: null,
        usedCount: 0,
        perCustomerLimit: 1,
        isActive: true,
      });

      const resPct = await validateCoupon(tenantId, 'PCT20', undefined, NaN);
      expect(resPct).toBeDefined();
      expect(typeof resPct.discountAmount).toBe('number');
      expect(Number.isNaN(resPct.discountAmount)).toBe(false);
      expect(resPct.discountAmount).toBe(0);

      tableStores.coupons.set('coup_fixed', {
        id: 'coup_fixed',
        tenantId,
        code: 'FIXED500',
        discountType: 'fixed',
        discountValue: 50000,
        minSubtotal: 0,
        maxUses: null,
        usedCount: 0,
        perCustomerLimit: 1,
        isActive: true,
      });

      const resFixed = await validateCoupon(tenantId, 'FIXED500', undefined, NaN);
      expect(resFixed).toBeDefined();
      expect(typeof resFixed.discountAmount).toBe('number');
      expect(Number.isNaN(resFixed.discountAmount)).toBe(false);
      expect(resFixed.discountAmount).toBe(0);
    });

    it('handles non-finite subtotals (Infinity, -Infinity) gracefully', async () => {
      tableStores.coupons.set('coup_fixed', {
        id: 'coup_fixed',
        tenantId,
        code: 'FIXED500',
        discountType: 'fixed',
        discountValue: 50000,
        minSubtotal: 0,
        maxUses: null,
        usedCount: 0,
        perCustomerLimit: 1,
        isActive: true,
      });

      const resInf = await validateCoupon(tenantId, 'FIXED500', undefined, Infinity);
      expect(Number.isNaN(resInf.discountAmount)).toBe(false);
      expect(resInf.discountAmount).toBe(0);

      const resNegInf = await validateCoupon(tenantId, 'FIXED500', undefined, -Infinity);
      expect(Number.isNaN(resNegInf.discountAmount)).toBe(false);
      expect(resNegInf.discountAmount).toBe(0);
    });

    it('calculates valid discount on legitimate positive subtotal', async () => {
      tableStores.coupons.set('coup_valid', {
        id: 'coup_valid',
        tenantId,
        code: 'SAVE10',
        discountType: 'percentage',
        discountValue: 10,
        minSubtotal: 10000,
        maxUses: null,
        usedCount: 0,
        perCustomerLimit: 1,
        isActive: true,
      });

      const res = await validateCoupon(tenantId, 'SAVE10', undefined, 50000);
      expect(res.valid).toBe(true);
      expect(res.discountAmount).toBe(5000);
      expect(Number.isNaN(res.discountAmount)).toBe(false);
    });
  });

  // ===========================================================================
  // 2. Pagination Helper Logic: Resilience against NaN & Non-Numeric Inputs
  // ===========================================================================
  describe('2. Pagination Helper Logic Resilience', () => {
    it('normalizes NaN and non-numeric page/pageSize in listOrders to safe defaults', async () => {
      // Pass NaN
      const resNaN = await listOrders(tenantId, {
        page: NaN as unknown as number,
        pageSize: NaN as unknown as number,
      });
      expect(resNaN.page).toBe(1);
      expect(resNaN.pageSize).toBe(20);
      expect(Number.isFinite(resNaN.page)).toBe(true);
      expect(Number.isFinite(resNaN.pageSize)).toBe(true);

      // Pass non-numeric string values
      const resStr = await listOrders(tenantId, {
        page: 'invalid-page' as unknown as number,
        pageSize: 'bad-size' as unknown as number,
      });
      expect(resStr.page).toBe(1);
      expect(resStr.pageSize).toBe(20);

      // Pass negative numbers
      const resNeg = await listOrders(tenantId, {
        page: -5,
        pageSize: -50,
      });
      expect(resNeg.page).toBe(1);
      expect(resNeg.pageSize).toBe(20);

      // Pass zero
      const resZero = await listOrders(tenantId, {
        page: 0,
        pageSize: 0,
      });
      expect(resZero.page).toBe(1);
      expect(resZero.pageSize).toBe(20);

      // Pass values exceeding maximum page size ceiling (100)
      const resLarge = await listOrders(tenantId, {
        page: 2,
        pageSize: 500,
      });
      expect(resLarge.page).toBe(2);
      expect(resLarge.pageSize).toBe(100);

      // Pass floating point numbers (should floor)
      const resFloat = await listOrders(tenantId, {
        page: 3.7,
        pageSize: 25.9,
      });
      expect(resFloat.page).toBe(3);
      expect(resFloat.pageSize).toBe(25);
    });

    it('normalizes NaN and non-numeric pagination in listProducts safely', async () => {
      const res = await listProducts(tenantId, {
        page: NaN as unknown as number,
        pageSize: 'not-a-number' as unknown as number,
      });

      expect(res.page).toBe(1);
      expect(res.pageSize).toBe(20);
      expect(Number.isInteger(res.page)).toBe(true);
      expect(Number.isInteger(res.pageSize)).toBe(true);
      expect(res.items).toEqual([]);
    });

    it('normalizes NaN and non-numeric pagination in listCustomers safely', async () => {
      const res = await listCustomers(tenantId, {
        page: null as unknown as number,
        pageSize: undefined,
      });

      expect(res.page).toBe(1);
      expect(res.pageSize).toBe(20);
      expect(Number.isInteger(res.page)).toBe(true);
      expect(Number.isInteger(res.pageSize)).toBe(true);
      expect(res.items).toEqual([]);
    });
  });

  // ===========================================================================
  // 3. Money Integer Minor Unit Boundary Enforcement
  // ===========================================================================
  describe('3. Money Integer Minor Unit Boundary Enforcement', () => {
    it('creates valid Money objects in integer minor units', () => {
      const m1 = createMoney(0, 'INR');
      expect(m1.amount).toBe(0);
      expect(m1.currency).toBe('INR');
      expect(Object.isFrozen(m1)).toBe(true);

      const m2 = createMoney(150000, 'INR'); // 1500.00 INR
      expect(m2.amount).toBe(150000);
      expect(m2.currency).toBe('INR');

      const m3 = createMoney(-5000, 'USD'); // -50.00 USD (e.g. debit/refund)
      expect(m3.amount).toBe(-5000);
      expect(m3.currency).toBe('USD');

      expect(ZERO_INR.amount).toBe(0);
      expect(ZERO_INR.currency).toBe('INR');
      expect(Object.isFrozen(ZERO_INR)).toBe(true);
    });

    it('strictly rejects non-integer floats from creating Money', () => {
      expect(() => createMoney(15.5, 'INR')).toThrow(ValidationError);
      expect(() => createMoney(0.01, 'INR')).toThrow(ValidationError);
      expect(() => createMoney(99.999, 'USD')).toThrow(ValidationError);
      expect(() => createMoney(-10.2, 'INR')).toThrow(ValidationError);
    });

    it('strictly rejects NaN, Infinity, and non-number types from creating Money', () => {
      expect(() => createMoney(NaN, 'INR')).toThrow(ValidationError);
      expect(() => createMoney(Infinity, 'INR')).toThrow(ValidationError);
      expect(() => createMoney(-Infinity, 'INR')).toThrow(ValidationError);
      expect(() => createMoney('100' as unknown as number, 'INR')).toThrow(ValidationError);
      expect(() => createMoney(null as unknown as number, 'INR')).toThrow(ValidationError);
      expect(() => createMoney(undefined as unknown as number, 'INR')).toThrow(ValidationError);
    });

    it('strictly validates currency code strings', () => {
      // Normalizes trimmed uppercase
      const m = createMoney(100, '  inr  ');
      expect(m.currency).toBe('INR');

      // Rejects empty or invalid strings
      expect(() => createMoney(100, '')).toThrow(ValidationError);
      expect(() => createMoney(100, '   ')).toThrow(ValidationError);
      expect(() => createMoney(100, 'WAYTOOLONGCURRENCYCODE')).toThrow(ValidationError);
      expect(() => createMoney(100, null as unknown as string)).toThrow(ValidationError);
    });

    it('accurately validates Money objects via isValidMoney type guard', () => {
      expect(isValidMoney(createMoney(100, 'INR'))).toBe(true);
      expect(isValidMoney(ZERO_INR)).toBe(true);

      // Fails on non-objects
      expect(isValidMoney(null)).toBe(false);
      expect(isValidMoney(undefined)).toBe(false);
      expect(isValidMoney(100)).toBe(false);
      expect(isValidMoney('100 INR')).toBe(false);

      // Fails on invalid shapes
      expect(isValidMoney({ amount: 10.5, currency: 'INR' })).toBe(false);
      expect(isValidMoney({ amount: NaN, currency: 'INR' })).toBe(false);
      expect(isValidMoney({ amount: Infinity, currency: 'INR' })).toBe(false);
      expect(isValidMoney({ amount: 100, currency: '' })).toBe(false);
      expect(isValidMoney({ amount: 100, currency: 123 })).toBe(false);
      expect(isValidMoney({ currency: 'INR' })).toBe(false);
    });

    it('enforces currency uniformity on addition and subtraction', () => {
      const a = createMoney(1000, 'INR');
      const b = createMoney(500, 'INR');
      const usd = createMoney(500, 'USD');

      expect(addMoney(a, b).amount).toBe(1500);
      expect(subtractMoney(a, b).amount).toBe(500);

      // Currency mismatch throws ValidationError
      expect(() => addMoney(a, usd)).toThrow(ValidationError);
      expect(() => subtractMoney(a, usd)).toThrow(ValidationError);

      // Invalid Money object throws ValidationError
      expect(() => addMoney(a, { amount: 10.5, currency: 'INR' } as unknown as typeof a)).toThrow(
        ValidationError
      );
      expect(() => subtractMoney({} as unknown as typeof a, b)).toThrow(ValidationError);
    });

    it('enforces boundary rules on multiplication', () => {
      const price = createMoney(1000, 'INR');

      expect(multiplyMoney(price, 3).amount).toBe(3000);
      expect(multiplyMoney(price, 1.5).amount).toBe(1500);
      expect(multiplyMoney(price, 0).amount).toBe(0);

      // Rounds half-values correctly to nearest integer minor unit
      expect(multiplyMoney(createMoney(333, 'INR'), 1.5).amount).toBe(500); // 499.5 rounds to 500

      // Rejects non-finite multipliers
      expect(() => multiplyMoney(price, NaN)).toThrow(ValidationError);
      expect(() => multiplyMoney(price, Infinity)).toThrow(ValidationError);
      expect(() => multiplyMoney(price, '2' as unknown as number)).toThrow(ValidationError);
    });

    it('enforces percentage discount constraints (0-100 range and integer floor)', () => {
      const price = createMoney(1000, 'INR');

      // 0% discount preserves original price
      expect(applyPercentageDiscount(price, 0).amount).toBe(1000);

      // 100% discount reduces price to 0
      expect(applyPercentageDiscount(price, 100).amount).toBe(0);

      // 25% discount on 1000 = 750
      expect(applyPercentageDiscount(price, 25).amount).toBe(750);

      // Floors fractional minor units to prevent overcharging customer
      // 105 * (100 - 10) / 100 = 94.5 -> floor is 94
      expect(applyPercentageDiscount(createMoney(105, 'INR'), 10).amount).toBe(94);

      // Rejects out-of-bounds percentages
      expect(() => applyPercentageDiscount(price, -1)).toThrow(ValidationError);
      expect(() => applyPercentageDiscount(price, 101)).toThrow(ValidationError);
      expect(() => applyPercentageDiscount(price, NaN)).toThrow(ValidationError);
      expect(() => applyPercentageDiscount(price, Infinity)).toThrow(ValidationError);
    });

    it('enforces fixed discount boundary rules and zero-floor clamping', () => {
      const price = createMoney(1000, 'INR');
      const discount = createMoney(300, 'INR');

      expect(applyFixedDiscount(price, discount).amount).toBe(700);

      // When discount exceeds price, clamps to 0 (never negative)
      const largeDiscount = createMoney(2500, 'INR');
      expect(applyFixedDiscount(price, largeDiscount).amount).toBe(0);

      // Exact discount produces 0
      const exactDiscount = createMoney(1000, 'INR');
      expect(applyFixedDiscount(price, exactDiscount).amount).toBe(0);

      // Negative discount throws ValidationError
      const negativeDiscount = createMoney(-500, 'INR');
      expect(() => applyFixedDiscount(price, negativeDiscount)).toThrow(ValidationError);

      // Currency mismatch throws ValidationError
      const usdDiscount = createMoney(300, 'USD');
      expect(() => applyFixedDiscount(price, usdDiscount)).toThrow(ValidationError);
    });

    it('formats integer minor units accurately to localized currency representations', () => {
      const inr = createMoney(150000, 'INR'); // 1500.00
      const formattedInr = formatMoney(inr);
      expect(formattedInr).toContain('1,500.00');

      const usd = createMoney(2599, 'USD'); // $25.99
      const formattedUsd = formatMoney(usd, 'en-US');
      expect(formattedUsd).toContain('25.99');

      // Invalid Money throws ValidationError
      expect(() => formatMoney({ amount: 12.34, currency: 'INR' } as unknown as typeof inr)).toThrow(
        ValidationError
      );
    });
  });
});
