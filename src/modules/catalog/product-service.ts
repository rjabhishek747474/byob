import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db, DbOrTx } from '@/lib/db';
import {
  categories,
  inventoryMovements,
  productImages,
  products,
  productVariants,
} from '@/lib/db/schema';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { csvEscape, generateId } from '@/lib/utils';
import { recordAuditLog } from '@/modules/audit/audit-service';
import type {
  CreateProductInput,
  CreateVariantInput,
  InventoryAdjustmentInput,
  InventoryMovement,
  Product,
  ProductFilterOptions,
  ProductImage,
  ProductVariant,
  UpdateProductInput,
  UpdateVariantInput,
} from './types';
import {
  createProductSchema,
  createVariantSchema,
  inventoryAdjustmentSchema,
  updateProductSchema,
  updateVariantSchema,
} from './types';

/**
 * Creates a product and its variants inside a transaction.
 * Unified 1-product and many-product model:
 * If no explicit variants are passed, automatically generates a default variant:
 * (sku = provided or generated, stock = initialStock ?? 0, priceOverride = null).
 * Also creates initial inventory movement records for any non-zero initial stock.
 *
 * @param tenantId - Tenant identifier
 * @param data - Product creation payload
 * @param actorId - Actor ID performing creation
 * @param tx - Optional transaction handle
 * @returns Fully populated Product with variants and images
 */
export async function createProduct(
  tenantId: string,
  data: CreateProductInput,
  actorId: string,
  tx?: DbOrTx
): Promise<Product> {
  if (!tenantId) {
    throw new ValidationError('Tenant ID is required');
  }

  const validated = createProductSchema.parse(data);

  const executeOperation = async (t: DbOrTx): Promise<Product> => {
    // 1. Slug uniqueness within tenant
    const [existing] = await t
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.slug, validated.slug)))
      .limit(1);

    if (existing) {
      throw new ConflictError(
        `Product with slug '${validated.slug}' already exists in this store`
      );
    }

    // 2. Validate categoryId belongs to the same tenant if provided
    if (validated.categoryId) {
      const [category] = await t
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.tenantId, tenantId), eq(categories.id, validated.categoryId)))
        .limit(1);

      if (!category) {
        throw new NotFoundError(
          `Category with ID '${validated.categoryId}' does not exist in this store`
        );
      }
    }

    // 3. Create Product record
    const productId = generateId();
    const [newProduct] = await t
      .insert(products)
      .values({
        id: productId,
        tenantId,
        title: validated.title,
        slug: validated.slug,
        description: validated.description ?? null,
        categoryId: validated.categoryId ?? null,
        status: validated.status ?? 'draft',
        listPrice: validated.listPrice,
        salePrice: validated.salePrice ?? null,
        isFeatured: validated.isFeatured ?? false,
        isTrending: validated.isTrending ?? false,
        deliveryFeeOverride: validated.deliveryFeeOverride ?? null,
        seoTitle: validated.seoTitle ?? null,
        seoDescription: validated.seoDescription ?? null,
      })
      .returning();

    // 4. Handle variants: either explicit variants array or unified default variant
    const createdVariants: ProductVariant[] = [];
    const rawVariants =
      validated.variants && validated.variants.length > 0
        ? validated.variants
        : [
            {
              sku:
                validated.sku?.trim() ||
                `${validated.slug.slice(0, 10).toUpperCase()}-${generateId().slice(-6)}`,
              name: 'Default',
              optionValues: null,
              priceOverride: null,
              stockQuantity: validated.initialStock ?? 0,
              isActive: true,
              sortOrder: 0,
            },
          ];

    // Check SKU uniqueness within tenant before inserting
    const skuSet = new Set<string>();
    for (const v of rawVariants) {
      const skuNorm = v.sku.trim();
      if (skuSet.has(skuNorm)) {
        throw new ConflictError(`Duplicate SKU '${skuNorm}' within product variants`);
      }
      skuSet.add(skuNorm);
    }

    const existingSkus = await t
      .select({ sku: productVariants.sku })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.tenantId, tenantId),
          inArray(productVariants.sku, Array.from(skuSet))
        )
      );

    if (existingSkus.length > 0) {
      throw new ConflictError(
        `Variant SKU '${existingSkus[0].sku}' is already in use by another product in this store`
      );
    }

    // Insert variants and record initial inventory movements if stock > 0
    for (let i = 0; i < rawVariants.length; i++) {
      const v = rawVariants[i];
      const variantId = generateId();
      const stock = Math.max(0, v.stockQuantity ?? 0);

      const [variant] = await t
        .insert(productVariants)
        .values({
          id: variantId,
          tenantId,
          productId,
          sku: v.sku.trim(),
          name: v.name ?? null,
          optionValues: v.optionValues ?? null,
          priceOverride: v.priceOverride ?? null,
          stockQuantity: stock,
          isActive: v.isActive ?? true,
          sortOrder: v.sortOrder ?? i,
        })
        .returning();

      createdVariants.push(variant as ProductVariant);

      if (stock > 0) {
        await t.insert(inventoryMovements).values({
          id: generateId(),
          tenantId,
          variantId,
          delta: stock,
          reason: 'initial_stock',
          referenceId: productId,
          actorId,
        });
      }
    }

    // 5. Handle product images
    if (validated.images && validated.images.length > 0) {
      for (let i = 0; i < validated.images.length; i++) {
        const img = validated.images[i];
        await t.insert(productImages).values({
          id: generateId(),
          tenantId,
          productId,
          assetId: img.assetId,
          altText: img.altText ?? null,
          sortOrder: img.sortOrder ?? i,
        });
      }
    }

    // 6. Record audit log
    await recordAuditLog(
      {
        tenantId,
        actorId,
        action: 'product:create',
        resourceType: 'product',
        resourceId: productId,
        outcome: 'success',
        metadata: {
          title: newProduct.title,
          slug: newProduct.slug,
          listPrice: newProduct.listPrice,
          variantCount: createdVariants.length,
        },
      },
      t
    );

    return {
      ...(newProduct as Product),
      variants: createdVariants,
    };
  };

  if (tx) {
    return executeOperation(tx);
  }

  return db.transaction(async (t) => executeOperation(t));
}

/**
 * Retrieves a single product by ULID, strictly tenant-scoped, with variants, category, and images.
 *
 * @param tenantId - Tenant identifier
 * @param id - Product ULID
 * @param tx - Optional transaction handle
 * @returns Product domain model
 * @throws {NotFoundError} If product not found
 */
export async function getProductById(
  tenantId: string,
  id: string,
  tx?: DbOrTx
): Promise<Product> {
  if (!tenantId || !id) {
    throw new ValidationError('Tenant ID and Product ID are required');
  }

  const executor = tx ?? db;
  const [product] = await executor
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.id, id)))
    .limit(1);

  if (!product) {
    throw new NotFoundError(`Product with ID '${id}' not found`);
  }

  const [variantsList, imagesList, categoryList] = await Promise.all([
    executor
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.tenantId, tenantId), eq(productVariants.productId, id)))
      .orderBy(asc(productVariants.sortOrder)),
    executor
      .select()
      .from(productImages)
      .where(and(eq(productImages.tenantId, tenantId), eq(productImages.productId, id)))
      .orderBy(asc(productImages.sortOrder)),
    product.categoryId
      ? executor
          .select()
          .from(categories)
          .where(
            and(eq(categories.tenantId, tenantId), eq(categories.id, product.categoryId))
          )
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    ...(product as Product),
    category: categoryList[0] ? (categoryList[0] as Product['category']) : null,
    variants: variantsList as ProductVariant[],
    images: imagesList as Product['images'],
  };
}

/**
 * Retrieves a product by slug, strictly tenant-scoped, with variants, category, and images.
 *
 * @param tenantId - Tenant identifier
 * @param slug - Product slug
 * @param tx - Optional transaction handle
 * @returns Product domain model or null
 */
export async function getProductBySlug(
  tenantId: string,
  slug: string,
  tx?: DbOrTx
): Promise<Product | null> {
  if (!tenantId || !slug) {
    return null;
  }

  const executor = tx ?? db;
  const normalizedSlug = slug.trim().toLowerCase();

  const [product] = await executor
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.slug, normalizedSlug)))
    .limit(1);

  if (!product) {
    return null;
  }

  const [variantsList, imagesList, categoryList] = await Promise.all([
    executor
      .select()
      .from(productVariants)
      .where(
        and(eq(productVariants.tenantId, tenantId), eq(productVariants.productId, product.id))
      )
      .orderBy(asc(productVariants.sortOrder)),
    executor
      .select()
      .from(productImages)
      .where(
        and(eq(productImages.tenantId, tenantId), eq(productImages.productId, product.id))
      )
      .orderBy(asc(productImages.sortOrder)),
    product.categoryId
      ? executor
          .select()
          .from(categories)
          .where(
            and(eq(categories.tenantId, tenantId), eq(categories.id, product.categoryId))
          )
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    ...(product as Product),
    category: categoryList[0] ? (categoryList[0] as Product['category']) : null,
    variants: variantsList as ProductVariant[],
    images: imagesList as Product['images'],
  };
}

/**
 * Lists products within a tenant with search, filtering, sorting, and pagination.
 *
 * @param tenantId - Tenant identifier
 * @param options - Search and filtering options
 * @param tx - Optional transaction handle
 * @returns Paginated products with count and metadata
 */
export async function listProducts(
  tenantId: string,
  options: ProductFilterOptions = {},
  tx?: DbOrTx
): Promise<{
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  if (!tenantId) {
    throw new ValidationError('Tenant ID is required');
  }

  const executor = tx ?? db;
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const conditions = [eq(products.tenantId, tenantId)];

  if (options.status) {
    conditions.push(eq(products.status, options.status));
  }

  if (options.categoryId) {
    conditions.push(eq(products.categoryId, options.categoryId));
  }

  if (options.isFeatured !== undefined) {
    conditions.push(eq(products.isFeatured, options.isFeatured));
  }

  if (options.isTrending !== undefined) {
    conditions.push(eq(products.isTrending, options.isTrending));
  }

  if (options.search && options.search.trim().length > 0) {
    const term = `%${options.search.trim()}%`;
    const searchFilter = or(ilike(products.title, term), ilike(products.slug, term));
    if (searchFilter !== undefined) {
      conditions.push(searchFilter);
    }
  }

  const whereClause = and(...conditions);

  let orderByClause = desc(products.createdAt);
  if (options.sort === 'price_asc') {
    orderByClause = asc(products.listPrice);
  } else if (options.sort === 'price_desc') {
    orderByClause = desc(products.listPrice);
  } else if (options.sort === 'created_asc') {
    orderByClause = asc(products.createdAt);
  } else if (options.sort === 'created_desc') {
    orderByClause = desc(products.createdAt);
  } else if (options.sort === 'title_asc') {
    orderByClause = asc(products.title);
  } else if (options.sort === 'title_desc') {
    orderByClause = desc(products.title);
  }

  const [items, [{ count }]] = await Promise.all([
    executor
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(pageSize)
      .offset(offset),
    executor
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(whereClause),
  ]);

  if (items.length === 0) {
    return {
      items: [],
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize),
    };
  }

  // Batch query variants and images for the retrieved products
  const productIds = items.map((p) => p.id);
  const [allVariants, allImages] = await Promise.all([
    executor
      .select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.tenantId, tenantId),
          inArray(productVariants.productId, productIds)
        )
      )
      .orderBy(asc(productVariants.sortOrder)),
    executor
      .select()
      .from(productImages)
      .where(
        and(
          eq(productImages.tenantId, tenantId),
          inArray(productImages.productId, productIds)
        )
      )
      .orderBy(asc(productImages.sortOrder)),
  ]);

  const variantMap = new Map<string, ProductVariant[]>();
  for (const v of allVariants) {
    const list = variantMap.get(v.productId) ?? [];
    list.push(v as ProductVariant);
    variantMap.set(v.productId, list);
  }

  const imageMap = new Map<string, ProductImage[]>();
  for (const img of allImages) {
    const list = imageMap.get(img.productId) ?? [];
    list.push(img as ProductImage);
    imageMap.set(img.productId, list);
  }

  const enrichedItems = items.map((prod) => ({
    ...(prod as Product),
    variants: variantMap.get(prod.id) ?? [],
    images: imageMap.get(prod.id) ?? [],
  }));

  return {
    items: enrichedItems,
    total: count,
    page,
    pageSize,
    totalPages: Math.ceil(count / pageSize),
  };
}

/**
 * Updates an existing product within the tenant.
 * Validates salePrice <= listPrice (considering updated or existing listPrice).
 *
 * @param tenantId - Tenant identifier
 * @param id - Product ULID
 * @param data - Update payload
 * @param actorId - Actor ID performing update
 * @param tx - Optional transaction handle
 * @returns Updated Product
 */
export async function updateProduct(
  tenantId: string,
  id: string,
  data: UpdateProductInput,
  actorId: string,
  tx?: DbOrTx
): Promise<Product> {
  if (!tenantId || !id) {
    throw new ValidationError('Tenant ID and Product ID are required');
  }

  const validated = updateProductSchema.parse(data);

  const executeOperation = async (t: DbOrTx): Promise<Product> => {
    // 1. Fetch current product
    const current = await getProductById(tenantId, id, t);

    // 2. Validate salePrice <= listPrice combined check
    const effectiveListPrice = validated.listPrice !== undefined ? validated.listPrice : current.listPrice;
    const effectiveSalePrice =
      validated.salePrice !== undefined ? validated.salePrice : current.salePrice;

    if (effectiveSalePrice !== null && effectiveSalePrice > effectiveListPrice) {
      throw new ValidationError('Sale price must be less than or equal to list price', [
        { field: 'salePrice', message: 'Sale price cannot exceed list price' },
      ]);
    }

    // 3. Check slug uniqueness if changed
    if (validated.slug && validated.slug !== current.slug) {
      const [existing] = await t
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.tenantId, tenantId),
            eq(products.slug, validated.slug),
            sql`${products.id} != ${id}`
          )
        )
        .limit(1);

      if (existing) {
        throw new ConflictError(
          `Product with slug '${validated.slug}' already exists in this store`
        );
      }
    }

    // 4. Validate category if changed
    if (validated.categoryId !== undefined && validated.categoryId !== null) {
      const [category] = await t
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.tenantId, tenantId), eq(categories.id, validated.categoryId)))
        .limit(1);

      if (!category) {
        throw new NotFoundError(
          `Category with ID '${validated.categoryId}' does not exist in this store`
        );
      }
    }

    const updates: Partial<typeof products.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (validated.title !== undefined) updates.title = validated.title;
    if (validated.slug !== undefined) updates.slug = validated.slug;
    if (validated.description !== undefined) updates.description = validated.description;
    if (validated.categoryId !== undefined) updates.categoryId = validated.categoryId;
    if (validated.status !== undefined) updates.status = validated.status;
    if (validated.listPrice !== undefined) updates.listPrice = validated.listPrice;
    if (validated.salePrice !== undefined) updates.salePrice = validated.salePrice;
    if (validated.isFeatured !== undefined) updates.isFeatured = validated.isFeatured;
    if (validated.isTrending !== undefined) updates.isTrending = validated.isTrending;
    if (validated.deliveryFeeOverride !== undefined) updates.deliveryFeeOverride = validated.deliveryFeeOverride;
    if (validated.seoTitle !== undefined) updates.seoTitle = validated.seoTitle;
    if (validated.seoDescription !== undefined) updates.seoDescription = validated.seoDescription;

    const [updated] = await t
      .update(products)
      .set(updates)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, id)))
      .returning();

    await recordAuditLog(
      {
        tenantId,
        actorId,
        action: 'product:update',
        resourceType: 'product',
        resourceId: id,
        outcome: 'success',
        metadata: {
          updatedFields: updates,
        },
      },
      t
    );

    return getProductById(tenantId, id, t);
  };

  if (tx) {
    return executeOperation(tx);
  }

  return db.transaction(async (t) => executeOperation(t));
}

/**
 * Soft deletes a product by marking its status as 'archived'.
 *
 * @param tenantId - Tenant identifier
 * @param id - Product ULID
 * @param actorId - Actor ID performing deletion
 * @param tx - Optional transaction handle
 * @returns Archived product
 */
export async function deleteProduct(
  tenantId: string,
  id: string,
  actorId: string,
  tx?: DbOrTx
): Promise<Product> {
  if (!tenantId || !id) {
    throw new ValidationError('Tenant ID and Product ID are required');
  }

  const executeOperation = async (t: DbOrTx): Promise<Product> => {
    // Verify product exists within tenant
    const current = await getProductById(tenantId, id, t);

    const [updated] = await t
      .update(products)
      .set({
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(and(eq(products.tenantId, tenantId), eq(products.id, id)))
      .returning();

    await recordAuditLog(
      {
        tenantId,
        actorId,
        action: 'product:delete',
        resourceType: 'product',
        resourceId: id,
        outcome: 'success',
        metadata: {
          previousStatus: current.status,
          status: 'archived',
        },
      },
      t
    );

    return {
      ...current,
      status: 'archived',
    };
  };

  if (tx) {
    return executeOperation(tx);
  }

  return db.transaction(async (t) => executeOperation(t));
}

/**
 * Adjusts inventory for a specific variant in a transaction.
 * Updates stock (verifying new stock >= 0 unless explicit backorder),
 * and inserts an immutable row into `inventoryMovements`.
 *
 * @param tenantId - Tenant identifier
 * @param variantId - Product Variant ULID
 * @param delta - Stock adjustment (+ for add, - for deduct)
 * @param reason - Adjustment reason code
 * @param actorId - Optional user ID performing adjustment
 * @param referenceId - Optional order/batch reference ID
 * @param allowBackorder - Allow negative stock (default false)
 * @param tx - Optional transaction handle
 * @returns Updated Variant and created InventoryMovement
 */
export async function adjustInventory(
  tenantId: string,
  variantId: string,
  delta: number,
  reason: string,
  actorId?: string | null,
  referenceId?: string | null,
  allowBackorder = false,
  tx?: DbOrTx
): Promise<{ variant: ProductVariant; movement: InventoryMovement }> {
  if (!tenantId || !variantId) {
    throw new ValidationError('Tenant ID and Variant ID are required');
  }

  if (typeof delta !== 'number' || !Number.isInteger(delta) || delta === 0) {
    throw new ValidationError('Inventory delta must be a non-zero integer');
  }

  if (!reason || reason.trim().length === 0) {
    throw new ValidationError('Inventory adjustment reason is required');
  }

  const executeOperation = async (
    t: DbOrTx
  ): Promise<{ variant: ProductVariant; movement: InventoryMovement }> => {
    // 1. Fetch variant strictly within tenant
    const [variant] = await t
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.tenantId, tenantId), eq(productVariants.id, variantId)))
      .limit(1);

    if (!variant) {
      throw new NotFoundError(`Variant with ID '${variantId}' not found in this store`);
    }

    const currentStock = variant.stockQuantity;
    const newStock = currentStock + delta;

    // 2. Invariant: stock cannot go below zero unless explicit backorder allowed
    if (newStock < 0 && !allowBackorder) {
      throw new ConflictError(
        `Insufficient inventory for variant '${variant.sku}'. Current stock: ${currentStock}, Requested deduction: ${Math.abs(delta)}`
      );
    }

    // 3. Update variant stock
    const [updatedVariant] = await t
      .update(productVariants)
      .set({
        stockQuantity: newStock,
        updatedAt: new Date(),
      })
      .where(and(eq(productVariants.tenantId, tenantId), eq(productVariants.id, variantId)))
      .returning();

    // 4. Insert immutable inventory movement ledger record
    const movementId = generateId();
    const [movement] = await t
      .insert(inventoryMovements)
      .values({
        id: movementId,
        tenantId,
        variantId,
        delta,
        reason: reason.trim(),
        referenceId: referenceId ?? null,
        actorId: actorId ?? null,
      })
      .returning();

    await recordAuditLog(
      {
        tenantId,
        actorId: actorId ?? null,
        action: 'inventory:adjust',
        resourceType: 'product_variant',
        resourceId: variantId,
        outcome: 'success',
        metadata: {
          sku: variant.sku,
          previousStock: currentStock,
          newStock,
          delta,
          reason,
        },
      },
      t
    );

    return {
      variant: updatedVariant as ProductVariant,
      movement: movement as InventoryMovement,
    };
  };

  if (tx) {
    return executeOperation(tx);
  }

  return db.transaction(async (t) => executeOperation(t));
}

/**
 * Exports products and variants to a CSV formatted string.
 * Escapes all fields using `csvEscape` to defend against spreadsheet formula injection (=, +, -, @).
 *
 * @param tenantId - Tenant identifier
 * @param tx - Optional transaction handle
 * @returns RFC 4180 compliant CSV string
 */
export async function exportProductsCsv(tenantId: string, tx?: DbOrTx): Promise<string> {
  if (!tenantId) {
    throw new ValidationError('Tenant ID is required');
  }

  const executor = tx ?? db;

  // Query products, variants, and categories strictly scoped to tenant
  const [productList, variantList, categoryList] = await Promise.all([
    executor
      .select()
      .from(products)
      .where(eq(products.tenantId, tenantId))
      .orderBy(asc(products.createdAt)),
    executor
      .select()
      .from(productVariants)
      .where(eq(productVariants.tenantId, tenantId))
      .orderBy(asc(productVariants.sortOrder)),
    executor
      .select()
      .from(categories)
      .where(eq(categories.tenantId, tenantId)),
  ]);

  const categoryMap = new Map<string, string>();
  for (const c of categoryList) {
    categoryMap.set(c.id, c.name);
  }

  const productMap = new Map<string, typeof products.$inferSelect>();
  for (const p of productList) {
    productMap.set(p.id, p);
  }

  const headers = [
    'Product ID',
    'Title',
    'Slug',
    'Category',
    'Status',
    'List Price (Major)',
    'Sale Price (Major)',
    'Variant ID',
    'SKU',
    'Variant Name',
    'Stock Quantity',
    'Price Override (Major)',
    'Is Featured',
    'Is Trending',
  ];

  const rows: string[][] = [];

  for (const variant of variantList) {
    const product = productMap.get(variant.productId);
    if (!product) continue;

    const categoryName = product.categoryId ? categoryMap.get(product.categoryId) ?? '' : '';
    const listPriceMajor = (product.listPrice / 100).toFixed(2);
    const salePriceMajor =
      product.salePrice !== null ? (product.salePrice / 100).toFixed(2) : '';
    const priceOverrideMajor =
      variant.priceOverride !== null ? (variant.priceOverride / 100).toFixed(2) : '';

    rows.push([
      product.id,
      product.title,
      product.slug,
      categoryName,
      product.status,
      listPriceMajor,
      salePriceMajor,
      variant.id,
      variant.sku,
      variant.name ?? '',
      String(variant.stockQuantity),
      priceOverrideMajor,
      product.isFeatured ? 'Yes' : 'No',
      product.isTrending ? 'Yes' : 'No',
    ]);
  }

  // Format header and rows through csvEscape
  const escapedHeader = headers.map(csvEscape).join(',');
  const escapedRows = rows.map((row) => row.map(csvEscape).join(','));

  return [escapedHeader, ...escapedRows].join('\r\n');
}
