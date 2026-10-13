import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import {
  createCategorySchema,
  createProductSchema,
  createVariantSchema,
  inventoryAdjustmentSchema,
  updateCategorySchema,
  updateProductSchema,
  updateVariantSchema,
} from '@/modules/catalog/types';
import {
  createCategory,
  deleteCategory,
  getCategoryById,
  getCategoryBySlug,
  listCategories,
  updateCategory,
} from '@/modules/catalog/category-service';
import {
  adjustInventory,
  createProduct,
  deleteProduct,
  exportProductsCsv,
  getProductById,
  getProductBySlug,
  listProducts,
  updateProduct,
} from '@/modules/catalog/product-service';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { csvEscape } from '@/lib/utils';
import { db } from '@/lib/db';

// Mock audit log service to prevent database dependency in test environment
vi.mock('@/modules/audit/audit-service', () => ({
  recordAuditLog: vi.fn(async () => ({ id: 'mock-audit-id' })),
  listAuditLogs: vi.fn(async () => ({ items: [], total: 0 })),
}));

interface MockStore {
  categories: any[];
  products: any[];
  product_variants: any[];
  inventory_movements: any[];
  product_images: any[];
}

function filterRecords(records: any[], condition: any): any[] {
  if (!condition) return records;
  const dialect = new PgDialect();
  const q = dialect.sqlToQuery(condition);
  const sqlStr = q.sql;
  const params = q.params;

  return records.filter((r) => {
    // Match tenant_id = $X
    const tenantMatch = sqlStr.match(/"tenant_id"\s*=\s*\$(\d+)/);
    if (tenantMatch) {
      const idx = parseInt(tenantMatch[1], 10) - 1;
      if (r.tenantId !== params[idx]) return false;
    }

    // Match id = $X
    const idMatch = sqlStr.match(/"id"\s*=\s*\$(\d+)/);
    if (idMatch) {
      const idx = parseInt(idMatch[1], 10) - 1;
      if (r.id !== params[idx]) return false;
    }

    // Match id != $X
    const idNotMatch = sqlStr.match(/"id"\s*!=\s*\$(\d+)/);
    if (idNotMatch) {
      const idx = parseInt(idNotMatch[1], 10) - 1;
      if (r.id === params[idx]) return false;
    }

    // Match slug = $X
    const slugMatch = sqlStr.match(/"slug"\s*=\s*\$(\d+)/);
    if (slugMatch) {
      const idx = parseInt(slugMatch[1], 10) - 1;
      if (r.slug !== params[idx]) return false;
    }

    // Match product_id = $X
    const prodIdMatch = sqlStr.match(/"product_id"\s*=\s*\$(\d+)/);
    if (prodIdMatch) {
      const idx = parseInt(prodIdMatch[1], 10) - 1;
      if (r.productId !== params[idx]) return false;
    }

    // Match category_id = $X
    const catIdMatch = sqlStr.match(/"category_id"\s*=\s*\$(\d+)/);
    if (catIdMatch) {
      const idx = parseInt(catIdMatch[1], 10) - 1;
      if (r.categoryId !== params[idx]) return false;
    }

    // Match sku = $X
    const skuMatch = sqlStr.match(/"sku"\s*=\s*\$(\d+)/);
    if (skuMatch) {
      const idx = parseInt(skuMatch[1], 10) - 1;
      if (r.sku !== params[idx]) return false;
    }

    // Match inArray on sku
    if (sqlStr.includes('"sku" in (')) {
      const skus = params;
      if (!skus.includes(r.sku)) return false;
    }

    // Match status = $X
    const statusMatch = sqlStr.match(/"status"\s*=\s*\$(\d+)/);
    if (statusMatch) {
      const idx = parseInt(statusMatch[1], 10) - 1;
      if (r.status !== params[idx]) return false;
    }

    return true;
  });
}

function createMockDb() {
  const store: MockStore = {
    categories: [],
    products: [],
    product_variants: [],
    inventory_movements: [],
    product_images: [],
  };

  const getStoreForTable = (table: any): any[] => {
    const tableName = getTableName(table);
    if (tableName in store) {
      return store[tableName as keyof MockStore];
    }
    return [];
  };

  const mockDb: any = {
    _store: store,
    transaction: async (cb: any) => cb(mockDb),
    insert: (table: any) => ({
      values: (valOrVals: any) => {
        const valuesArray = Array.isArray(valOrVals) ? valOrVals : [valOrVals];
        const inserted: any[] = [];
        const targetStore = getStoreForTable(table);

        for (const item of valuesArray) {
          const row = {
            ...item,
            createdAt: item.createdAt || new Date(),
            updatedAt: item.updatedAt || new Date(),
          };
          targetStore.push(row);
          inserted.push(row);
        }
        return {
          returning: async () => inserted,
          then: (resolve: any) => Promise.resolve(inserted).then(resolve),
        };
      },
    }),
    select: (projection?: any) => ({
      from: (table: any) => {
        const targetStore = getStoreForTable(table);
        let currentCondition: any = null;

        const isCountQuery =
          projection &&
          typeof projection === 'object' &&
          'count' in projection;

        const executeQuery = () => {
          const filtered = filterRecords(targetStore, currentCondition);
          if (isCountQuery) {
            return [{ count: filtered.length }];
          }
          return [...filtered];
        };

        const queryObj: any = {
          where: (condition: any) => {
            currentCondition = condition;
            return queryObj;
          },
          orderBy: () => queryObj,
          limit: (n: number) => ({
            then: (resolve: any) => {
              const res = executeQuery();
              return Promise.resolve(res.slice(0, n)).then(resolve);
            },
          }),
          offset: (n: number) => ({
            then: (resolve: any) => {
              const res = executeQuery();
              return Promise.resolve(res.slice(n)).then(resolve);
            },
          }),
          then: (resolve: any) => {
            const res = executeQuery();
            return Promise.resolve(res).then(resolve);
          },
        };

        return queryObj;
      },
    }),
    update: (table: any) => ({
      set: (updates: any) => ({
        where: (condition: any) => {
          const targetStore = getStoreForTable(table);
          const matches = filterRecords(targetStore, condition);
          const updatedRows: any[] = [];

          for (const match of matches) {
            Object.assign(match, updates);
            updatedRows.push(match);
          }

          return {
            returning: async () => updatedRows,
            then: (resolve: any) => Promise.resolve(updatedRows).then(resolve),
          };
        },
      }),
    }),
    delete: (table: any) => ({
      where: (condition: any) => {
        const targetStore = getStoreForTable(table);
        const matches = filterRecords(targetStore, condition);
        for (const match of matches) {
          const idx = targetStore.indexOf(match);
          if (idx >= 0) targetStore.splice(idx, 1);
        }
        return {
          then: (resolve: any) => Promise.resolve().then(resolve),
        };
      },
    }),
  };

  return mockDb;
}

describe('Slice 4: Catalog, Variants, Inventory Ledger & CSV Export', () => {
  describe('1. Zod Validation & Pricing Rules', () => {
    it('enforces salePrice <= listPrice in createProductSchema', () => {
      // Valid pricing
      const valid = createProductSchema.safeParse({
        title: 'Premium Shirt',
        slug: 'premium-shirt',
        listPrice: 200000, // 2000.00 INR
        salePrice: 150000, // 1500.00 INR
      });
      expect(valid.success).toBe(true);

      // Equal pricing is valid
      const equal = createProductSchema.safeParse({
        title: 'Premium Shirt',
        slug: 'premium-shirt',
        listPrice: 200000,
        salePrice: 200000,
      });
      expect(equal.success).toBe(true);

      // Invalid: salePrice > listPrice
      const invalid = createProductSchema.safeParse({
        title: 'Premium Shirt',
        slug: 'premium-shirt',
        listPrice: 100000,
        salePrice: 150000,
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0].message).toContain('Sale price must be less than or equal to list price');
      }
    });

    it('rejects floating-point or negative list prices', () => {
      // Floating point must fail integer minor units check
      const floatRes = createProductSchema.safeParse({
        title: 'Shirt',
        slug: 'shirt',
        listPrice: 19.99,
      });
      expect(floatRes.success).toBe(false);

      // Negative list price
      const negRes = createProductSchema.safeParse({
        title: 'Shirt',
        slug: 'shirt',
        listPrice: -500,
      });
      expect(negRes.success).toBe(false);
    });

    it('enforces non-negative stock quantity on variants', () => {
      const valid = createVariantSchema.safeParse({
        sku: 'SHIRT-RED-M',
        stockQuantity: 10,
      });
      expect(valid.success).toBe(true);

      const zero = createVariantSchema.safeParse({
        sku: 'SHIRT-RED-M',
        stockQuantity: 0,
      });
      expect(zero.success).toBe(true);

      const negative = createVariantSchema.safeParse({
        sku: 'SHIRT-RED-M',
        stockQuantity: -5,
      });
      expect(negative.success).toBe(false);
    });

    it('validates inventory adjustment schema rejects zero delta', () => {
      const valid = inventoryAdjustmentSchema.safeParse({
        delta: -5,
        reason: 'damage',
      });
      expect(valid.success).toBe(true);

      const zeroDelta = inventoryAdjustmentSchema.safeParse({
        delta: 0,
        reason: 'audit',
      });
      expect(zeroDelta.success).toBe(false);
    });

    it('validates category slug format', () => {
      const valid = createCategorySchema.safeParse({
        name: 'Electronics',
        slug: 'electronics-gadgets',
      });
      expect(valid.success).toBe(true);

      const uppercase = createCategorySchema.safeParse({
        name: 'Electronics',
        slug: 'Electronics',
      });
      expect(uppercase.success).toBe(false);

      const withSpaces = createCategorySchema.safeParse({
        name: 'Electronics',
        slug: 'electronics gadgets',
      });
      expect(withSpaces.success).toBe(false);
    });
  });

  describe('2. Unified Single-Product vs Multi-Variant Invariants', () => {
    it('creates default variant automatically when product has no explicit variants', async () => {
      const tenantId = 'ten_01JABCDEF1234567890';
      const actorId = 'usr_01JABCDEF1234567890';

      const mockDbInstance = createMockDb();

      const product = await createProduct(
        tenantId,
        {
          title: 'Minimalist Coffee Mug',
          slug: 'minimalist-coffee-mug',
          listPrice: 50000, // 500.00 INR
          initialStock: 25,
          sku: 'MUG-BLK-01',
        },
        actorId,
        mockDbInstance
      );

      expect(product).toBeDefined();
      expect(product.title).toBe('Minimalist Coffee Mug');
      expect(product.variants).toBeDefined();
      expect(product.variants).toHaveLength(1);

      const defaultVariant = product.variants![0];
      expect(defaultVariant.sku).toBe('MUG-BLK-01');
      expect(defaultVariant.stockQuantity).toBe(25);
      expect(defaultVariant.name).toBe('Default');

      // Check initial inventory movement was recorded
      expect(mockDbInstance._store.inventory_movements).toHaveLength(1);
      const movement = mockDbInstance._store.inventory_movements[0];
      expect(movement.variantId).toBe(defaultVariant.id);
      expect(movement.delta).toBe(25);
      expect(movement.reason).toBe('initial_stock');
      expect(movement.tenantId).toBe(tenantId);
    });

    it('supports multiple explicit variants with specific stock and pricing', async () => {
      const tenantId = 'ten_01JABCDEF1234567890';
      const actorId = 'usr_01JABCDEF1234567890';
      const mockDbInstance = createMockDb();

      const product = await createProduct(
        tenantId,
        {
          title: 'Crew Neck T-Shirt',
          slug: 'crew-neck-t-shirt',
          listPrice: 99900,
          variants: [
            { sku: 'TSHIRT-BLK-S', name: 'Black / Small', stockQuantity: 10 },
            { sku: 'TSHIRT-BLK-M', name: 'Black / Medium', stockQuantity: 20 },
            { sku: 'TSHIRT-BLK-L', name: 'Black / Large', stockQuantity: 15, priceOverride: 119900 },
          ],
        },
        actorId,
        mockDbInstance
      );

      expect(product.variants).toHaveLength(3);
      expect(product.variants![0].sku).toBe('TSHIRT-BLK-S');
      expect(product.variants![0].stockQuantity).toBe(10);
      expect(product.variants![2].priceOverride).toBe(119900);

      // Verify each variant with stock > 0 gets an initial inventory movement
      expect(mockDbInstance._store.inventory_movements).toHaveLength(3);
      expect(mockDbInstance._store.inventory_movements.map((m: any) => m.delta)).toEqual([10, 20, 15]);
    });

    it('rejects duplicate SKUs within product variants', async () => {
      const tenantId = 'ten_01JABCDEF1234567890';
      const mockDbInstance = createMockDb();

      await expect(
        createProduct(
          tenantId,
          {
            title: 'Sneakers',
            slug: 'sneakers',
            listPrice: 499900,
            variants: [
              { sku: 'SNK-BLK-42', name: 'Size 42', stockQuantity: 5 },
              { sku: 'SNK-BLK-42', name: 'Size 42 Duplicate', stockQuantity: 3 },
            ],
          },
          'usr_1',
          mockDbInstance
        )
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('3. Inventory Movement Ledger Immutability & Stock Invariants', () => {
    it('adjusts inventory and appends an immutable movement record', async () => {
      const tenantId = 'ten_tenant_a';
      const mockDbInstance = createMockDb();

      // Seed a variant with stock = 10
      const variant = {
        id: 'var_001',
        tenantId,
        productId: 'prod_001',
        sku: 'ITEM-01',
        stockQuantity: 10,
        isActive: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDbInstance._store.product_variants.push(variant);

      // Deduct 4 items
      const { variant: updated, movement } = await adjustInventory(
        tenantId,
        'var_001',
        -4,
        'order_fulfilled',
        'usr_actor',
        'ord_123',
        false,
        mockDbInstance
      );

      expect(updated.stockQuantity).toBe(6);
      expect(movement.delta).toBe(-4);
      expect(movement.reason).toBe('order_fulfilled');
      expect(movement.referenceId).toBe('ord_123');
      expect(movement.actorId).toBe('usr_actor');
      expect(movement.tenantId).toBe(tenantId);
      expect(mockDbInstance._store.inventory_movements).toHaveLength(1);
    });

    it('prevents stock from dropping below zero unless backorder is enabled', async () => {
      const tenantId = 'ten_tenant_a';
      const mockDbInstance = createMockDb();

      const variant = {
        id: 'var_002',
        tenantId,
        productId: 'prod_002',
        sku: 'ITEM-02',
        stockQuantity: 5,
        isActive: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDbInstance._store.product_variants.push(variant);

      // Deduct 10 when stock is 5 without allowBackorder
      await expect(
        adjustInventory(
          tenantId,
          'var_002',
          -10,
          'order_placed',
          'usr_actor',
          'ord_999',
          false,
          mockDbInstance
        )
      ).rejects.toThrow(ConflictError);

      // With backorder allowed, stock can go negative
      const { variant: backordered } = await adjustInventory(
        tenantId,
        'var_002',
        -10,
        'backorder_placed',
        'usr_actor',
        'ord_999',
        true,
        mockDbInstance
      );
      expect(backordered.stockQuantity).toBe(-5);
    });
  });

  describe('4. Tenant Isolation Verification', () => {
    it('Tenant A cannot view or edit Tenant B category', async () => {
      const mockDbInstance = createMockDb();

      // Seed category in Tenant B
      const tenantBCat = {
        id: 'cat_tenant_b_1',
        tenantId: 'tenant_b',
        name: 'Tenant B Category',
        slug: 'tenant-b-cat',
        status: 'active',
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDbInstance._store.categories.push(tenantBCat);

      // Tenant A tries to get Category of Tenant B
      await expect(
        getCategoryById('tenant_a', 'cat_tenant_b_1', mockDbInstance)
      ).rejects.toThrow(NotFoundError);

      // Tenant A tries to update Category of Tenant B
      await expect(
        updateCategory('tenant_a', 'cat_tenant_b_1', { name: 'Hacked' }, 'usr_a', mockDbInstance)
      ).rejects.toThrow(NotFoundError);

      // Tenant A tries to delete Category of Tenant B
      await expect(
        deleteCategory('tenant_a', 'cat_tenant_b_1', 'usr_a', {}, mockDbInstance)
      ).rejects.toThrow(NotFoundError);
    });

    it('Tenant A cannot view or adjust inventory of Tenant B product variant', async () => {
      const mockDbInstance = createMockDb();

      // Seed product and variant in Tenant B
      const prodB = {
        id: 'prod_b_1',
        tenantId: 'tenant_b',
        title: 'Secret Gadget',
        slug: 'secret-gadget',
        listPrice: 10000,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const varB = {
        id: 'var_b_1',
        tenantId: 'tenant_b',
        productId: 'prod_b_1',
        sku: 'TB-SECRET-1',
        stockQuantity: 50,
        isActive: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDbInstance._store.products.push(prodB);
      mockDbInstance._store.product_variants.push(varB);

      // Tenant A tries to access product B
      await expect(
        getProductById('tenant_a', 'prod_b_1', mockDbInstance)
      ).rejects.toThrow(NotFoundError);

      // Tenant A tries to adjust inventory of Variant B
      await expect(
        adjustInventory('tenant_a', 'var_b_1', 10, 'fraud', 'usr_a', undefined, false, mockDbInstance)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('5. CSV Formula Injection Defense', () => {
    it('escapes cells starting with formula trigger characters (=, +, -, @)', () => {
      expect(csvEscape('=1+1')).toBe('\t=1+1');
      expect(csvEscape('+CMD|"/c calc"!A1')).toBe('"\t+CMD|""/c calc""!A1"');
      expect(csvEscape('-5*5')).toBe('\t-5*5');
      expect(csvEscape('@SUM(A1:A5)')).toBe('\t@SUM(A1:A5)');
    });

    it('exports CSV with sanitized formula strings', async () => {
      const tenantId = 'ten_csv_test';
      const mockDbInstance = createMockDb();

      // Seed product with malicious formula in title and SKU
      const product = {
        id: 'prod_malicious_1',
        tenantId,
        title: '=cmd|"/c calc"!A0',
        slug: 'malicious-formula',
        categoryId: null,
        status: 'active',
        listPrice: 5000,
        salePrice: null,
        isFeatured: false,
        isTrending: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const variant = {
        id: 'var_malicious_1',
        tenantId,
        productId: 'prod_malicious_1',
        sku: '+SKU-EXPLOIT',
        name: '@AdminUser',
        stockQuantity: 10,
        priceOverride: null,
        isActive: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDbInstance._store.products.push(product);
      mockDbInstance._store.product_variants.push(variant);

      const csv = await exportProductsCsv(tenantId, mockDbInstance);

      // Header row
      expect(csv).toContain('Product ID,Title,Slug,Category,Status');

      // The malicious values must be prefixed with a tab \t and escaped
      expect(csv).toContain('"\t=cmd|""/c calc""!A0"');
      expect(csv).toContain('\t+SKU-EXPLOIT');
      expect(csv).toContain('\t@AdminUser');
    });
  });
});
