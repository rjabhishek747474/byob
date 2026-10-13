import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { assets, pages, pageVersions } from '@/lib/db/schema';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import { generateId, slugify } from '@/lib/utils';
import { recordAuditLog } from '@/modules/audit/audit-service';
import {
  Block,
  blockSchema,
  pageLayoutSchema,
  MAX_PAGE_BLOCKS,
  SYSTEM_PAGE_SLUGS,
  systemPageStyleSettingsSchema,
} from './blocks/schemas';

export interface CreatePageInput {
  title: string;
  slug?: string;
  pageType?: 'home' | 'collection' | 'product' | 'about' | 'contact' | 'policy' | 'custom' | 'landing';
  seoTitle?: string;
  seoDescription?: string;
  initialBlocks?: Block[];
}

export interface UpdatePageInput {
  title?: string;
  slug?: string;
  seoTitle?: string;
  seoDescription?: string;
}

/**
 * Extracts all asset IDs referenced across any block's props.
 */
export function extractAssetIdsFromBlocks(blocks: Block[]): string[] {
  const assetIds: string[] = [];

  for (const block of blocks) {
    const props = block.props as Record<string, unknown>;

    // header-nav, hero, image-with-text, testimonials
    if (typeof props.logoAssetId === 'string' && props.logoAssetId.trim()) {
      assetIds.push(props.logoAssetId.trim());
    }
    if (typeof props.imageAssetId === 'string' && props.imageAssetId.trim()) {
      assetIds.push(props.imageAssetId.trim());
    }
    if (typeof props.avatarAssetId === 'string' && props.avatarAssetId.trim()) {
      assetIds.push(props.avatarAssetId.trim());
    }

    // banner-carousel slides
    if (Array.isArray(props.slides)) {
      for (const slide of props.slides) {
        if (typeof slide?.imageAssetId === 'string' && slide.imageAssetId.trim()) {
          assetIds.push(slide.imageAssetId.trim());
        }
      }
    }
  }

  return Array.from(new Set(assetIds));
}

/**
 * Creates a new page within a tenant. Enforces slug uniqueness within the tenant.
 */
export async function createPage(
  tenantId: string,
  data: CreatePageInput,
  actorId: string
) {
  if (!tenantId) {
    throw new BadRequestError('Tenant ID is required');
  }
  if (!data.title || data.title.trim().length === 0) {
    throw new ValidationError('Page title is required', [
      { field: 'title', message: 'Page title is required' },
    ]);
  }

  const rawSlug = data.slug && data.slug.trim().length > 0 ? data.slug : data.title;
  const slug = slugify(rawSlug);

  if (!slug) {
    throw new ValidationError('Invalid page slug generated', [
      { field: 'slug', message: 'Slug cannot be empty' },
    ]);
  }

  // Slug uniqueness within tenant
  const [existing] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.tenantId, tenantId), eq(pages.slug, slug)))
    .limit(1);

  if (existing) {
    throw new ConflictError(`Page with slug "${slug}" already exists for this tenant`);
  }

  const pageId = generateId();
  const now = new Date();

  // Validate initial blocks if provided
  let initialBlocks: Block[] = [];
  if (data.initialBlocks && data.initialBlocks.length > 0) {
    const parsed = pageLayoutSchema.safeParse({
      schemaVersion: 1,
      blocks: data.initialBlocks,
    });
    if (!parsed.success) {
      throw new ValidationError('Invalid initial page blocks', [
        { field: 'initialBlocks', message: parsed.error.message },
      ]);
    }
    initialBlocks = parsed.data.blocks;
  }

  const [newPage] = await db
    .insert(pages)
    .values({
      id: pageId,
      tenantId,
      slug,
      pageType: data.pageType || 'custom',
      title: data.title.trim(),
      status: 'draft',
      seoTitle: data.seoTitle || null,
      seoDescription: data.seoDescription || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Create initial draft version 1
  const versionId = generateId();
  await db.insert(pageVersions).values({
    id: versionId,
    tenantId,
    pageId,
    versionNumber: 1,
    schemaVersion: 1,
    blocks: initialBlocks,
    publishedAt: null,
    publishedBy: null,
    createdAt: now,
  });

  await recordAuditLog({
    tenantId,
    actorId,
    action: 'page.created',
    resourceType: 'page',
    resourceId: pageId,
    metadata: { title: newPage.title, slug: newPage.slug },
  });

  return newPage;
}

/**
 * Retrieves a page by ID scoped to tenant.
 */
export async function getPageById(tenantId: string, id: string) {
  if (!tenantId || !id) {
    throw new BadRequestError('Tenant ID and Page ID are required');
  }

  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.tenantId, tenantId), eq(pages.id, id)))
    .limit(1);

  if (!page) {
    throw new NotFoundError(`Page not found: ${id}`);
  }

  // Fetch the latest version (draft or published)
  const [latestVersion] = await db
    .select()
    .from(pageVersions)
    .where(and(eq(pageVersions.tenantId, tenantId), eq(pageVersions.pageId, id)))
    .orderBy(desc(pageVersions.versionNumber))
    .limit(1);

  return {
    ...page,
    latestVersionNumber: latestVersion?.versionNumber ?? 0,
    blocks: (latestVersion?.blocks as Block[]) ?? [],
    publishedAt: latestVersion?.publishedAt ?? null,
  };
}

/**
 * Retrieves a page by slug scoped to tenant.
 */
export async function getPageBySlug(tenantId: string, slug: string) {
  if (!tenantId || !slug) {
    throw new BadRequestError('Tenant ID and Slug are required');
  }

  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.tenantId, tenantId), eq(pages.slug, slug)))
    .limit(1);

  if (!page) {
    throw new NotFoundError(`Page with slug "${slug}" not found`);
  }

  const [latestVersion] = await db
    .select()
    .from(pageVersions)
    .where(and(eq(pageVersions.tenantId, tenantId), eq(pageVersions.pageId, page.id)))
    .orderBy(desc(pageVersions.versionNumber))
    .limit(1);

  return {
    ...page,
    latestVersionNumber: latestVersion?.versionNumber ?? 0,
    blocks: (latestVersion?.blocks as Block[]) ?? [],
    publishedAt: latestVersion?.publishedAt ?? null,
  };
}

/**
 * Updates page metadata (title, slug, SEO) scoped to tenant.
 */
export async function updatePage(
  tenantId: string,
  pageId: string,
  data: UpdatePageInput,
  actorId: string
) {
  if (!tenantId || !pageId) {
    throw new BadRequestError('Tenant ID and Page ID are required');
  }

  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.tenantId, tenantId), eq(pages.id, pageId)))
    .limit(1);

  if (!page) {
    throw new NotFoundError(`Page not found: ${pageId}`);
  }

  let newSlug = page.slug;
  if (data.slug && data.slug !== page.slug) {
    newSlug = slugify(data.slug);
    const [existing] = await db
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.tenantId, tenantId), eq(pages.slug, newSlug)))
      .limit(1);

    if (existing && existing.id !== pageId) {
      throw new ConflictError(`Slug "${newSlug}" is already taken`);
    }
  }

  const [updated] = await db
    .update(pages)
    .set({
      title: data.title ? data.title.trim() : page.title,
      slug: newSlug,
      seoTitle: data.seoTitle !== undefined ? data.seoTitle : page.seoTitle,
      seoDescription: data.seoDescription !== undefined ? data.seoDescription : page.seoDescription,
      updatedAt: new Date(),
    })
    .where(and(eq(pages.tenantId, tenantId), eq(pages.id, pageId)))
    .returning();

  await recordAuditLog({
    tenantId,
    actorId,
    action: 'page.updated',
    resourceType: 'page',
    resourceId: pageId,
    metadata: { title: updated.title, slug: updated.slug },
  });

  return updated;
}

/**
 * Deletes a page and all its versions scoped to tenant.
 */
export async function deletePage(tenantId: string, pageId: string, actorId: string) {
  if (!tenantId || !pageId) {
    throw new BadRequestError('Tenant ID and Page ID are required');
  }

  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.tenantId, tenantId), eq(pages.id, pageId)))
    .limit(1);

  if (!page) {
    throw new NotFoundError(`Page not found: ${pageId}`);
  }

  if (page.pageType === 'home') {
    throw new BadRequestError('Cannot delete the storefront home page');
  }

  // Delete versions first
  await db
    .delete(pageVersions)
    .where(and(eq(pageVersions.tenantId, tenantId), eq(pageVersions.pageId, pageId)));

  await db
    .delete(pages)
    .where(and(eq(pages.tenantId, tenantId), eq(pages.id, pageId)));

  await recordAuditLog({
    tenantId,
    actorId,
    action: 'page.deleted',
    resourceType: 'page',
    resourceId: pageId,
    metadata: { title: page.title, slug: page.slug },
  });

  return { success: true };
}

/**
 * Updates draft blocks for a page.
 * Validates each block against Zod schema and enforces block limits.
 */
export async function updateDraftBlocks(
  tenantId: string,
  pageId: string,
  rawBlocks: unknown[],
  actorId: string
) {
  if (!tenantId || !pageId) {
    throw new BadRequestError('Tenant ID and Page ID are required');
  }

  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.tenantId, tenantId), eq(pages.id, pageId)))
    .limit(1);

  if (!page) {
    throw new NotFoundError(`Page not found: ${pageId}`);
  }

  // System pages constraint: Cart, Checkout, Order Tracking have controlled immutable templates
  if ((SYSTEM_PAGE_SLUGS as readonly string[]).includes(page.slug)) {
    throw new BadRequestError(
      `Arbitrary block replacement is prohibited for system template "${page.slug}". Only styling controls may be updated.`
    );
  }

  // Validate block array schema
  const parseResult = pageLayoutSchema.safeParse({
    schemaVersion: 1,
    blocks: rawBlocks,
  });

  if (!parseResult.success) {
    const errorMessages = parseResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    throw new ValidationError(`Block layout validation failed: ${errorMessages.join('; ')}`, [
      { field: 'blocks', message: errorMessages.join('; ') },
    ]);
  }

  const validatedBlocks = parseResult.data.blocks;

  // Retrieve current latest version
  const [latestVersion] = await db
    .select()
    .from(pageVersions)
    .where(and(eq(pageVersions.tenantId, tenantId), eq(pageVersions.pageId, pageId)))
    .orderBy(desc(pageVersions.versionNumber))
    .limit(1);

  const now = new Date();

  if (latestVersion && latestVersion.publishedAt === null) {
    // Current latest is an unpublished draft; update it in place
    await db
      .update(pageVersions)
      .set({
        blocks: validatedBlocks,
        createdAt: now,
      })
      .where(and(eq(pageVersions.tenantId, tenantId), eq(pageVersions.id, latestVersion.id)));
  } else {
    // Current latest is published; create new draft version incrementing versionNumber
    const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;
    await db.insert(pageVersions).values({
      id: generateId(),
      tenantId,
      pageId,
      versionNumber: nextVersionNumber,
      schemaVersion: 1,
      blocks: validatedBlocks,
      publishedAt: null,
      publishedBy: null,
      createdAt: now,
    });
  }

  await db
    .update(pages)
    .set({ updatedAt: now })
    .where(and(eq(pages.tenantId, tenantId), eq(pages.id, pageId)));

  await recordAuditLog({
    tenantId,
    actorId,
    action: 'page.draft_updated',
    resourceType: 'page',
    resourceId: pageId,
    metadata: { blockCount: validatedBlocks.length },
  });

  return { success: true, blockCount: validatedBlocks.length };
}

/**
 * Strict publish validation and page publication.
 * 1. Validates all blocks against Zod schemas.
 * 2. Checks required fields (headings, valid assets, CTA links not empty or javascript:).
 * 3. Enforces max block count limit (<= 30).
 * 4. Verifies all referenced asset IDs belong to the tenant.
 * 5. Increments version number, creates immutable pageVersions snapshot with publishedAt/publishedBy.
 * 6. Sets pages status to 'published'.
 * 7. Records audit log.
 */
export async function publishPage(tenantId: string, pageId: string, actorId: string) {
  if (!tenantId || !pageId) {
    throw new BadRequestError('Tenant ID and Page ID are required');
  }

  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.tenantId, tenantId), eq(pages.id, pageId)))
    .limit(1);

  if (!page) {
    throw new NotFoundError(`Page not found: ${pageId}`);
  }

  // Get current draft blocks from latest version
  const [latestVersion] = await db
    .select()
    .from(pageVersions)
    .where(and(eq(pageVersions.tenantId, tenantId), eq(pageVersions.pageId, pageId)))
    .orderBy(desc(pageVersions.versionNumber))
    .limit(1);

  if (!latestVersion) {
    throw new BadRequestError('No content available to publish');
  }

  const blocks = latestVersion.blocks as Block[];

  // 1. Max block count validation
  if (!Array.isArray(blocks) || blocks.length > MAX_PAGE_BLOCKS) {
    throw new ValidationError(
      `Page contains ${blocks?.length ?? 0} blocks, exceeding limit of ${MAX_PAGE_BLOCKS}`,
      [{ field: 'blocks', message: `Block limit of ${MAX_PAGE_BLOCKS} exceeded` }]
    );
  }

  // 2. Strict Zod parse of layout
  const layoutParse = pageLayoutSchema.safeParse({
    schemaVersion: 1,
    blocks,
  });

  if (!layoutParse.success) {
    const errorMessages = layoutParse.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    throw new ValidationError(`Publish validation failed: ${errorMessages.join('; ')}`, [
      { field: 'blocks', message: errorMessages.join('; ') },
    ]);
  }

  // 3. Strict CTA link safety check on all blocks
  for (const block of blocks) {
    const props = block.props as Record<string, unknown>;
    const ctaFields = ['ctaHref', 'linkUrl'];
    for (const field of ctaFields) {
      if (typeof props[field] === 'string') {
        const url = (props[field] as string).toLowerCase().trim();
        if (url.startsWith('javascript:') || url.startsWith('data:text/html') || url.startsWith('vbscript:')) {
          throw new ValidationError(`Dangerous CTA URL detected in block "${block.id}"`, [
            { field: `blocks.${block.id}.${field}`, message: 'Dangerous script protocol in URL' },
          ]);
        }
      }
    }
  }

  // 4. Asset isolation: verify that all referenced asset IDs belong to the tenant
  const referencedAssetIds = extractAssetIdsFromBlocks(blocks);
  // Filter out placeholder/mock IDs used in templates (e.g. starting with seed- or mock-)
  const tenantScopedAssetIds = referencedAssetIds.filter(
    (id) => !id.startsWith('seed-') && !id.startsWith('mock-') && id.length > 5
  );

  if (tenantScopedAssetIds.length > 0) {
    const foundAssets = await db
      .select({ id: assets.id, tenantId: assets.tenantId })
      .from(assets)
      .where(
        and(
          eq(assets.tenantId, tenantId),
          inArray(assets.id, tenantScopedAssetIds)
        )
      );

    const foundAssetIds = new Set(foundAssets.map((a) => a.id));
    const missingOrCrossTenant = tenantScopedAssetIds.filter((id) => !foundAssetIds.has(id));

    if (missingOrCrossTenant.length > 0) {
      throw new ValidationError(
        `Referenced assets [${missingOrCrossTenant.join(', ')}] either do not exist or belong to another tenant. Cross-tenant asset references are prohibited.`,
        [
          {
            field: 'assets',
            message: `Cross-tenant or missing assets: ${missingOrCrossTenant.join(', ')}`,
          },
        ]
      );
    }
  }

  const now = new Date();
  let publishedVersionNumber = latestVersion.versionNumber;

  if (latestVersion.publishedAt !== null) {
    // If the latest version was already published, increment version number and create new snapshot
    publishedVersionNumber += 1;
    await db.insert(pageVersions).values({
      id: generateId(),
      tenantId,
      pageId,
      versionNumber: publishedVersionNumber,
      schemaVersion: 1,
      blocks: layoutParse.data.blocks,
      publishedAt: now,
      publishedBy: actorId,
      createdAt: now,
    });
  } else {
    // Mark the current draft version as published
    await db
      .update(pageVersions)
      .set({
        publishedAt: now,
        publishedBy: actorId,
      })
      .where(and(eq(pageVersions.tenantId, tenantId), eq(pageVersions.id, latestVersion.id)));
  }

  // Update page status to published
  await db
    .update(pages)
    .set({
      status: 'published',
      updatedAt: now,
    })
    .where(and(eq(pages.tenantId, tenantId), eq(pages.id, pageId)));

  await recordAuditLog({
    tenantId,
    actorId,
    action: 'page.published',
    resourceType: 'page',
    resourceId: pageId,
    metadata: {
      versionNumber: publishedVersionNumber,
      blockCount: blocks.length,
    },
  });

  return {
    success: true,
    versionNumber: publishedVersionNumber,
    publishedAt: now,
  };
}

/**
 * Rolls back a page to an earlier version snapshot.
 * Creates a new draft/version from the target version's blocks.
 */
export async function rollbackPage(
  tenantId: string,
  pageId: string,
  targetVersion: number,
  actorId: string
) {
  if (!tenantId || !pageId) {
    throw new BadRequestError('Tenant ID and Page ID are required');
  }
  if (typeof targetVersion !== 'number' || targetVersion <= 0) {
    throw new BadRequestError('Valid targetVersion number is required');
  }

  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.tenantId, tenantId), eq(pages.id, pageId)))
    .limit(1);

  if (!page) {
    throw new NotFoundError(`Page not found: ${pageId}`);
  }

  // Find target version snapshot
  const [target] = await db
    .select()
    .from(pageVersions)
    .where(
      and(
        eq(pageVersions.tenantId, tenantId),
        eq(pageVersions.pageId, pageId),
        eq(pageVersions.versionNumber, targetVersion)
      )
    )
    .limit(1);

  if (!target) {
    throw new NotFoundError(`Target version ${targetVersion} not found for page ${pageId}`);
  }

  // Find highest version number to increment
  const [latestVersion] = await db
    .select({ versionNumber: pageVersions.versionNumber })
    .from(pageVersions)
    .where(and(eq(pageVersions.tenantId, tenantId), eq(pageVersions.pageId, pageId)))
    .orderBy(desc(pageVersions.versionNumber))
    .limit(1);

  const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;
  const now = new Date();

  // Create new draft with restored blocks
  const [restored] = await db
    .insert(pageVersions)
    .values({
      id: generateId(),
      tenantId,
      pageId,
      versionNumber: nextVersionNumber,
      schemaVersion: target.schemaVersion,
      blocks: target.blocks,
      publishedAt: null,
      publishedBy: null,
      createdAt: now,
    })
    .returning();

  await db
    .update(pages)
    .set({ updatedAt: now })
    .where(and(eq(pages.tenantId, tenantId), eq(pages.id, pageId)));

  await recordAuditLog({
    tenantId,
    actorId,
    action: 'page.rollback',
    resourceType: 'page',
    resourceId: pageId,
    metadata: {
      fromVersion: latestVersion?.versionNumber,
      restoredFromVersion: targetVersion,
      newDraftVersion: nextVersionNumber,
    },
  });

  return {
    success: true,
    newVersionNumber: nextVersionNumber,
    restoredFromVersion: targetVersion,
    blocks: restored.blocks as Block[],
  };
}

/**
 * Lists all version snapshots for a page scoped to tenant.
 */
export async function listPageVersions(tenantId: string, pageId: string) {
  if (!tenantId || !pageId) {
    throw new BadRequestError('Tenant ID and Page ID are required');
  }

  // Verify page belongs to tenant
  const [page] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.tenantId, tenantId), eq(pages.id, pageId)))
    .limit(1);

  if (!page) {
    throw new NotFoundError(`Page not found: ${pageId}`);
  }

  const versions = await db
    .select({
      id: pageVersions.id,
      versionNumber: pageVersions.versionNumber,
      schemaVersion: pageVersions.schemaVersion,
      publishedAt: pageVersions.publishedAt,
      publishedBy: pageVersions.publishedBy,
      createdAt: pageVersions.createdAt,
      blockCount: pageVersions.blocks,
    })
    .from(pageVersions)
    .where(and(eq(pageVersions.tenantId, tenantId), eq(pageVersions.pageId, pageId)))
    .orderBy(desc(pageVersions.versionNumber));

  return versions.map((v) => ({
    id: v.id,
    versionNumber: v.versionNumber,
    schemaVersion: v.schemaVersion,
    publishedAt: v.publishedAt,
    publishedBy: v.publishedBy,
    createdAt: v.createdAt,
    blockCount: Array.isArray(v.blockCount) ? v.blockCount.length : 0,
  }));
}

/**
 * Lists all pages for a tenant.
 */
export async function listPages(tenantId: string) {
  if (!tenantId) {
    throw new BadRequestError('Tenant ID is required');
  }

  const result = await db
    .select()
    .from(pages)
    .where(eq(pages.tenantId, tenantId))
    .orderBy(desc(pages.createdAt));

  return result;
}
