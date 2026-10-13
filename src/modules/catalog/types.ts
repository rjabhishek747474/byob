import { z } from 'zod/v4';

/**
 * Category lifecycle status.
 */
export type CategoryStatus = 'active' | 'inactive';

/**
 * Product lifecycle status.
 */
export type ProductStatus = 'active' | 'draft' | 'archived';

/**
 * Category domain model interface.
 */
export interface Category {
  id: string;
  tenantId: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  imageAssetId: string | null;
  iconName: string | null;
  sortOrder: number;
  status: CategoryStatus;
  createdAt: Date;
  updatedAt: Date;
  subcategories?: Category[];
}

/**
 * Product Variant domain model interface.
 */
export interface ProductVariant {
  id: string;
  tenantId: string;
  productId: string;
  sku: string;
  name: string | null;
  optionValues: Record<string, string> | null;
  priceOverride: number | null; // Minor units
  stockQuantity: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Product Image domain model interface.
 */
export interface ProductImage {
  id: string;
  tenantId: string;
  productId: string;
  assetId: string;
  altText: string | null;
  sortOrder: number;
  createdAt: Date;
}

/**
 * Product domain model interface.
 */
export interface Product {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  status: ProductStatus;
  listPrice: number; // Minor units (e.g. 1000 = 10.00)
  salePrice: number | null; // Minor units
  isFeatured: boolean;
  isTrending: boolean;
  deliveryFeeOverride: number | null; // Minor units
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  category?: Category | null;
  variants?: ProductVariant[];
  images?: ProductImage[];
}

/**
 * Inventory Movement ledger record interface.
 */
export interface InventoryMovement {
  id: string;
  tenantId: string;
  variantId: string;
  delta: number;
  reason: string;
  referenceId: string | null;
  actorId: string | null;
  createdAt: Date;
}

/**
 * Product filter and pagination options.
 */
export interface ProductFilterOptions {
  search?: string;
  categoryId?: string;
  status?: ProductStatus;
  isFeatured?: boolean;
  isTrending?: boolean;
  page?: number;
  pageSize?: number;
  sort?: 'price_asc' | 'price_desc' | 'created_desc' | 'created_asc' | 'title_asc' | 'title_desc';
}

/**
 * Category filter options.
 */
export interface CategoryFilterOptions {
  parentId?: string | null;
  status?: CategoryStatus;
  includeChildren?: boolean;
}

// ==========================================
// Zod Schemas
// ==========================================

/**
 * Schema for creating a category.
 */
export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(255, 'Category name too long'),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required')
    .max(255, 'Slug too long')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with single hyphens'),
  parentId: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  imageAssetId: z.string().trim().nullable().optional(),
  iconName: z.string().trim().max(100).nullable().optional(),
  sortOrder: z.number().int().default(0),
  status: z.enum(['active', 'inactive']).default('active'),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

/**
 * Schema for updating a category.
 */
export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(255, 'Category name too long').optional(),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required')
    .max(255, 'Slug too long')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with single hyphens')
    .optional(),
  parentId: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  imageAssetId: z.string().trim().nullable().optional(),
  iconName: z.string().trim().max(100).nullable().optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

/**
 * Schema for creating a variant within a product.
 */
export const createVariantSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required').max(100, 'SKU must not exceed 100 characters'),
  name: z.string().trim().max(255).nullable().optional(),
  optionValues: z.record(z.string(), z.string()).nullable().optional(),
  priceOverride: z.number().int().positive('Price override must be positive integer minor units').nullable().optional(),
  stockQuantity: z.number().int().min(0, 'Stock quantity must be greater than or equal to 0').default(0),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export type CreateVariantInput = z.input<typeof createVariantSchema>;
export type VariantOutput = z.infer<typeof createVariantSchema>;

/**
 * Schema for updating an existing variant.
 */
export const updateVariantSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required').max(100, 'SKU must not exceed 100 characters').optional(),
  name: z.string().trim().max(255).nullable().optional(),
  optionValues: z.record(z.string(), z.string()).nullable().optional(),
  priceOverride: z.number().int().positive('Price override must be positive integer minor units').nullable().optional(),
  stockQuantity: z.number().int().min(0, 'Stock quantity must be greater than or equal to 0').optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

/**
 * Schema for creating a product.
 * Enforces listPrice is a non-negative integer minor unit, and salePrice <= listPrice if specified.
 */
export const createProductSchema = z
  .object({
    title: z.string().trim().min(1, 'Product title is required').max(500, 'Title too long'),
    slug: z
      .string()
      .trim()
      .min(1, 'Slug is required')
      .max(500, 'Slug too long')
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with single hyphens'),
    description: z.string().trim().nullable().optional(),
    categoryId: z.string().trim().nullable().optional(),
    status: z.enum(['active', 'draft', 'archived']).default('draft'),
    listPrice: z.number().int().min(0, 'List price must be non-negative integer minor units'),
    salePrice: z.number().int().min(0, 'Sale price must be non-negative integer minor units').nullable().optional(),
    isFeatured: z.boolean().default(false),
    isTrending: z.boolean().default(false),
    deliveryFeeOverride: z.number().int().min(0).nullable().optional(),
    seoTitle: z.string().trim().max(255).nullable().optional(),
    seoDescription: z.string().trim().nullable().optional(),
    // Optional initial single-product stock or explicit multi-variants
    initialStock: z.number().int().min(0).optional(),
    sku: z.string().trim().max(100).optional(),
    variants: z.array(createVariantSchema).optional(),
    images: z
      .array(
        z.object({
          assetId: z.string().trim().min(1, 'Asset ID is required'),
          altText: z.string().trim().max(500).nullable().optional(),
          sortOrder: z.number().int().default(0),
        })
      )
      .optional(),
  })
  .refine(
    (data) => {
      if (data.salePrice !== undefined && data.salePrice !== null) {
        return data.salePrice <= data.listPrice;
      }
      return true;
    },
    {
      message: 'Sale price must be less than or equal to list price',
      path: ['salePrice'],
    }
  );

export type CreateProductInput = z.input<typeof createProductSchema>;
export type ProductOutput = z.infer<typeof createProductSchema>;

/**
 * Schema for updating an existing product.
 * Validates salePrice <= listPrice when both or either are modified.
 */
export const updateProductSchema = z
  .object({
    title: z.string().trim().min(1, 'Product title is required').max(500, 'Title too long').optional(),
    slug: z
      .string()
      .trim()
      .min(1, 'Slug is required')
      .max(500, 'Slug too long')
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with single hyphens')
      .optional(),
    description: z.string().trim().nullable().optional(),
    categoryId: z.string().trim().nullable().optional(),
    status: z.enum(['active', 'draft', 'archived']).optional(),
    listPrice: z.number().int().min(0, 'List price must be non-negative integer minor units').optional(),
    salePrice: z.number().int().min(0, 'Sale price must be non-negative integer minor units').nullable().optional(),
    isFeatured: z.boolean().optional(),
    isTrending: z.boolean().optional(),
    deliveryFeeOverride: z.number().int().min(0).nullable().optional(),
    seoTitle: z.string().trim().max(255).nullable().optional(),
    seoDescription: z.string().trim().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.salePrice !== undefined && data.salePrice !== null && data.listPrice !== undefined) {
        return data.salePrice <= data.listPrice;
      }
      return true;
    },
    {
      message: 'Sale price must be less than or equal to list price',
      path: ['salePrice'],
    }
  );

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/**
 * Schema for inventory adjustments.
 */
export const inventoryAdjustmentSchema = z.object({
  delta: z
    .number()
    .int()
    .refine((val) => val !== 0, 'Delta cannot be 0'),
  reason: z.string().trim().min(1, 'Reason is required').max(100, 'Reason too long'),
  actorId: z.string().trim().nullable().optional(),
  referenceId: z.string().trim().nullable().optional(),
  allowBackorder: z.boolean().default(false),
});

export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentSchema>;
