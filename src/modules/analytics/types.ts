import { z } from 'zod/v4';

/**
 * 21 allowed event types covering the full customer lifecycle.
 */
export const ANALYTICS_EVENT_NAMES = [
  'page_view',
  'collection_view',
  'product_view',
  'product_impression',
  'search_submitted',
  'filter_applied',
  'variant_selected',
  'add_to_cart',
  'remove_from_cart',
  'cart_view',
  'checkout_started',
  'checkout_step_viewed',
  'shipping_method_selected',
  'payment_method_selected',
  'checkout_validation_error',
  'order_submitted',
  'order_completed',
  'order_failed',
  'coupon_applied',
  'coupon_rejected',
  'consent_updated',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

/**
 * Valid referrer category enum
 */
export const REFERRER_CATEGORIES = [
  'direct',
  'search',
  'social',
  'internal',
  'external',
  'email',
  'campaign',
] as const;

export type ReferrerCategory = (typeof REFERRER_CATEGORIES)[number];

/**
 * Valid consent category types
 */
export const CONSENT_CATEGORIES = ['necessary', 'analytics', 'marketing'] as const;
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

/**
 * Essential operational events that can be recorded even if analytics consent is not granted,
 * provided necessary operational consent exists.
 */
export const ESSENTIAL_OPERATIONAL_EVENTS: readonly AnalyticsEventName[] = [
  'order_completed',
  'order_failed',
  'consent_updated',
];

/**
 * Strict Anti-PII allowlist of permissible property keys per event type.
 */
export const EVENT_PROPERTY_ALLOWLIST: Record<AnalyticsEventName, readonly string[]> = {
  page_view: ['title', 'url', 'path', 'referrer', 'scrollBucket'],
  collection_view: ['collectionId', 'collectionSlug', 'collectionTitle', 'productCount', 'page', 'sortBy'],
  product_view: ['productId', 'productSlug', 'productTitle', 'price', 'currency', 'collectionId', 'hasVariants'],
  product_impression: ['productId', 'productSlug', 'collectionId', 'position', 'listId'],
  search_submitted: ['queryLength', 'resultCount', 'hasResults'],
  filter_applied: ['filterType', 'filterValue', 'resultCount'],
  variant_selected: ['productId', 'variantId', 'sku', 'price', 'inStock'],
  add_to_cart: ['productId', 'variantId', 'quantity', 'price', 'currency', 'itemCount'],
  remove_from_cart: ['productId', 'variantId', 'quantity', 'price', 'currency', 'itemCount'],
  cart_view: ['itemCount', 'subtotal', 'currency', 'hasDiscount'],
  checkout_started: ['itemCount', 'subtotal', 'currency', 'hasCoupon'],
  checkout_step_viewed: ['stepNumber', 'stepName'],
  shipping_method_selected: ['shippingMethodId', 'shippingMethodName', 'fee', 'currency'],
  payment_method_selected: ['paymentMethod', 'paymentProvider'],
  checkout_validation_error: ['stepNumber', 'stepName', 'errorCode', 'errorField'],
  order_submitted: ['itemCount', 'subtotal', 'total', 'currency', 'paymentMethod'],
  order_completed: ['orderId', 'orderNumber', 'itemCount', 'total', 'currency', 'paymentMethod', 'couponCode'],
  order_failed: ['errorCode', 'errorMessage', 'paymentMethod'],
  coupon_applied: ['couponCode', 'discountAmount', 'discountType'],
  coupon_rejected: ['couponCode', 'errorCode', 'reason'],
  consent_updated: ['necessary', 'analytics', 'marketing', 'policyVersion'],
};

/**
 * Regex patterns to detect PII in key names or values:
 * - Email addresses
 * - Phone numbers (Indian/international 10-15 digit numbers with optional dashes/plus)
 * - Credit/debit card numbers (13-19 digits, Luhn candidates)
 * - Password keys or credentials
 * - Street addresses / full postal addresses
 */
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b(?:\+?91|0)?[6-9]\d{9}\b/;
const CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/;
const FORBIDDEN_KEY_REGEX = /^(?:email|phone|mobile|tel|password|pwd|secret|token|ssn|aadhar|pan|card|cvv|cvc|address|street|line1|line2|pin|zip|postal_?code|first_?name|last_?name|full_?name|customer_?name)$/i;

/**
 * Checks if a key or value contains forbidden PII.
 */
export function containsPii(key: string, value: unknown): boolean {
  if (FORBIDDEN_KEY_REGEX.test(key)) {
    return true;
  }

  if (typeof value === 'string') {
    if (EMAIL_REGEX.test(value)) {
      return true;
    }
    if (PHONE_REGEX.test(value)) {
      return true;
    }
    const cleanNumbers = value.replace(/[\s-]/g, '');
    if (cleanNumbers.length >= 13 && cleanNumbers.length <= 19 && /^\d+$/.test(cleanNumbers)) {
      return true;
    }
  }

  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.some((item) => containsPii(key, item));
    }
    return Object.entries(value as Record<string, unknown>).some(([k, v]) => containsPii(k, v));
  }

  return false;
}

/**
 * Validates properties against the event's allowlist and ensures no PII is present.
 */
export function validateEventProperties(
  eventName: AnalyticsEventName,
  properties: Record<string, unknown>
): { valid: boolean; error?: string } {
  const allowedKeys = new Set(EVENT_PROPERTY_ALLOWLIST[eventName] || []);

  for (const [key, value] of Object.entries(properties)) {
    // Check against strict allowlist
    if (!allowedKeys.has(key)) {
      return {
        valid: false,
        error: `Property "${key}" is not permitted for event "${eventName}".`,
      };
    }

    // Check for PII in key or value
    if (containsPii(key, value)) {
      return {
        valid: false,
        error: `Property "${key}" contains sensitive personal data (PII) which is strictly forbidden.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Zod schema for individual Analytics Event Envelope (Zod v4).
 */
export const analyticsEventEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    eventId: z
      .string()
      .uuid('eventId must be a valid UUID v4')
      .min(1, 'eventId is required'),
    eventName: z.enum(ANALYTICS_EVENT_NAMES),
    occurredAt: z
      .string()
      .datetime({ offset: true, message: 'occurredAt must be an ISO 8601 timestamp' }),
    sessionId: z
      .string()
      .min(1, 'sessionId is required')
      .max(100, 'sessionId exceeds maximum length'),
    visitorId: z
      .string()
      .min(1, 'visitorId is required')
      .max(100, 'visitorId exceeds maximum length'),
    path: z.string().max(2000).default('/'),
    referrerCategory: z.enum(REFERRER_CATEGORIES).optional(),
    consentCategories: z.array(z.enum(CONSENT_CATEGORIES)).default(['necessary']),
    properties: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((data, ctx) => {
    const propCheck = validateEventProperties(data.eventName, data.properties);
    if (!propCheck.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['properties'],
        message: propCheck.error || 'Invalid properties or PII violation detected',
      });
    }
  });

export type AnalyticsEventEnvelope = z.infer<typeof analyticsEventEnvelopeSchema>;

/**
 * Batch ingestion schema
 */
export const batchIngestionSchema = z.object({
  events: z.array(analyticsEventEnvelopeSchema).min(1, 'At least one event is required').max(100, 'Maximum 100 events per batch'),
});

export type BatchIngestionPayload = z.infer<typeof batchIngestionSchema>;

/**
 * Visitor consent submission schema
 */
export const recordConsentSchema = z.object({
  visitorId: z.string().min(1, 'visitorId is required').max(100),
  customerId: z.string().max(100).optional(),
  policyVersion: z.string().min(1, 'policyVersion is required').max(50),
  categoriesGranted: z.array(z.enum(CONSENT_CATEGORIES)).min(1, 'At least one category required'),
});

export type RecordConsentPayload = z.infer<typeof recordConsentSchema>;
