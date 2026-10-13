import React from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { pages, pageVersions, tenants, themes } from '@/lib/db/schema';
import { PageRenderer } from '@/components/store/page-renderer';
import { Block } from '@/modules/pages/blocks/schemas';

interface StoreCustomPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Storefront Custom Page Route (e.g. /about, /terms, /policy)
 * Fetches published version blocks for the custom page.
 */
export default async function StoreCustomPage({ params }: StoreCustomPageProps) {
  const { slug } = await params;
  const headerList = await headers();
  const tenantSlug = headerList.get('x-tenant-slug') || 'urban-style';

  try {
    // 1. Resolve tenant
    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);

    if (!tenant) {
      notFound();
    }

    // 2. Fetch page by slug
    const [page] = await db
      .select()
      .from(pages)
      .where(
        and(
          eq(pages.tenantId, tenant.id),
          eq(pages.slug, slug)
        )
      )
      .limit(1);

    if (!page) {
      notFound();
    }

    // 3. Fetch latest published version
    const [publishedVersion] = await db
      .select()
      .from(pageVersions)
      .where(
        and(
          eq(pageVersions.tenantId, tenant.id),
          eq(pageVersions.pageId, page.id)
        )
      )
      .orderBy(desc(pageVersions.versionNumber))
      .limit(1);

    const blocks: Block[] = (publishedVersion?.blocks as Block[]) || [];

    // 4. Fetch theme styling tokens
    const [theme] = await db
      .select()
      .from(themes)
      .where(eq(themes.tenantId, tenant.id))
      .limit(1);

    const themeConfig = (theme?.publishedConfig || theme?.draftConfig || {}) as Record<string, string>;

    return <PageRenderer blocks={blocks} themeConfig={themeConfig} />;
  } catch (error) {
    // If notFound() was called, rethrow so Next.js renders the 404 boundary
    if ((error as { digest?: string })?.digest?.startsWith('NEXT_NOT_FOUND')) {
      throw error;
    }

    // For known informative pages without a live DB connection, render standard template
    if (['about', 'contact', 'terms', 'privacy', 'faq'].includes(slug)) {
      return (
        <div className="min-h-screen bg-white">
          <header className="border-b border-gray-100 py-4 px-6 text-center">
            <h1 className="text-xl font-bold capitalize text-gray-900">{slug.replace('-', ' ')}</h1>
          </header>
          <main className="max-w-3xl mx-auto px-6 py-12 text-gray-700 leading-relaxed space-y-4">
            <p>Welcome to our {slug} page. Content is currently being updated by the store administrator.</p>
          </main>
        </div>
      );
    }

    // If page is not found or DB is offline for an unrecognized slug, trigger 404
    notFound();
  }
}
