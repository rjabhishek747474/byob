import { z } from 'zod/v4';

/**
 * URL validator that forbids dangerous JavaScript and data URI execution vectors.
 */
export const safeUrlSchema = z
  .string()
  .trim()
  .refine(
    (url) => {
      if (!url) return true;
      const lower = url.toLowerCase().trim();
      return (
        !lower.startsWith('javascript:') &&
        !lower.startsWith('data:text/html') &&
        !lower.startsWith('vbscript:')
      );
    },
    { message: 'URL contains unsafe protocol or script execution vector' }
  );

/**
 * Mandatory CTA link URL that must not be empty and must be safe.
 */
export const mandatorySafeUrlSchema = safeUrlSchema.refine(
  (url) => url.length > 0,
  { message: 'CTA URL cannot be empty' }
);

/**
 * HTML content validator with strict allowlist.
 * Allowed tags: p, h1, h2, h3, h4, ul, ol, li, strong, em, a.
 * Strictly forbids: <script, <iframe, <style, <object, <embed, onclick, onload, javascript:.
 */
export const sanitizedHtmlSchema = z
  .string()
  .refine(
    (html) => {
      if (!html) return true;
      const lower = html.toLowerCase();
      // Disallowed malicious tags and protocols
      const dangerousPatterns = [
        /<script\b/i,
        /<\/script>/i,
        /<iframe\b/i,
        /<style\b/i,
        /<\/style>/i,
        /<object\b/i,
        /<embed\b/i,
        /<applet\b/i,
        /\son[a-z]+\s*=/i,
        /javascript:/i,
        /data:text\/html/i,
      ];
      return !dangerousPatterns.some((pattern) => pattern.test(lower));
    },
    { message: 'HTML contains forbidden elements, script execution, or inline event handlers' }
  );

// 1. Announcement Bar
export const announcementBarPropsSchema = z.object({
  text: z.string().min(1, 'Announcement text is required').max(300),
  linkUrl: safeUrlSchema.optional().default(''),
  linkText: z.string().max(100).optional().default(''),
  backgroundColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/, 'Must be a valid hex color').default('#1e3a8a'),
  textColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/, 'Must be a valid hex color').default('#ffffff'),
});

// 2. Header Nav
export const menuItemSchema: z.ZodType<{
  label: string;
  href: string;
  children?: { label: string; href: string }[];
}> = z.lazy(() =>
  z.object({
    label: z.string().min(1, 'Menu label is required').max(100),
    href: safeUrlSchema.default('/'),
    children: z
      .array(
        z.object({
          label: z.string().min(1, 'Submenu label is required').max(100),
          href: safeUrlSchema.default('/'),
        })
      )
      .optional(),
  })
);

export const headerNavPropsSchema = z.object({
  logoAssetId: z.string().optional().default(''),
  menuItems: z.array(menuItemSchema).default([]),
  showSearch: z.boolean().default(true),
  showCart: z.boolean().default(true),
});

// 3. Hero
export const heroPropsSchema = z.object({
  heading: z.string().min(1, 'Heading is required').max(200),
  subheading: z.string().max(300).optional().default(''),
  body: z.string().max(1000).optional().default(''),
  imageAssetId: z.string().optional().default(''),
  ctaLabel: z.string().max(100).optional().default(''),
  ctaHref: safeUrlSchema.optional().default(''),
  textAlignment: z.enum(['left', 'center', 'right']).default('center'),
});

// 4. Banner Carousel
export const bannerSlideSchema = z.object({
  imageAssetId: z.string().min(1, 'Slide image asset ID is required'),
  heading: z.string().max(200).optional().default(''),
  ctaLabel: z.string().max(100).optional().default(''),
  ctaHref: safeUrlSchema.optional().default(''),
  altText: z.string().max(300).optional().default('Banner slide'),
});

export const bannerCarouselPropsSchema = z.object({
  slides: z
    .array(bannerSlideSchema)
    .min(1, 'Carousel must have at least 1 slide')
    .max(7, 'Carousel cannot exceed 7 slides'),
  autoPlay: z.boolean().default(true),
  intervalSeconds: z.number().int().min(2).max(20).default(5),
});

// 5. Category Grid
export const categoryGridPropsSchema = z.object({
  title: z.string().max(200).optional().default('Categories'),
  categoryIds: z.array(z.string()).default([]),
  autoFetch: z.boolean().default(false),
  columns: z.enum(['2', '3', '4']).or(z.literal(2).or(z.literal(3)).or(z.literal(4))).transform(String).default('3'),
  showImages: z.boolean().default(true),
});

// 6. Product Grid
export const productGridPropsSchema = z.object({
  title: z.string().max(200).optional().default('Featured Products'),
  source: z.enum(['manual', 'category', 'featured', 'all']).default('all'),
  categoryId: z.string().optional().default(''),
  productIds: z.array(z.string()).default([]),
  limit: z.number().int().min(1).max(24).default(8),
  columns: z.enum(['2', '3', '4']).or(z.literal(2).or(z.literal(3)).or(z.literal(4))).transform(String).default('4'),
});

// 7. Featured Product
export const featuredProductPropsSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  customHeading: z.string().max(200).optional().default(''),
  showVariants: z.boolean().default(true),
  showBuyNow: z.boolean().default(true),
});

// 8. Promotional Strip
export const promotionalStripPropsSchema = z.object({
  bannerText: z.string().min(1, 'Banner text is required').max(300),
  highlightWord: z.string().max(100).optional().default(''),
  discountCode: z.string().max(50).optional().default(''),
  expiryText: z.string().max(100).optional().default(''),
  ctaLabel: z.string().max(100).optional().default(''),
  ctaHref: safeUrlSchema.optional().default(''),
});

// 9. Image With Text
export const imageWithTextPropsSchema = z.object({
  imageAssetId: z.string().min(1, 'Image asset ID is required'),
  imagePosition: z.enum(['left', 'right']).default('left'),
  heading: z.string().min(1, 'Heading is required').max(200),
  body: z.string().max(2000).optional().default(''),
  ctaLabel: z.string().max(100).optional().default(''),
  ctaHref: safeUrlSchema.optional().default(''),
});

// 10. Rich Text
export const richTextPropsSchema = z.object({
  sanitizedContent: sanitizedHtmlSchema,
  alignment: z.enum(['left', 'center', 'right']).default('left'),
});

// 11. Benefits Row
export const benefitItemSchema = z.object({
  icon: z.enum(['truck', 'shield', 'refresh', 'heart', 'star', 'clock']),
  title: z.string().min(1, 'Title is required').max(100),
  description: z.string().max(250).optional().default(''),
});

export const benefitsRowPropsSchema = z.object({
  items: z
    .array(benefitItemSchema)
    .min(1, 'Benefits row must contain at least 1 item')
    .max(6, 'Benefits row cannot exceed 6 items'),
});

// 12. Newsletter Capture
export const newsletterCapturePropsSchema = z.object({
  heading: z.string().min(1, 'Heading is required').max(200),
  description: z.string().max(500).optional().default(''),
  buttonLabel: z.string().min(1, 'Button label is required').max(100).default('Subscribe'),
  disclaimerText: z.string().max(300).optional().default(''),
  privacyConsentRequired: z.boolean().default(true),
});

// 13. FAQ Accordion
export const faqItemSchema = z.object({
  question: z.string().min(1, 'Question is required').max(300),
  answer: sanitizedHtmlSchema,
});

export const faqAccordionPropsSchema = z.object({
  items: z
    .array(faqItemSchema)
    .min(1, 'FAQ must have at least 1 item')
    .max(30, 'FAQ cannot exceed 30 items'),
});

// 14. Testimonials
export const testimonialItemSchema = z.object({
  quote: z.string().min(1, 'Quote is required').max(600),
  authorName: z.string().min(1, 'Author name is required').max(100),
  authorTitle: z.string().max(100).optional().default(''),
  avatarAssetId: z.string().optional().default(''),
  rating: z.number().int().min(1).max(5).default(5),
});

export const testimonialsPropsSchema = z.object({
  items: z
    .array(testimonialItemSchema)
    .min(1, 'Testimonials must have at least 1 item')
    .max(12, 'Testimonials cannot exceed 12 items'),
});

// 15. Footer
export const footerColumnSchema = z.object({
  title: z.string().min(1, 'Column title is required').max(100),
  links: z
    .array(
      z.object({
        label: z.string().min(1, 'Link label is required').max(100),
        href: safeUrlSchema.default('/'),
      })
    )
    .default([]),
});

export const footerPropsSchema = z.object({
  copyrightText: z.string().max(200).default('© All rights reserved.'),
  columns: z.array(footerColumnSchema).default([]),
  socialLinks: z
    .object({
      facebook: safeUrlSchema.default(''),
      instagram: safeUrlSchema.default(''),
      twitter: safeUrlSchema.default(''),
      whatsapp: safeUrlSchema.default(''),
    })
    .default(() => ({
      facebook: '',
      instagram: '',
      twitter: '',
      whatsapp: '',
    })),
  legalLinks: z
    .object({
      privacyHref: safeUrlSchema.default('/privacy'),
      termsHref: safeUrlSchema.default('/terms'),
      returnHref: safeUrlSchema.default('/returns'),
    })
    .default(() => ({
      privacyHref: '/privacy',
      termsHref: '/terms',
      returnHref: '/returns',
    })),
});

/**
 * Union types and discriminators
 */
export const ALLOWED_BLOCK_TYPES = [
  'announcement-bar',
  'header-nav',
  'hero',
  'banner-carousel',
  'category-grid',
  'product-grid',
  'featured-product',
  'promotional-strip',
  'image-with-text',
  'rich-text',
  'benefits-row',
  'newsletter-capture',
  'faq-accordion',
  'testimonials',
  'footer',
] as const;

export type BlockType = (typeof ALLOWED_BLOCK_TYPES)[number];

export const blockSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string().min(1), type: z.literal('announcement-bar'), props: announcementBarPropsSchema }),
  z.object({ id: z.string().min(1), type: z.literal('header-nav'), props: headerNavPropsSchema }),
  z.object({ id: z.string().min(1), type: z.literal('hero'), props: heroPropsSchema }),
  z.object({ id: z.string().min(1), type: z.literal('banner-carousel'), props: bannerCarouselPropsSchema }),
  z.object({ id: z.string().min(1), type: z.literal('category-grid'), props: categoryGridPropsSchema }),
  z.object({ id: z.string().min(1), type: z.literal('product-grid'), props: productGridPropsSchema }),
  z.object({ id: z.string().min(1), type: z.literal('featured-product'), props: featuredProductPropsSchema }),
  z.object({ id: z.string().min(1), type: z.literal('promotional-strip'), props: promotionalStripPropsSchema }),
  z.object({ id: z.string().min(1), type: z.literal('image-with-text'), props: imageWithTextPropsSchema }),
  z.object({ id: z.string().min(1), type: z.literal('rich-text'), props: richTextPropsSchema }),
  z.object({ id: z.string().min(1), type: z.literal('benefits-row'), props: benefitsRowPropsSchema }),
  z.object({ id: z.string().min(1), type: z.literal('newsletter-capture'), props: newsletterCapturePropsSchema }),
  z.object({ id: z.string().min(1), type: z.literal('faq-accordion'), props: faqAccordionPropsSchema }),
  z.object({ id: z.string().min(1), type: z.literal('testimonials'), props: testimonialsPropsSchema }),
  z.object({ id: z.string().min(1), type: z.literal('footer'), props: footerPropsSchema }),
]);

export type Block = z.infer<typeof blockSchema>;

export const MAX_PAGE_BLOCKS = 30;

/**
 * Top-level page layout schema
 */
export const pageLayoutSchema = z.object({
  schemaVersion: z.literal(1),
  blocks: z
    .array(blockSchema)
    .max(MAX_PAGE_BLOCKS, `Pages cannot exceed ${MAX_PAGE_BLOCKS} blocks`),
});

export type PageLayout = z.infer<typeof pageLayoutSchema>;

/**
 * Controlled immutable system templates for Cart, Checkout, Order Tracking.
 * Arbitrary block replacement is disallowed.
 */
export const SYSTEM_PAGE_SLUGS = ['cart', 'checkout', 'order-tracking'] as const;
export type SystemPageSlug = (typeof SYSTEM_PAGE_SLUGS)[number];

export const systemPageStyleSettingsSchema = z.object({
  containerWidth: z.enum(['sm', 'md', 'lg', 'xl', 'full']).default('lg'),
  backgroundColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).default('#ffffff'),
  cardStyle: z.enum(['flat', 'bordered', 'elevated']).default('bordered'),
  accentColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).optional(),
});

export type SystemPageStyleSettings = z.infer<typeof systemPageStyleSettingsSchema>;
