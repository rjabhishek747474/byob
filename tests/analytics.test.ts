import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import {
  ANALYTICS_EVENT_NAMES,
  EVENT_PROPERTY_ALLOWLIST,
  analyticsEventEnvelopeSchema,
  containsPii,
  validateEventProperties,
} from '@/modules/analytics/types';
import { AnalyticsService } from '@/modules/analytics/analytics-service';
import { db } from '@/lib/db';

// Mock DB for isolated unit tests
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}));

describe('Slice 8: Behavioral Analytics Engine, Taxonomy, Privacy & Funnels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Taxonomy: 21 Allowed Event Types', () => {
    it('has exactly 21 event types', () => {
      expect(ANALYTICS_EVENT_NAMES).toHaveLength(21);
      const expectedEvents = [
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
      ];
      expect(Array.from(ANALYTICS_EVENT_NAMES)).toEqual(expectedEvents);
    });

    it('each event has a defined property allowlist', () => {
      for (const eventName of ANALYTICS_EVENT_NAMES) {
        expect(EVENT_PROPERTY_ALLOWLIST[eventName]).toBeDefined();
        expect(Array.isArray(EVENT_PROPERTY_ALLOWLIST[eventName])).toBe(true);
      }
    });

    it('validates a correct envelope for all 21 event types', () => {
      const basePayload = {
        schemaVersion: 1,
        eventId: '123e4567-e89b-12d3-a456-426614174000',
        occurredAt: '2026-10-13T00:00:00.000Z',
        sessionId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        visitorId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        path: '/test',
        consentCategories: ['necessary', 'analytics'],
      };

      for (const eventName of ANALYTICS_EVENT_NAMES) {
        const payload = {
          ...basePayload,
          eventName,
          properties: {},
        };
        const parsed = analyticsEventEnvelopeSchema.safeParse(payload);
        expect(parsed.success, `Failed to validate event ${eventName}`).toBe(true);
      }
    });

    it('fails on unrecognized event types', () => {
      const invalidPayload = {
        schemaVersion: 1,
        eventId: '123e4567-e89b-12d3-a456-426614174000',
        eventName: 'unknown_custom_event',
        occurredAt: '2026-10-13T00:00:00.000Z',
        sessionId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        visitorId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        properties: {},
      };
      const parsed = analyticsEventEnvelopeSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });
  });

  describe('2. Strict Anti-PII & Property Allowlist Exclusion', () => {
    it('detects sensitive keys: email, phone, card, password, address', () => {
      expect(containsPii('email', 'test')).toBe(true);
      expect(containsPii('phone', '9876543210')).toBe(true);
      expect(containsPii('password', 'secret')).toBe(true);
      expect(containsPii('cvv', '123')).toBe(true);
      expect(containsPii('address', '123 Street')).toBe(true);
      expect(containsPii('postalCode', '560001')).toBe(true);
    });

    it('detects PII within values (email addresses, phone numbers, card candidates)', () => {
      expect(containsPii('customInfo', 'user@example.com')).toBe(true);
      expect(containsPii('note', '+919876543210')).toBe(true);
      expect(containsPii('meta', '4532 0150 1234 5678')).toBe(true);
    });

    it('rejects properties not on the event allowlist', () => {
      const result = validateEventProperties('product_view', {
        productId: 'prod_123',
        unknownField: 'bad',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not permitted');
    });

    it('rejects envelope containing PII in properties', () => {
      const piiPayload = {
        schemaVersion: 1,
        eventId: '123e4567-e89b-12d3-a456-426614174000',
        eventName: 'product_view',
        occurredAt: '2026-10-13T00:00:00.000Z',
        sessionId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        visitorId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        properties: {
          productId: 'prod_123',
          email: 'customer@store.com',
        },
      };

      const parsed = analyticsEventEnvelopeSchema.safeParse(piiPayload);
      expect(parsed.success).toBe(false);
    });
  });

  describe('3. Ingestion, Dedup & Consent Policy', () => {
    it('deduplicates batch events with the same eventId', async () => {
      const service = new AnalyticsService();
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      });

      (db.select as unknown as Mock).mockImplementation(mockSelect);
      (db.insert as unknown as Mock).mockImplementation(mockInsert);

      const event = {
        schemaVersion: 1,
        eventId: '123e4567-e89b-12d3-a456-426614174000',
        eventName: 'page_view',
        occurredAt: '2026-10-13T00:00:00.000Z',
        sessionId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        visitorId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        consentCategories: ['necessary', 'analytics'],
        properties: { path: '/home' },
      };

      // Two identical eventIds in batch
      const result = await service.ingestEvents('tenant_123', [event, { ...event }]);
      expect(result.ingestedCount).toBe(1);
    });

    it('drops non-essential events when analytics consent was not granted', async () => {
      const service = new AnalyticsService();
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      });

      (db.select as unknown as Mock).mockImplementation(mockSelect);
      (db.insert as unknown as Mock).mockImplementation(mockInsert);

      const nonEssentialEvent = {
        schemaVersion: 1,
        eventId: '123e4567-e89b-12d3-a456-426614174001',
        eventName: 'product_view',
        occurredAt: '2026-10-13T00:00:00.000Z',
        sessionId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        visitorId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        consentCategories: ['necessary'], // ONLY necessary, NO analytics consent
        properties: { productId: 'p1' },
      };

      const essentialEvent = {
        schemaVersion: 1,
        eventId: '123e4567-e89b-12d3-a456-426614174002',
        eventName: 'order_completed',
        occurredAt: '2026-10-13T00:00:00.000Z',
        sessionId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        visitorId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        consentCategories: ['necessary'], // Essential event allowed under necessary
        properties: { orderId: 'ord_1', total: 5000, currency: 'INR' },
      };

      const result = await service.ingestEvents('tenant_123', [
        nonEssentialEvent,
        essentialEvent,
      ]);

      expect(result.droppedCount).toBe(1);
      expect(result.ingestedCount).toBe(1);
    });
  });

  describe('4. Mathematical Aggregations & Zero-Denominator Safety', () => {
    it('handles zero view sessions safely for Add-to-Cart calculation', async () => {
      const service = new AnalyticsService();

      // Return empty product views
      (db.select as unknown as Mock).mockImplementation(() => ({
        from: () => ({
          where: () => ({
            groupBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      }));

      const topProducts = await service.getTopProducts('tenant_123', {
        fromDate: new Date('2026-01-01'),
        toDate: new Date('2026-01-31'),
      });

      expect(topProducts).toEqual([]);
    });

    it('calculates conversion funnel with distinct session drop-offs', async () => {
      const service = new AnalyticsService();

      // Mock 6 steps of the funnel
      // Step 1: 100 sessions ('s1' to 's100')
      // Step 2: 50 sessions ('s1' to 's50')
      // Step 3: 30 sessions ('s1' to 's30')
      // Step 4: 20 sessions ('s1' to 's20')
      // Step 5: 15 sessions ('s1' to 's15')
      // Step 6: 10 sessions ('s1' to 's10')
      let stepIndex = 0;
      const stepCounts = [100, 50, 30, 20, 15, 10];

      (db.select as unknown as Mock).mockImplementation(() => ({
        from: () => ({
          where: () => ({
            groupBy: vi.fn().mockImplementation(async () => {
              const count = stepCounts[stepIndex % 6];
              stepIndex++;
              const rows = [];
              for (let i = 1; i <= count; i++) {
                rows.push({ sessionId: `session_${i}` });
              }
              return rows;
            }),
          }),
        }),
      }));

      const funnel = await service.getConversionFunnel('tenant_123', {
        fromDate: new Date('2026-01-01'),
        toDate: new Date('2026-01-31'),
      });

      expect(funnel.totalStartSessions).toBe(100);
      expect(funnel.completedSessions).toBe(10);
      expect(funnel.overallConversionRate).toBe(10);

      // Verify Step 1
      expect(funnel.milestones[0].step).toBe(1);
      expect(funnel.milestones[0].uniqueSessions).toBe(100);
      expect(funnel.milestones[0].conversionRateFromStart).toBe(100);
      expect(funnel.milestones[0].dropOffRate).toBe(50); // (100 - 50) / 100 = 50%
      expect(funnel.milestones[0].dropOffLabel).toContain('Drop-off between observed events: 50%');

      // Verify Step 2
      expect(funnel.milestones[1].step).toBe(2);
      expect(funnel.milestones[1].uniqueSessions).toBe(50);
      expect(funnel.milestones[1].conversionRateFromStart).toBe(50);
      expect(funnel.milestones[1].dropOffRate).toBe(40); // (50 - 30) / 50 = 40%

      // Verify Final Step
      expect(funnel.milestones[5].step).toBe(6);
      expect(funnel.milestones[5].uniqueSessions).toBe(10);
      expect(funnel.milestones[5].conversionRateFromStart).toBe(10);
      expect(funnel.milestones[5].dropOffRate).toBeNull();
      expect(funnel.milestones[5].dropOffLabel).toContain('final milestone');
    });
  });
});
