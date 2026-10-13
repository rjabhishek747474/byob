import React from 'react';
import { Block } from '@/modules/pages/blocks/schemas';
import { RenderBlock } from './blocks';

export interface PageRendererProps {
  blocks: Block[];
  themeConfig?: {
    primary?: string;
    accent?: string;
    background?: string;
    foreground?: string;
    surface?: string;
    fontFamily?: string;
  };
}

/**
 * Server Component rendering an array of page builder blocks with tenant theme tokens applied.
 */
export function PageRenderer({ blocks, themeConfig }: PageRendererProps) {
  // Apply tenant theme tokens as inline CSS variables
  const styleVariables: Record<string, string> = {
    '--theme-primary': themeConfig?.primary || '#2563eb',
    '--theme-accent': themeConfig?.accent || '#f59e0b',
    '--theme-background': themeConfig?.background || '#ffffff',
    '--theme-foreground': themeConfig?.foreground || '#111827',
    '--theme-surface': themeConfig?.surface || '#f9fafb',
    fontFamily: themeConfig?.fontFamily || 'inherit',
  };

  if (!blocks || blocks.length === 0) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center text-gray-500">
        <h2 className="text-xl font-semibold text-gray-800">Storefront Under Construction</h2>
        <p className="text-sm mt-2 max-w-md text-gray-500">
          No published content is currently available for this page. Please check back shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex flex-col" style={styleVariables as React.CSSProperties}>
      {blocks.map((block) => (
        <React.Fragment key={block.id}>
          <RenderBlock block={block} />
        </React.Fragment>
      ))}
    </div>
  );
}
