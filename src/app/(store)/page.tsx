import React from 'react';
import { headers } from 'next/headers';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { pages, pageVersions, tenants, themes } from '@/lib/db/schema';
import { PageRenderer } from '@/components/store/page-renderer';
import { Block, BlockType } from '@/modules/pages/blocks/schemas';
import { createDefaultBlock } from '@/modules/pages/blocks/registry';

const DEFAULT_STARTER_BLOCK_TYPES: BlockType[] = [
  'announcement-bar',
  'header-nav',
  'hero',
  'benefits-row',
  'category-grid',
  'product-grid',
  'promotional-strip',
  'testimonials',
  'footer',
];

/**
 * Storefront Home Page
 * Fetches the published version blocks for the active tenant,
 * falling back gracefully to starter showcase blocks.
 */
export default async function StoreHomePage() {
  const headerList = await headers();
  const tenantSlug = headerList.get('x-tenant-slug') || 'urban-style';

  let blocks: Block[] = [];
  let themeConfig: Record<string, string> = {
    '--color-primary': '#2563eb',
    '--color-background': '#ffffff',
    '--color-foreground': '#0a0a0a',
  };

  try {
    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);

    if (tenant) {
      const [page] = await db
        .select()
        .from(pages)
        .where(and(eq(pages.tenantId, tenant.id), eq(pages.slug, 'home')))
        .limit(1);

      if (page) {
        const [publishedVersion] = await db
          .select()
          .from(pageVersions)
          .where(and(eq(pageVersions.tenantId, tenant.id), eq(pageVersions.pageId, page.id)))
          .orderBy(desc(pageVersions.versionNumber))
          .limit(1);

        if (publishedVersion && Array.isArray(publishedVersion.blocks) && publishedVersion.blocks.length > 0) {
          blocks = publishedVersion.blocks as Block[];
        }
      }

      const [theme] = await db
        .select()
        .from(themes)
        .where(eq(themes.tenantId, tenant.id))
        .limit(1);

      if (theme) {
        themeConfig = (theme.publishedConfig || theme.draftConfig || {}) as Record<string, string>;
      }
    }
  } catch (err) {
    console.warn('Storefront running in offline/demo mode:', err);
  }

  // If no published blocks in database, provide standard showcase blocks
  if (blocks.length === 0) {
    blocks = DEFAULT_STARTER_BLOCK_TYPES.map((type, idx) =>
      createDefaultBlock(type, `storefront-init-${idx}`)
    );
  }

  return <PageRenderer blocks={blocks} themeConfig={themeConfig} />;
}
