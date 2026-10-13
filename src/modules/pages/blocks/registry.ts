import { z } from 'zod/v4';
import {
  ALLOWED_BLOCK_TYPES,
  BlockType,
  Block,
  announcementBarPropsSchema,
  headerNavPropsSchema,
  heroPropsSchema,
  bannerCarouselPropsSchema,
  categoryGridPropsSchema,
  productGridPropsSchema,
  featuredProductPropsSchema,
  promotionalStripPropsSchema,
  imageWithTextPropsSchema,
  richTextPropsSchema,
  benefitsRowPropsSchema,
  newsletterCapturePropsSchema,
  faqAccordionPropsSchema,
  testimonialsPropsSchema,
  footerPropsSchema,
} from './schemas';

export interface BlockDefinition<T = Record<string, unknown>> {
  type: BlockType;
  title: string;
  category: 'header-footer' | 'promotional' | 'commerce' | 'content' | 'engagement';
  description: string;
  schema: z.ZodType<T>;
  defaultProps: T;
}

/**
 * Registry metadata and defaults for all 15 MVP blocks
 */
export const BLOCK_REGISTRY: Record<BlockType, BlockDefinition> = {
  'announcement-bar': {
    type: 'announcement-bar',
    title: 'Announcement Bar',
    category: 'header-footer',
    description: 'Top banner for store-wide alerts, free delivery badges, and promotions.',
    schema: announcementBarPropsSchema,
    defaultProps: {
      text: 'Free shipping on orders above ₹999! Use code WELCOME10',
      linkUrl: '/products',
      linkText: 'Shop Now',
      backgroundColor: '#1e3a8a',
      textColor: '#ffffff',
    },
  },
  'header-nav': {
    type: 'header-nav',
    title: 'Header Navigation',
    category: 'header-footer',
    description: 'Store navigation header with logo, navigation links, search, and cart.',
    schema: headerNavPropsSchema,
    defaultProps: {
      logoAssetId: '',
      menuItems: [
        { label: 'Home', href: '/' },
        { label: 'All Products', href: '/products' },
        { label: 'About Us', href: '/about' },
      ],
      showSearch: true,
      showCart: true,
    },
  },
  'hero': {
    type: 'hero',
    title: 'Hero Banner',
    category: 'promotional',
    description: 'High-impact above-the-fold banner with heading, body, background image, and CTA.',
    schema: heroPropsSchema,
    defaultProps: {
      heading: 'Discover Handcrafted Quality',
      subheading: 'Premium artisanal products engineered for daily living.',
      body: 'Explore our latest collection featuring sustainable materials and timeless design.',
      imageAssetId: '',
      ctaLabel: 'Shop Collection',
      ctaHref: '/products',
      textAlignment: 'center',
    },
  },
  'banner-carousel': {
    type: 'banner-carousel',
    title: 'Banner Carousel',
    category: 'promotional',
    description: 'Interactive multi-slide carousel highlighting seasons, launches, and deals.',
    schema: bannerCarouselPropsSchema,
    defaultProps: {
      slides: [
        {
          imageAssetId: 'seed-slide-1',
          heading: 'Summer Season Arrivals',
          ctaLabel: 'Discover Now',
          ctaHref: '/products',
          altText: 'Summer collection banner',
        },
        {
          imageAssetId: 'seed-slide-2',
          heading: 'Limited Festive Offers',
          ctaLabel: 'Shop Festive',
          ctaHref: '/products',
          altText: 'Festive discounts banner',
        },
      ],
      autoPlay: true,
      intervalSeconds: 5,
    },
  },
  'category-grid': {
    type: 'category-grid',
    title: 'Category Grid',
    category: 'commerce',
    description: 'Visual grid displaying store product categories.',
    schema: categoryGridPropsSchema,
    defaultProps: {
      title: 'Shop by Category',
      categoryIds: [],
      autoFetch: true,
      columns: '3',
      showImages: true,
    },
  },
  'product-grid': {
    type: 'product-grid',
    title: 'Product Grid',
    category: 'commerce',
    description: 'Dynamic responsive product grid with pricing, badges, and quick view.',
    schema: productGridPropsSchema,
    defaultProps: {
      title: 'Trending Products',
      source: 'all',
      categoryId: '',
      productIds: [],
      limit: 8,
      columns: '4',
    },
  },
  'featured-product': {
    type: 'featured-product',
    title: 'Featured Product Spotlight',
    category: 'commerce',
    description: 'Focused showcase for a hero product with variant selector and immediate add-to-cart.',
    schema: featuredProductPropsSchema,
    defaultProps: {
      productId: 'prod_default_placeholder',
      customHeading: 'Spotlight Deal of the Week',
      showVariants: true,
      showBuyNow: true,
    },
  },
  'promotional-strip': {
    type: 'promotional-strip',
    title: 'Promotional Strip',
    category: 'promotional',
    description: 'Eye-catching mid-page banner highlighting coupon codes and flash discounts.',
    schema: promotionalStripPropsSchema,
    defaultProps: {
      bannerText: 'Get 20% off on your entire first purchase',
      highlightWord: 'FIRST20',
      discountCode: 'FIRST20',
      expiryText: 'Ends this Sunday at midnight',
      ctaLabel: 'Claim Voucher',
      ctaHref: '/products',
    },
  },
  'image-with-text': {
    type: 'image-with-text',
    title: 'Image with Text',
    category: 'content',
    description: 'Two-column story section with image and rich descriptive text.',
    schema: imageWithTextPropsSchema,
    defaultProps: {
      imageAssetId: 'seed-story-1',
      imagePosition: 'left',
      heading: 'Our Craftsmanship & Heritage',
      body: 'Every item is meticulously handcrafted by local artisans using ethically sourced sustainable materials.',
      ctaLabel: 'Read Our Story',
      ctaHref: '/about',
    },
  },
  'rich-text': {
    type: 'rich-text',
    title: 'Rich Text Article',
    category: 'content',
    description: 'Sanitized editorial body text, headings, and lists.',
    schema: richTextPropsSchema,
    defaultProps: {
      sanitizedContent: '<h2>Crafted for Everyday Excellence</h2><p>We pride ourselves on offering uncompromised design, durable builds, and fast doorstep delivery across India.</p>',
      alignment: 'center',
    },
  },
  'benefits-row': {
    type: 'benefits-row',
    title: 'Store Benefits Bar',
    category: 'content',
    description: 'Value propositions such as fast shipping, secure payment, warranty, and easy returns.',
    schema: benefitsRowPropsSchema,
    defaultProps: {
      items: [
        { icon: 'truck', title: 'Free Fast Delivery', description: 'On all orders above ₹999' },
        { icon: 'shield', title: '100% Secure Checkout', description: 'Encrypted UPI & Card payment' },
        { icon: 'refresh', title: '7-Day Easy Returns', description: 'Hassle-free reverse pickup' },
        { icon: 'star', title: 'Quality Guaranteed', description: 'Authentic 100% genuine goods' },
      ],
    },
  },
  'newsletter-capture': {
    type: 'newsletter-capture',
    title: 'Newsletter Capture',
    category: 'engagement',
    description: 'Email newsletter subscription box with privacy consent compliance.',
    schema: newsletterCapturePropsSchema,
    defaultProps: {
      heading: 'Stay in the Loop',
      description: 'Subscribe to receive exclusive drops, seasonal sales, and member-only perks.',
      buttonLabel: 'Subscribe',
      disclaimerText: 'We respect your inbox. Unsubscribe anytime with 1 click.',
      privacyConsentRequired: true,
    },
  },
  'faq-accordion': {
    type: 'faq-accordion',
    title: 'FAQ Accordion',
    category: 'engagement',
    description: 'Collapsible frequently asked questions accordion.',
    schema: faqAccordionPropsSchema,
    defaultProps: {
      items: [
        {
          question: 'What is the standard delivery timeline?',
          answer: '<p>Standard delivery takes 3 to 5 business days across major metros.</p>',
        },
        {
          question: 'What payment methods do you accept?',
          answer: '<p>We accept all major UPI apps, Debit/Credit cards, Net Banking, and Cash on Delivery.</p>',
        },
        {
          question: 'What is your return policy?',
          answer: '<p>We offer a 7-day no-questions-asked return policy on unused items in original packaging.</p>',
        },
      ],
    },
  },
  'testimonials': {
    type: 'testimonials',
    title: 'Customer Testimonials',
    category: 'engagement',
    description: 'Customer reviews, ratings, and social proof quotes.',
    schema: testimonialsPropsSchema,
    defaultProps: {
      items: [
        {
          quote: 'The quality surpassed all expectations. Fast shipping and impeccable packaging!',
          authorName: 'Priya Sharma',
          authorTitle: 'Verified Buyer, Bangalore',
          avatarAssetId: '',
          rating: 5,
        },
        {
          quote: 'Exceptional craftsmanship! Customer support was genuinely prompt when I had sizing questions.',
          authorName: 'Rahul Verma',
          authorTitle: 'Verified Buyer, Mumbai',
          avatarAssetId: '',
          rating: 5,
        },
      ],
    },
  },
  'footer': {
    type: 'footer',
    title: 'Storefront Footer',
    category: 'header-footer',
    description: 'Store footer containing multi-column links, legal notices, and social channels.',
    schema: footerPropsSchema,
    defaultProps: {
      copyrightText: '© 2026 BYOB Store. All rights reserved.',
      columns: [
        {
          title: 'Shop',
          links: [
            { label: 'New Arrivals', href: '/products?sort=new' },
            { label: 'Best Sellers', href: '/products?sort=trending' },
            { label: 'All Collections', href: '/categories' },
          ],
        },
        {
          title: 'Customer Support',
          links: [
            { label: 'Order Tracking', href: '/order-tracking' },
            { label: 'Shipping Policy', href: '/shipping' },
            { label: 'Returns & Exchanges', href: '/returns' },
          ],
        },
      ],
      socialLinks: {
        facebook: 'https://facebook.com',
        instagram: 'https://instagram.com',
        twitter: 'https://twitter.com',
        whatsapp: 'https://whatsapp.com',
      },
      legalLinks: {
        privacyHref: '/privacy',
        termsHref: '/terms',
        returnHref: '/returns',
      },
    },
  },
};

/**
 * Creates a default block instance of the requested BlockType with a unique ID.
 */
export function createDefaultBlock(type: BlockType, idPrefix?: string): Block {
  const definition = BLOCK_REGISTRY[type];
  if (!definition) {
    throw new Error(`Unknown block type: ${type}`);
  }

  const id = idPrefix ? `${idPrefix}-${type}` : `block-${type}-${Math.random().toString(36).substring(2, 9)}`;

  // Structured clone to prevent shared references
  const props = JSON.parse(JSON.stringify(definition.defaultProps));

  return {
    id,
    type,
    props,
  } as Block;
}
