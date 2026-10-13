import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { db, DbOrTx } from '@/lib/db';
import { categories, products } from '@/lib/db/schema';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { generateId } from '@/lib/utils';
import { recordAuditLog } from '@/modules/audit/audit-service';
import type {
  Category,
  CategoryFilterOptions,
  CreateCategoryInput,
  UpdateCategoryInput,
} from './types';
import { createCategorySchema, updateCategorySchema } from './types';

/**
 * Creates a new category scoped strictly to the specified tenant.
 * Validates slug uniqueness within the tenant, and that parentId belongs to the same tenant.
 *
 * @param tenantId - The target tenant identifier
 * @param data - Category creation payload
 * @param actorId - The user performing the creation
 * @param tx - Optional transaction handle
 * @returns Created Category
 */
export async function createCategory(
  tenantId: string,
  data: CreateCategoryInput,
  actorId: string,
  tx?: DbOrTx
): Promise<Category> {
  if (!tenantId) {
    throw new ValidationError('Tenant ID is required');
  }

  const validated = createCategorySchema.parse(data);

  const executeOperation = async (t: DbOrTx): Promise<Category> => {
    // 1. Slug uniqueness within tenant
    const [existing] = await t
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.tenantId, tenantId), eq(categories.slug, validated.slug)))
      .limit(1);

    if (existing) {
      throw new ConflictError(
        `Category with slug '${validated.slug}' already exists in this store`
      );
    }

    // 2. Validate parent category belongs to the same tenant
    if (validated.parentId) {
      const [parent] = await t
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.tenantId, tenantId), eq(categories.id, validated.parentId)))
        .limit(1);

      if (!parent) {
        throw new NotFoundError(
          `Parent category with ID '${validated.parentId}' does not exist in this store`
        );
      }
    }

    const id = generateId();
    const [category] = await t
      .insert(categories)
      .values({
        id,
        tenantId,
        parentId: validated.parentId ?? null,
        name: validated.name,
        slug: validated.slug,
        description: validated.description ?? null,
        imageAssetId: validated.imageAssetId ?? null,
        iconName: validated.iconName ?? null,
        sortOrder: validated.sortOrder ?? 0,
        status: validated.status ?? 'active',
      })
      .returning();

    await recordAuditLog(
      {
        tenantId,
        actorId,
        action: 'category:create',
        resourceType: 'category',
        resourceId: category.id,
        outcome: 'success',
        metadata: {
          name: category.name,
          slug: category.slug,
          parentId: category.parentId,
        },
      },
      t
    );

    return category as Category;
  };

  if (tx) {
    return executeOperation(tx);
  }

  return db.transaction(async (t) => executeOperation(t));
}

/**
 * Retrieves a single category by its ULID, strictly tenant-scoped.
 *
 * @param tenantId - The target tenant identifier
 * @param id - Category ULID
 * @param tx - Optional transaction handle
 * @returns Category domain model
 * @throws {NotFoundError} If category does not exist in the tenant
 */
export async function getCategoryById(
  tenantId: string,
  id: string,
  tx?: DbOrTx
): Promise<Category> {
  if (!tenantId || !id) {
    throw new ValidationError('Tenant ID and Category ID are required');
  }

  const executor = tx ?? db;
  const [category] = await executor
    .select()
    .from(categories)
    .where(and(eq(categories.tenantId, tenantId), eq(categories.id, id)))
    .limit(1);

  if (!category) {
    throw new NotFoundError(`Category with ID '${id}' not found`);
  }

  return category as Category;
}

/**
 * Retrieves a single category by its slug, strictly tenant-scoped.
 *
 * @param tenantId - The target tenant identifier
 * @param slug - Category slug
 * @param tx - Optional transaction handle
 * @returns Category domain model or null
 */
export async function getCategoryBySlug(
  tenantId: string,
  slug: string,
  tx?: DbOrTx
): Promise<Category | null> {
  if (!tenantId || !slug) {
    return null;
  }

  const executor = tx ?? db;
  const [category] = await executor
    .select()
    .from(categories)
    .where(and(eq(categories.tenantId, tenantId), eq(categories.slug, slug.trim().toLowerCase())))
    .limit(1);

  return (category as Category) ?? null;
}

/**
 * Lists categories within a tenant with optional filtering.
 * Supports nesting children if requested.
 *
 * @param tenantId - The target tenant identifier
 * @param options - Filtering and nesting options
 * @param tx - Optional transaction handle
 * @returns Array of categories
 */
export async function listCategories(
  tenantId: string,
  options: CategoryFilterOptions = {},
  tx?: DbOrTx
): Promise<Category[]> {
  if (!tenantId) {
    throw new ValidationError('Tenant ID is required');
  }

  const executor = tx ?? db;
  const conditions = [eq(categories.tenantId, tenantId)];

  if (options.status) {
    conditions.push(eq(categories.status, options.status));
  }

  if (options.parentId !== undefined) {
    if (options.parentId === null) {
      conditions.push(isNull(categories.parentId));
    } else {
      conditions.push(eq(categories.parentId, options.parentId));
    }
  }

  const items = await executor
    .select()
    .from(categories)
    .where(and(...conditions))
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  if (!options.includeChildren) {
    return items as Category[];
  }

  // If includeChildren is requested, fetch all child categories for the tenant
  const allSubcategories = await executor
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.tenantId, tenantId),
        options.status ? eq(categories.status, options.status) : sql`TRUE`
      )
    )
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  const subMap = new Map<string, Category[]>();
  for (const cat of allSubcategories) {
    if (cat.parentId) {
      const list = subMap.get(cat.parentId) ?? [];
      list.push(cat as Category);
      subMap.set(cat.parentId, list);
    }
  }

  return (items as Category[]).map((cat) => ({
    ...cat,
    subcategories: subMap.get(cat.id) ?? [],
  }));
}

/**
 * Updates an existing category within the tenant.
 *
 * @param tenantId - The target tenant identifier
 * @param id - Category ID
 * @param data - Update payload
 * @param actorId - The user performing the update
 * @param tx - Optional transaction handle
 * @returns Updated Category
 */
export async function updateCategory(
  tenantId: string,
  id: string,
  data: UpdateCategoryInput,
  actorId: string,
  tx?: DbOrTx
): Promise<Category> {
  if (!tenantId || !id) {
    throw new ValidationError('Tenant ID and Category ID are required');
  }

  const validated = updateCategorySchema.parse(data);

  const executeOperation = async (t: DbOrTx): Promise<Category> => {
    // 1. Ensure category exists within tenant
    const current = await getCategoryById(tenantId, id, t);

    // 2. Validate slug uniqueness if changed
    if (validated.slug && validated.slug !== current.slug) {
      const [existing] = await t
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.tenantId, tenantId),
            eq(categories.slug, validated.slug),
            sql`${categories.id} != ${id}`
          )
        )
        .limit(1);

      if (existing) {
        throw new ConflictError(
          `Category with slug '${validated.slug}' already exists in this store`
        );
      }
    }

    // 3. Prevent cyclic parent reference or invalid parent
    if (validated.parentId !== undefined) {
      if (validated.parentId === id) {
        throw new ValidationError('A category cannot be its own parent');
      }

      if (validated.parentId !== null) {
        const [parent] = await t
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.tenantId, tenantId), eq(categories.id, validated.parentId)))
          .limit(1);

        if (!parent) {
          throw new NotFoundError(
            `Parent category with ID '${validated.parentId}' does not exist in this store`
          );
        }
      }
    }

    const updates: Partial<typeof categories.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (validated.name !== undefined) updates.name = validated.name;
    if (validated.slug !== undefined) updates.slug = validated.slug;
    if (validated.parentId !== undefined) updates.parentId = validated.parentId;
    if (validated.description !== undefined) updates.description = validated.description;
    if (validated.imageAssetId !== undefined) updates.imageAssetId = validated.imageAssetId;
    if (validated.iconName !== undefined) updates.iconName = validated.iconName;
    if (validated.sortOrder !== undefined) updates.sortOrder = validated.sortOrder;
    if (validated.status !== undefined) updates.status = validated.status;

    const [updated] = await t
      .update(categories)
      .set(updates)
      .where(and(eq(categories.tenantId, tenantId), eq(categories.id, id)))
      .returning();

    await recordAuditLog(
      {
        tenantId,
        actorId,
        action: 'category:update',
        resourceType: 'category',
        resourceId: id,
        outcome: 'success',
        metadata: {
          updatedFields: updates,
        },
      },
      t
    );

    return updated as Category;
  };

  if (tx) {
    return executeOperation(tx);
  }

  return db.transaction(async (t) => executeOperation(t));
}

/**
 * Deletes or deactivates a category within the tenant.
 * Enforces business rule: checks that no active products are assigned to this category before deleting.
 * If active products exist, throws ConflictError. If cascaded to inactive, updates status.
 *
 * @param tenantId - The target tenant identifier
 * @param id - Category ID
 * @param actorId - The user performing the deletion
 * @param options - Cascading options
 * @param tx - Optional transaction handle
 */
export async function deleteCategory(
  tenantId: string,
  id: string,
  actorId: string,
  options: { cascadeToInactive?: boolean } = {},
  tx?: DbOrTx
): Promise<{ success: boolean; deleted: boolean }> {
  if (!tenantId || !id) {
    throw new ValidationError('Tenant ID and Category ID are required');
  }

  const executeOperation = async (t: DbOrTx): Promise<{ success: boolean; deleted: boolean }> => {
    // 1. Verify category exists within tenant
    const category = await getCategoryById(tenantId, id, t);

    // 2. Check for active products in this category
    const [activeProductCount] = await t
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.categoryId, id),
          eq(products.status, 'active')
        )
      );

    if (activeProductCount && activeProductCount.count > 0) {
      if (options.cascadeToInactive) {
        // Soft deactivate category instead
        await t
          .update(categories)
          .set({ status: 'inactive', updatedAt: new Date() })
          .where(and(eq(categories.tenantId, tenantId), eq(categories.id, id)));

        await recordAuditLog(
          {
            tenantId,
            actorId,
            action: 'category:deactivate',
            resourceType: 'category',
            resourceId: id,
            outcome: 'success',
            metadata: {
              reason: 'cascade_active_products_exist',
              activeProductCount: activeProductCount.count,
            },
          },
          t
        );

        return { success: true, deleted: false };
      }

      throw new ConflictError(
        `Cannot delete category '${category.name}' because it contains ${activeProductCount.count} active product(s)`
      );
    }

    // 3. Unlink any products or subcategories before hard deletion
    await t
      .update(products)
      .set({ categoryId: null, updatedAt: new Date() })
      .where(and(eq(products.tenantId, tenantId), eq(products.categoryId, id)));

    await t
      .update(categories)
      .set({ parentId: null, updatedAt: new Date() })
      .where(and(eq(categories.tenantId, tenantId), eq(categories.parentId, id)));

    await t
      .delete(categories)
      .where(and(eq(categories.tenantId, tenantId), eq(categories.id, id)));

    await recordAuditLog(
      {
        tenantId,
        actorId,
        action: 'category:delete',
        resourceType: 'category',
        resourceId: id,
        outcome: 'success',
        metadata: {
          name: category.name,
          slug: category.slug,
        },
      },
      t
    );

    return { success: true, deleted: true };
  };

  if (tx) {
    return executeOperation(tx);
  }

  return db.transaction(async (t) => executeOperation(t));
}
