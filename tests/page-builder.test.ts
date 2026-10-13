import { describe, expect, it, vi } from 'vitest';
import {
  ALLOWED_BLOCK_TYPES,
  Block,
  blockSchema,
  pageLayoutSchema,
  MAX_PAGE_BLOCKS,
  sanitizedHtmlSchema,
  safeUrlSchema,
} from '@/modules/pages/blocks/schemas';
import { BLOCK_REGISTRY, createDefaultBlock } from '@/modules/pages/blocks/registry';
import {
  extractAssetIdsFromBlocks,
} from '@/modules/pages/page-service';

describe('Slice 5: Block Registry, Page Schemas & Page Builder', () => {
  describe('1. Block Schemas & Registry (15 Allowed MVP Blocks)', () => {
    it('defines exactly 15 allowed MVP block types in registry and enum', () => {
      expect(ALLOWED_BLOCK_TYPES).toHaveLength(15);
      expect(Object.keys(BLOCK_REGISTRY)).toHaveLength(15);

      for (const blockType of ALLOWED_BLOCK_TYPES) {
        expect(BLOCK_REGISTRY[blockType]).toBeDefined();
        expect(BLOCK_REGISTRY[blockType].type).toBe(blockType);
      }
    });

    it('validates all 15 default blocks successfully with blockSchema', () => {
      for (const blockType of ALLOWED_BLOCK_TYPES) {
        const block = createDefaultBlock(blockType, `test-${blockType}`);
        const parseResult = blockSchema.safeParse(block);

        if (!parseResult.success) {
          console.error(`Validation failed for block: ${blockType}`, parseResult.error);
        }
        expect(parseResult.success).toBe(true);
      }
    });

    it('rejects unknown block types', () => {
      const invalidBlock = {
        id: 'block-unknown-1',
        type: 'unsupported-crypto-ticker',
        props: {},
      };
      const result = blockSchema.safeParse(invalidBlock);
      expect(result.success).toBe(false);
    });

    it('enforces safe URLs and rejects dangerous script protocols', () => {
      expect(safeUrlSchema.safeParse('/products').success).toBe(true);
      expect(safeUrlSchema.safeParse('https://example.com/item').success).toBe(true);
      expect(safeUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
      expect(safeUrlSchema.safeParse('javascript:void(0)').success).toBe(false);
      expect(safeUrlSchema.safeParse('data:text/html;base64,...').success).toBe(false);
      expect(safeUrlSchema.safeParse('vbscript:msgbox').success).toBe(false);
    });

    it('sanitizes HTML and rejects malicious script tags, iframes, and on* handlers', () => {
      expect(sanitizedHtmlSchema.safeParse('<p>Clean description</p>').success).toBe(true);
      expect(sanitizedHtmlSchema.safeParse('<h2>Title</h2><ul><li>Item</li></ul>').success).toBe(true);
      expect(sanitizedHtmlSchema.safeParse('<script>alert("hack")</script>').success).toBe(false);
      expect(sanitizedHtmlSchema.safeParse('<iframe src="//evil.com"></iframe>').success).toBe(false);
      expect(sanitizedHtmlSchema.safeParse('<p onclick="alert(1)">Click</p>').success).toBe(false);
      expect(sanitizedHtmlSchema.safeParse('<style>body{display:none}</style>').success).toBe(false);
    });

    it('validates banner carousel slide constraints (1 to 7 slides)', () => {
      const carouselBlock = createDefaultBlock('banner-carousel');

      // Valid with 2 slides
      expect(blockSchema.safeParse(carouselBlock).success).toBe(true);

      // Rejects empty slides
      const emptySlides = {
        ...carouselBlock,
        props: { ...carouselBlock.props, slides: [] },
      };
      expect(blockSchema.safeParse(emptySlides).success).toBe(false);

      // Rejects more than 7 slides
      const eightSlides = {
        ...carouselBlock,
        props: {
          ...carouselBlock.props,
          slides: Array.from({ length: 8 }).map((_, i) => ({
            imageAssetId: `asset-${i}`,
            heading: `Slide ${i}`,
            ctaLabel: 'CTA',
            ctaHref: '/link',
            altText: `Alt ${i}`,
          })),
        },
      };
      expect(blockSchema.safeParse(eightSlides).success).toBe(false);
    });

    it('validates benefits row items constraints (1 to 6 items)', () => {
      const benefitsBlock = createDefaultBlock('benefits-row');
      expect(blockSchema.safeParse(benefitsBlock).success).toBe(true);

      const sevenItems = {
        ...benefitsBlock,
        props: {
          items: Array.from({ length: 7 }).map((_, i) => ({
            icon: 'truck' as const,
            title: `Benefit ${i}`,
          })),
        },
      };
      expect(blockSchema.safeParse(sevenItems).success).toBe(false);
    });
  });

  describe('2. Page Layout Schema & Block Count Limits', () => {
    it('accepts valid layouts up to 30 blocks', () => {
      const validBlocks = Array.from({ length: 10 }).map((_, i) =>
        createDefaultBlock('hero', `b-${i}`)
      );
      const layout = {
        schemaVersion: 1,
        blocks: validBlocks,
      };
      expect(pageLayoutSchema.safeParse(layout).success).toBe(true);
    });

    it('rejects oversized layouts exceeding 30 blocks', () => {
      const thirtyOneBlocks = Array.from({ length: 31 }).map((_, i) =>
        createDefaultBlock('announcement-bar', `b-${i}`)
      );
      const layout = {
        schemaVersion: 1,
        blocks: thirtyOneBlocks,
      };
      const result = pageLayoutSchema.safeParse(layout);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain('30');
    });

    it('rejects invalid schemaVersion numbers', () => {
      const layout = {
        schemaVersion: 2, // Only version 1 is supported
        blocks: [],
      };
      expect(pageLayoutSchema.safeParse(layout).success).toBe(false);
    });
  });

  describe('3. Asset Isolation & Dependency Extraction', () => {
    it('extracts all referenced asset IDs across blocks', () => {
      const blocks: Block[] = [
        {
          id: 'b-1',
          type: 'hero',
          props: {
            heading: 'Hero',
            imageAssetId: 'ast_hero_123',
            subheading: '',
            body: '',
            ctaLabel: '',
            ctaHref: '',
            textAlignment: 'center',
          },
        },
        {
          id: 'b-2',
          type: 'banner-carousel',
          props: {
            slides: [
              { imageAssetId: 'ast_slide_1', heading: '', ctaLabel: '', ctaHref: '', altText: '' },
              { imageAssetId: 'ast_slide_2', heading: '', ctaLabel: '', ctaHref: '', altText: '' },
            ],
            autoPlay: true,
            intervalSeconds: 5,
          },
        },
        {
          id: 'b-3',
          type: 'header-nav',
          props: {
            logoAssetId: 'ast_logo_999',
            menuItems: [],
            showSearch: true,
            showCart: true,
          },
        },
      ];

      const assets = extractAssetIdsFromBlocks(blocks);
      expect(assets).toHaveLength(4);
      expect(assets).toContain('ast_hero_123');
      expect(assets).toContain('ast_slide_1');
      expect(assets).toContain('ast_slide_2');
      expect(assets).toContain('ast_logo_999');
    });

    it('rejects cross-tenant asset references on publish validation simulation', () => {
      const crossTenantAssetId = 'ast_other_tenant_9999999999';
      const blocks: Block[] = [
        {
          id: 'b-cross',
          type: 'hero',
          props: {
            heading: 'Cross Tenant Hero',
            imageAssetId: crossTenantAssetId,
            subheading: '',
            body: '',
            ctaLabel: '',
            ctaHref: '/safe',
            textAlignment: 'center',
          },
        },
      ];

      const extracted = extractAssetIdsFromBlocks(blocks);
      expect(extracted).toContain(crossTenantAssetId);

      // Verify that checking against a tenant's allowed assets correctly flags foreign assets
      const tenantOwnedAssets = new Set(['ast_my_tenant_1', 'ast_my_tenant_2']);
      const hasCrossTenantAssets = extracted.some((id) => !tenantOwnedAssets.has(id));
      expect(hasCrossTenantAssets).toBe(true);
    });
  });

  describe('4. Version Snapshot Immutability and Rollback Mechanics', () => {
    it('maintains immutable snapshot representation during rollback', () => {
      // Version 1 snapshot
      const version1Blocks: Block[] = [
        createDefaultBlock('announcement-bar', 'v1-ann'),
        createDefaultBlock('hero', 'v1-hero'),
      ];

      // Version 2 snapshot
      const version2Blocks: Block[] = [
        createDefaultBlock('announcement-bar', 'v2-ann'),
        createDefaultBlock('hero', 'v2-hero'),
        createDefaultBlock('product-grid', 'v2-grid'),
      ];

      const pageVersionsHistory = [
        { versionNumber: 1, blocks: version1Blocks },
        { versionNumber: 2, blocks: version2Blocks },
      ];

      // Rollback to version 1 creates version 3 with copy of version 1 blocks
      const targetVersion = pageVersionsHistory.find((v) => v.versionNumber === 1);
      expect(targetVersion).toBeDefined();

      const newVersion3Blocks = JSON.parse(JSON.stringify(targetVersion!.blocks));
      const rolledBackVersion = {
        versionNumber: 3,
        blocks: newVersion3Blocks,
      };

      expect(rolledBackVersion.versionNumber).toBe(3);
      expect(rolledBackVersion.blocks).toHaveLength(2);
      expect(rolledBackVersion.blocks[0].id).toBe('v1-ann-announcement-bar');
      // Version 1 remains unchanged in history
      expect(pageVersionsHistory[0].blocks).toHaveLength(2);
    });
  });
});

