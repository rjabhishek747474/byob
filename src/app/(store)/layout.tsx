import React from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { storeSettings, tenants, themes } from '@/lib/db/schema';
import { ConsentBanner } from '@/components/store/consent-banner';

export interface StoreLayoutProps {
  children: React.ReactNode;
}

/**
 * Storefront layout resolving tenant context from headers, loading published theme tokens & store settings.
 */
export default async function StoreLayout({ children }: StoreLayoutProps) {
  const headerList = await headers();
  const tenantSlug = headerList.get('x-tenant-slug') || 'urban-style';

  let themeConfig: Record<string, string> = {
    primary: '#1e3a8a',
    accent: '#d97706',
    background: '#ffffff',
    foreground: '#111827',
  };
  let consentRequired = true;

  try {
    const [tenant] = await db
      .select({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        status: tenants.status,
      })
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);

    if (tenant) {
      if (tenant.status === 'archived' || tenant.status === 'suspended') {
        notFound();
      }

      const [theme] = await db
        .select()
        .from(themes)
        .where(eq(themes.tenantId, tenant.id))
        .limit(1);

      if (theme) {
        themeConfig = (theme.publishedConfig || theme.draftConfig || {}) as Record<string, string>;
      }

      const [settings] = await db
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.tenantId, tenant.id))
        .limit(1);

      if (settings) {
        consentRequired = settings.consentRequired ?? true;
      }
    }
  } catch (err) {
    console.warn('Store layout running with default theme tokens:', err);
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-white text-gray-900 antialiased"
      style={{
        '--store-primary': themeConfig.primary || '#1e3a8a',
        '--store-accent': themeConfig.accent || '#d97706',
        '--store-background': themeConfig.background || '#ffffff',
        '--store-foreground': themeConfig.foreground || '#111827',
      } as React.CSSProperties}
    >
      <main className="flex-1 flex flex-col">{children}</main>

      {/* Privacy and Cookie Consent Banner */}
      {consentRequired && (
        <ConsentBanner />
      )}
    </div>
  );
}
