import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  memberships,
  pages,
  pageVersions,
  storeSettings,
  tenants,
  themes,
  users,
} from '@/lib/db/schema';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { generateId } from '@/lib/utils';
import { recordAuditLog } from '@/modules/audit/audit-service';
import type { DbOrTx } from '@/lib/db';

/**
 * Reserved slug words that cannot be used for tenant stores.
 */
export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'platform',
  'www',
  'store',
  'static',
  'assets',
  'cdn',
  'mail',
  'auth',
  'dashboard',
]);

/**
 * Tenant lifecycle status type.
 */
export type TenantStatus = 'active' | 'suspended' | 'archived';

/**
 * Input parameters for creating a new tenant.
 */
export interface CreateTenantInput {
  name: string;
  slug: string;
  ownerEmail: string;
  ownerName?: string | null;
  plan?: string;
  actorId?: string | null;
  correlationId?: string | null;
}

/**
 * Input parameters for listing tenants with pagination and filtering.
 */
export interface ListTenantsInput {
  status?: TenantStatus;
  page?: number;
  pageSize?: number;
  search?: string;
}

/**
 * Input parameters for updating tenant metadata.
 */
export interface UpdateTenantInput {
  name?: string;
  plan?: string;
}

/**
 * Validates the tenant slug format and ensures it does not conflict with reserved keywords.
 *
 * @param rawSlug - Tenant slug candidate
 * @throws {ValidationError} If slug format is invalid or reserved
 * @returns Clean, lowercase slug string
 */
export function validateTenantSlug(rawSlug: string): string {
  if (!rawSlug || typeof rawSlug !== 'string') {
    throw new ValidationError('Tenant slug is required');
  }

  const slug = rawSlug.trim().toLowerCase();

  if (slug.length < 3 || slug.length > 50) {
    throw new ValidationError('Tenant slug must be between 3 and 50 characters in length');
  }

  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugRegex.test(slug)) {
    throw new ValidationError(
      'Tenant slug must contain only lowercase alphanumeric characters and single hyphens, without leading or trailing hyphens'
    );
  }

  if (RESERVED_SLUGS.has(slug)) {
    throw new ValidationError(`Tenant slug '${slug}' is a reserved system keyword`);
  }

  return slug;
}

/**
 * Default color palette and styling tokens for a new store theme.
 */
const DEFAULT_THEME_CONFIG = {
  colors: {
    primary: '#1E3A8A',
    accent: '#D97706',
    background: '#FFFFFF',
    foreground: '#111827',
    surface: '#F3F4F6',
    muted: '#6B7280',
  },
  typography: {
    fontHeading: 'Inter',
    fontBody: 'Inter',
  },
  layout: {
    borderRadius: '8px',
    containerMaxWidth: '1280px',
  },
};

/**
 * Creates a new tenant alongside default store settings, theme, initial draft home page,
 * and assigns or provisions the owner user with role 'tenant_owner'.
 *
 * @param input - Tenant creation inputs
 * @param tx - Optional transaction handle
 * @returns Provisioned tenant and owner user records
 */
export async function createTenant(input: CreateTenantInput, tx?: DbOrTx) {
  const name = input.name?.trim();
  if (!name || name.length < 2 || name.length > 255) {
    throw new ValidationError('Tenant name must be between 2 and 255 characters');
  }

  const slug = validateTenantSlug(input.slug);

  const ownerEmail = input.ownerEmail?.trim().toLowerCase();
  if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    throw new ValidationError('A valid owner email address is required');
  }

  // Execute database operations inside a transaction
  const executeOperation = async (t: DbOrTx) => {
    // 1. Slug uniqueness check
    const [existing] = await t
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (existing) {
      throw new ConflictError(`Tenant with slug '${slug}' already exists`);
    }

    // 2. Create Tenant record
    const tenantId = generateId();
    const [newTenant] = await t
      .insert(tenants)
      .values({
        id: tenantId,
        name,
        slug,
        status: 'active',
        plan: input.plan ?? 'free',
      })
      .returning();

    // 3. Reuse or create owner user
    let [ownerUser] = await t
      .select()
      .from(users)
      .where(eq(users.email, ownerEmail))
      .limit(1);

    if (!ownerUser) {
      const ownerId = generateId();
      const [createdUser] = await t
        .insert(users)
        .values({
          id: ownerId,
          email: ownerEmail,
          name: input.ownerName?.trim() ?? null,
          status: 'active',
        })
        .returning();
      ownerUser = createdUser;
    }

    // 4. Create membership with role tenant_owner
    await t.insert(memberships).values({
      id: generateId(),
      tenantId: newTenant.id,
      userId: ownerUser.id,
      role: 'tenant_owner',
      status: 'active',
    });

    // 5. Create default store settings
    await t.insert(storeSettings).values({
      id: generateId(),
      tenantId: newTenant.id,
      storeName: name,
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      locale: 'en-IN',
      contactEmail: ownerEmail,
      deliveryFeeDefault: 0,
      analyticsEnabled: true,
      consentRequired: true,
      metaTitle: `${name} - Official Store`,
      metaDescription: `Welcome to ${name}. Shop our latest collection.`,
    });

    // 6. Create default theme
    await t.insert(themes).values({
      id: generateId(),
      tenantId: newTenant.id,
      name: 'default',
      draftConfig: DEFAULT_THEME_CONFIG,
      publishedConfig: DEFAULT_THEME_CONFIG,
      version: 1,
    });

    // 7. Create initial draft home page with starter blocks
    const homePageId = generateId();
    await t.insert(pages).values({
      id: homePageId,
      tenantId: newTenant.id,
      slug: 'home',
      pageType: 'home',
      title: 'Home',
      status: 'draft',
      seoTitle: `${name} - Home`,
      seoDescription: `Welcome to ${name}`,
    });

    await t.insert(pageVersions).values({
      id: generateId(),
      tenantId: newTenant.id,
      pageId: homePageId,
      versionNumber: 1,
      schemaVersion: 1,
      blocks: [
        {
          id: 'block-hero-1',
          type: 'hero',
          settings: {
            heading: `Welcome to ${name}`,
            subheading: 'Discover our exclusive products and special offers.',
            ctaText: 'Shop Now',
            ctaLink: '/products',
          },
        },
        {
          id: 'block-featured-1',
          type: 'featured_products',
          settings: {
            title: 'Featured Products',
            limit: 4,
          },
        },
      ],
    });

    // 8. Record audit log
    await recordAuditLog(
      {
        tenantId: newTenant.id,
        actorId: input.actorId ?? ownerUser.id,
        action: 'tenant:create',
        resourceType: 'tenant',
        resourceId: newTenant.id,
        outcome: 'success',
        metadata: {
          name: newTenant.name,
          slug: newTenant.slug,
          plan: newTenant.plan,
          ownerEmail: ownerUser.email,
        },
        correlationId: input.correlationId ?? null,
      },
      t
    );

    return {
      tenant: newTenant,
      owner: {
        id: ownerUser.id,
        email: ownerUser.email,
        name: ownerUser.name,
      },
    };
  };

  if (tx) {
    return executeOperation(tx);
  }

  return db.transaction(async (t) => executeOperation(t));
}

/**
 * Retrieves a tenant by ID.
 *
 * @param id - ULID of tenant
 * @param tx - Optional transaction handle
 * @returns Tenant record
 * @throws {NotFoundError} If tenant not found
 */
export async function getTenantById(id: string, tx?: DbOrTx) {
  if (!id) {
    throw new ValidationError('Tenant ID must be specified');
  }

  const executor = tx ?? db;
  const [tenant] = await executor
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError(`Tenant with ID '${id}' not found`);
  }

  return tenant;
}

/**
 * Retrieves a tenant by slug.
 *
 * @param slug - Tenant slug
 * @param tx - Optional transaction handle
 * @returns Tenant record or null
 */
export async function getTenantBySlug(slug: string, tx?: DbOrTx) {
  if (!slug) {
    return null;
  }

  const executor = tx ?? db;
  const normalized = slug.trim().toLowerCase();
  const [tenant] = await executor
    .select()
    .from(tenants)
    .where(eq(tenants.slug, normalized))
    .limit(1);

  return tenant ?? null;
}

/**
 * Lists tenants with pagination, optional status filtering, and search.
 *
 * @param params - Search and pagination options
 * @param tx - Optional transaction handle
 * @returns Paginated list of tenants
 */
export async function listTenants(params: ListTenantsInput = {}, tx?: DbOrTx) {
  const executor = tx ?? db;
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (params.status) {
    conditions.push(eq(tenants.status, params.status));
  }

  if (params.search && params.search.trim().length > 0) {
    const term = `%${params.search.trim()}%`;
    conditions.push(or(ilike(tenants.name, term), ilike(tenants.slug, term)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    executor
      .select()
      .from(tenants)
      .where(whereClause)
      .orderBy(desc(tenants.createdAt))
      .limit(pageSize)
      .offset(offset),
    executor
      .select({ count: sql<number>`count(*)::int` })
      .from(tenants)
      .where(whereClause),
  ]);

  const count = Number(countResult[0]?.count ?? items.length);

  return {
    items,
    total: count,
    page,
    pageSize,
    totalPages: Math.ceil(count / pageSize) || 1,
  };
}

/**
 * Updates a tenant's lifecycle status (active, suspended, archived).
 *
 * @param id - Tenant ID
 * @param status - Target status
 * @param actorId - ID of administrator performing the update
 * @param correlationId - Optional correlation ID
 * @param tx - Optional transaction handle
 * @returns Updated tenant record
 */
export async function updateTenantStatus(
  id: string,
  status: TenantStatus,
  actorId: string,
  correlationId?: string | null,
  tx?: DbOrTx
) {
  if (!['active', 'suspended', 'archived'].includes(status)) {
    throw new ValidationError(`Invalid tenant status: ${status}`);
  }

  const executeOperation = async (t: DbOrTx) => {
    const current = await getTenantById(id, t);

    const [updated] = await t
      .update(tenants)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning();

    await recordAuditLog(
      {
        tenantId: id,
        actorId,
        action: 'tenant:status:update',
        resourceType: 'tenant',
        resourceId: id,
        outcome: 'success',
        metadata: {
          previousStatus: current.status,
          newStatus: status,
        },
        correlationId: correlationId ?? null,
      },
      t
    );

    return updated;
  };

  if (tx) {
    return executeOperation(tx);
  }

  return db.transaction(async (t) => executeOperation(t));
}

/**
 * Updates a tenant's basic metadata such as name and plan.
 *
 * @param id - Tenant ID
 * @param data - Tenant attributes to update
 * @param actorId - ID of user performing the update
 * @param correlationId - Optional correlation ID
 * @param tx - Optional transaction handle
 * @returns Updated tenant record
 */
export async function updateTenant(
  id: string,
  data: UpdateTenantInput,
  actorId: string,
  correlationId?: string | null,
  tx?: DbOrTx
) {
  const updates: Partial<{ name: string; plan: string; updatedAt: Date }> = {};

  if (data.name !== undefined) {
    const name = data.name.trim();
    if (name.length < 2 || name.length > 255) {
      throw new ValidationError('Tenant name must be between 2 and 255 characters');
    }
    updates.name = name;
  }

  if (data.plan !== undefined) {
    const plan = data.plan.trim();
    if (plan.length < 1 || plan.length > 50) {
      throw new ValidationError('Plan identifier must be between 1 and 50 characters');
    }
    updates.plan = plan;
  }

  if (Object.keys(updates).length === 0) {
    return getTenantById(id, tx);
  }

  updates.updatedAt = new Date();

  const executeOperation = async (t: DbOrTx) => {
    await getTenantById(id, t);

    const [updated] = await t
      .update(tenants)
      .set(updates)
      .where(eq(tenants.id, id))
      .returning();

    await recordAuditLog(
      {
        tenantId: id,
        actorId,
        action: 'tenant:update',
        resourceType: 'tenant',
        resourceId: id,
        outcome: 'success',
        metadata: {
          updatedFields: updates,
        },
        correlationId: correlationId ?? null,
      },
      t
    );

    return updated;
  };

  if (tx) {
    return executeOperation(tx);
  }

  return db.transaction(async (t) => executeOperation(t));
}
