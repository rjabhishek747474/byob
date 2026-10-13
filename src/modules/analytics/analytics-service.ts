import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  analyticsEvents,
  consentRecords,
} from '@/lib/db/schema/analytics';
import { orders } from '@/lib/db/schema/orders';
import { products } from '@/lib/db/schema/catalog';
import { generateId } from '@/lib/utils';
import { analyticsLimiter } from '@/lib/middleware/rate-limit';
import { RateLimitError, ValidationError } from '@/lib/errors';
import {
  AnalyticsEventEnvelope,
  analyticsEventEnvelopeSchema,
  ESSENTIAL_OPERATIONAL_EVENTS,
} from './types';

/**
 * Result structure for top products conversion rates
 */
export interface TopProductMetric {
  productId: string;
  productTitle: string;
  viewSessions: number;
  cartSessions: number;
  addToCartRate: number | null;
  statusLabel: string;
}

/**
 * Conversion funnel step metric
 */
export interface FunnelMilestone {
  step: number;
  name: string;
  uniqueSessions: number;
  conversionRateFromStart: number;
  dropOffRate: number | null;
  dropOffLabel: string;
}

/**
 * Result structure for conversion funnel
 */
export interface FunnelResult {
  milestones: FunnelMilestone[];
  totalStartSessions: number;
  completedSessions: number;
  overallConversionRate: number;
}

/**
 * Last observed step breakdown
 */
export interface LastObservedStepMetric {
  lastEventName: string;
  sessionCount: number;
  percentage: number;
}

/**
 * Revenue attribution summary directly from completed orders
 */
export interface RevenueAttributionSummary {
  orderCount: number;
  totalRevenueMinorUnits: number;
  averageOrderValueMinorUnits: number;
  currency: string;
  disclaimer: string;
}

/**
 * Analytics Service encapsulating tenant-isolated behavioral telemetry,
 * consent enforcement, Anti-PII sanitization, and mathematical aggregations.
 */
export class AnalyticsService {
  /**
   * Ingests a batch of events after validating, checking rate limits,
   * deduping by eventId, and enforcing privacy consent rules.
   *
   * @param tenantId - The authenticated or resolved tenant ID
   * @param rawEvents - Array of unvalidated event envelopes
   * @param correlationId - Optional correlation identifier for logging
   * @returns Ingestion summary
   */
  public async ingestEvents(
    tenantId: string,
    rawEvents: unknown[],
    correlationId?: string
  ): Promise<{ ingestedCount: number; droppedCount: number; duplicateCount: number }> {
    if (!tenantId) {
      throw new ValidationError('Tenant ID is required for event ingestion');
    }

    if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
      return { ingestedCount: 0, droppedCount: 0, duplicateCount: 0 };
    }

    // 1. Rate Limiting Protection per session/tenant
    const sampleSessionId =
      typeof rawEvents[0] === 'object' && rawEvents[0] !== null && 'sessionId' in rawEvents[0]
        ? String((rawEvents[0] as Record<string, unknown>).sessionId)
        : tenantId;

    const rateResult = analyticsLimiter.checkLimit(`${tenantId}:${sampleSessionId}`);
    if (!rateResult.allowed) {
      throw new RateLimitError(
        'Analytics event ingestion rate limit exceeded. Please throttle events.'
      );
    }

    // 2. Validate events with Zod schema
    const validatedEvents: AnalyticsEventEnvelope[] = [];
    for (const raw of rawEvents) {
      const parsed = analyticsEventEnvelopeSchema.safeParse(raw);
      if (parsed.success) {
        validatedEvents.push(parsed.data);
      } else {
        throw new ValidationError(
          `Event validation failed: ${parsed.error.issues.map((i) => i.message).join('; ')}`
        );
      }
    }

    // 3. Consent Verification & Filtering
    // Check consent: if analytics consent was not granted, drop optional events (only keep essential operational events if allowed)
    const allowedEvents: AnalyticsEventEnvelope[] = [];
    let droppedCount = 0;

    for (const event of validatedEvents) {
      const consentCategories = event.consentCategories || [];
      const hasAnalyticsConsent = consentCategories.includes('analytics');
      const hasNecessaryConsent = consentCategories.includes('necessary');

      if (hasAnalyticsConsent) {
        allowedEvents.push(event);
      } else if (
        hasNecessaryConsent &&
        ESSENTIAL_OPERATIONAL_EVENTS.includes(event.eventName)
      ) {
        allowedEvents.push(event);
      } else {
        droppedCount += 1;
      }
    }

    if (allowedEvents.length === 0) {
      return { ingestedCount: 0, droppedCount, duplicateCount: 0 };
    }

    // 4. In-batch Deduplication by eventId
    const dedupMap = new Map<string, AnalyticsEventEnvelope>();
    for (const ev of allowedEvents) {
      if (!dedupMap.has(ev.eventId)) {
        dedupMap.set(ev.eventId, ev);
      }
    }
    const uniqueEvents = Array.from(dedupMap.values());

    // 5. Database Deduplication by eventId (tenant-scoped)
    const eventIds = uniqueEvents.map((e) => e.eventId);
    const existingRecords = await db
      .select({ eventId: analyticsEvents.eventId })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.tenantId, tenantId),
          inArray(analyticsEvents.eventId, eventIds)
        )
      );

    const existingEventIdSet = new Set(existingRecords.map((r) => r.eventId));
    const eventsToInsert = uniqueEvents.filter((e) => !existingEventIdSet.has(e.eventId));
    const duplicateCount = uniqueEvents.length - eventsToInsert.length;

    if (eventsToInsert.length === 0) {
      return { ingestedCount: 0, droppedCount, duplicateCount };
    }

    // 6. Bulk Insert
    const rows = eventsToInsert.map((e) => ({
      id: generateId(),
      tenantId,
      eventId: e.eventId,
      eventName: e.eventName,
      schemaVersion: e.schemaVersion,
      occurredAt: new Date(e.occurredAt),
      receivedAt: new Date(),
      sessionId: e.sessionId,
      visitorId: e.visitorId,
      path: e.path,
      referrerCategory: e.referrerCategory || null,
      consentCategories: e.consentCategories,
      properties: e.properties,
      createdAt: new Date(),
    }));

    await db.insert(analyticsEvents).values(rows);

    return {
      ingestedCount: eventsToInsert.length,
      droppedCount,
      duplicateCount,
    };
  }

  /**
   * Records or updates consent preferences for a visitor/customer.
   */
  public async recordConsent(
    tenantId: string,
    visitorId: string,
    policyVersion: string,
    categoriesGranted: string[],
    customerId?: string
  ): Promise<{ id: string }> {
    if (!tenantId) {
      throw new ValidationError('Tenant ID is required to record consent');
    }
    if (!visitorId) {
      throw new ValidationError('Visitor ID is required to record consent');
    }

    const id = generateId();
    await db.insert(consentRecords).values({
      id,
      tenantId,
      visitorId,
      customerId: customerId || null,
      policyVersion,
      categoriesGranted,
      grantedAt: new Date(),
      withdrawnAt: null,
      createdAt: new Date(),
    });

    return { id };
  }

  /**
   * Retrieves top products by unique view sessions and unique add-to-cart sessions.
   * Add-to-cart rate = unique sessions with add_to_cart / unique sessions with product_view.
   * Returns null if denominator is 0 (labeled "insufficient data").
   */
  public async getTopProducts(
    tenantId: string,
    options: { fromDate: Date; toDate: Date; limit?: number }
  ): Promise<TopProductMetric[]> {
    if (!tenantId) {
      throw new ValidationError('Tenant ID is required');
    }

    const limit = options.limit ?? 10;

    // Distinct product view sessions
    const viewRows = await db
      .select({
        productId: sql<string>`${analyticsEvents.properties}->>'productId'`,
        uniqueViewSessions: sql<number>`count(distinct ${analyticsEvents.sessionId})`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.tenantId, tenantId),
          eq(analyticsEvents.eventName, 'product_view'),
          gte(analyticsEvents.occurredAt, options.fromDate),
          lte(analyticsEvents.occurredAt, options.toDate)
        )
      )
      .groupBy(sql`${analyticsEvents.properties}->>'productId'`);

    // Distinct add to cart sessions
    const cartRows = await db
      .select({
        productId: sql<string>`${analyticsEvents.properties}->>'productId'`,
        uniqueCartSessions: sql<number>`count(distinct ${analyticsEvents.sessionId})`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.tenantId, tenantId),
          eq(analyticsEvents.eventName, 'add_to_cart'),
          gte(analyticsEvents.occurredAt, options.fromDate),
          lte(analyticsEvents.occurredAt, options.toDate)
        )
      )
      .groupBy(sql`${analyticsEvents.properties}->>'productId'`);

    const cartMap = new Map<string, number>();
    for (const c of cartRows) {
      if (c.productId) {
        cartMap.set(c.productId, Number(c.uniqueCartSessions));
      }
    }

    const productIds = viewRows.map((v) => v.productId).filter((id): id is string => Boolean(id));

    // Fetch product details for friendly titles
    const productInfoMap = new Map<string, string>();
    if (productIds.length > 0) {
      const dbProducts = await db
        .select({
          id: products.id,
          title: products.title,
        })
        .from(products)
        .where(and(eq(products.tenantId, tenantId), inArray(products.id, productIds)));

      for (const p of dbProducts) {
        productInfoMap.set(p.id, p.title);
      }
    }

    const results: TopProductMetric[] = viewRows
      .filter((v) => Boolean(v.productId))
      .map((v) => {
        const pId = v.productId as string;
        const viewSessions = Number(v.uniqueViewSessions) || 0;
        const cartSessions = cartMap.get(pId) || 0;
        const addToCartRate =
          viewSessions > 0 ? Number(((cartSessions / viewSessions) * 100).toFixed(2)) : null;

        return {
          productId: pId,
          productTitle: productInfoMap.get(pId) || `Product ${pId.slice(0, 8)}`,
          viewSessions,
          cartSessions,
          addToCartRate,
          statusLabel:
            addToCartRate === null
              ? 'insufficient data'
              : `${addToCartRate}% add-to-cart rate`,
        };
      })
      .sort((a, b) => b.viewSessions - a.viewSessions)
      .slice(0, limit);

    return results;
  }

  /**
   * Calculates the 6 ordered conversion funnel milestones using DISTINCT session counts.
   * Drop-off calculation for step N =
   *   (unique sessions reaching step N but not step N+1) / unique sessions reaching step N
   * Label drop-off as "Drop-off between observed events".
   */
  public async getConversionFunnel(
    tenantId: string,
    options: { fromDate: Date; toDate: Date; sessionWindowMinutes?: number }
  ): Promise<FunnelResult> {
    if (!tenantId) {
      throw new ValidationError('Tenant ID is required');
    }

    // Step definitions:
    // 1. Product Browse: product_view or collection_view
    // 2. Add to Cart: add_to_cart
    // 3. Checkout Started: checkout_started
    // 4. Shipping Selected: shipping_method_selected or checkout_step_viewed
    // 5. Payment Selected: payment_method_selected
    // 6. Order Completed: order_completed

    const stepEventFilters = [
      ['product_view', 'collection_view'],
      ['add_to_cart'],
      ['checkout_started'],
      ['shipping_method_selected', 'checkout_step_viewed'],
      ['payment_method_selected'],
      ['order_completed'],
    ];

    const stepNames = [
      'Product Browse',
      'Add to Cart',
      'Checkout Started',
      'Shipping Selected',
      'Payment Selected',
      'Order Completed',
    ];

    // Query distinct sessions for each step within interval
    const stepSessionSets: Set<string>[] = [];

    for (let i = 0; i < stepEventFilters.length; i++) {
      const allowedNames = stepEventFilters[i];
      const rows = await db
        .select({
          sessionId: analyticsEvents.sessionId,
        })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.tenantId, tenantId),
            inArray(analyticsEvents.eventName, allowedNames),
            gte(analyticsEvents.occurredAt, options.fromDate),
            lte(analyticsEvents.occurredAt, options.toDate)
          )
        )
        .groupBy(analyticsEvents.sessionId);

      stepSessionSets.push(new Set(rows.map((r) => r.sessionId)));
    }

    const totalStartSessions = stepSessionSets[0].size;
    const completedSessions = stepSessionSets[5].size;

    const milestones: FunnelMilestone[] = [];

    for (let i = 0; i < stepNames.length; i++) {
      const currentSessions = stepSessionSets[i].size;
      const conversionRateFromStart =
        totalStartSessions > 0
          ? Number(((currentSessions / totalStartSessions) * 100).toFixed(2))
          : 0;

      let dropOffRate: number | null = null;
      let dropOffLabel = 'Drop-off between observed events: N/A (final milestone)';

      if (i < stepNames.length - 1) {
        const nextSet = stepSessionSets[i + 1];
        // Sessions in current step that did NOT reach next step
        let reachedCurrentButNotNext = 0;
        for (const sess of stepSessionSets[i]) {
          if (!nextSet.has(sess)) {
            reachedCurrentButNotNext++;
          }
        }

        if (currentSessions > 0) {
          dropOffRate = Number(((reachedCurrentButNotNext / currentSessions) * 100).toFixed(2));
          dropOffLabel = `Drop-off between observed events: ${dropOffRate}%`;
        } else {
          dropOffRate = null;
          dropOffLabel = 'Drop-off between observed events: insufficient data';
        }
      }

      milestones.push({
        step: i + 1,
        name: stepNames[i],
        uniqueSessions: currentSessions,
        conversionRateFromStart,
        dropOffRate,
        dropOffLabel,
      });
    }

    const overallConversionRate =
      totalStartSessions > 0
        ? Number(((completedSessions / totalStartSessions) * 100).toFixed(2))
        : 0;

    return {
      milestones,
      totalStartSessions,
      completedSessions,
      overallConversionRate,
    };
  }

  /**
   * Frequency of last observed step before session inactivity.
   * Explicit disclaimer: "Estimated based on last observed event received; does not indicate cause of exit."
   */
  public async getLastObservedSteps(
    tenantId: string,
    options: { fromDate: Date; toDate: Date; limit?: number }
  ): Promise<{
    steps: LastObservedStepMetric[];
    disclaimer: string;
  }> {
    if (!tenantId) {
      throw new ValidationError('Tenant ID is required');
    }

    const limit = options.limit ?? 10;

    // Use SQL window function row_number() over (partition by session_id order by occurred_at desc)
    const result = await db.execute<{ last_event_name: string; session_count: string | number }>(
      sql`
        WITH RankedEvents AS (
          SELECT
            session_id,
            event_name,
            ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY occurred_at DESC, created_at DESC) as rn
          FROM analytics_events
          WHERE tenant_id = ${tenantId}
            AND occurred_at >= ${options.fromDate}
            AND occurred_at <= ${options.toDate}
        )
        SELECT
          event_name as last_event_name,
          COUNT(*)::int as session_count
        FROM RankedEvents
        WHERE rn = 1
        GROUP BY event_name
        ORDER BY session_count DESC
        LIMIT ${limit};
      `
    );

    const rows = Array.from(result) as unknown as Array<{
      last_event_name: string;
      session_count: string | number;
    }>;

    const totalSessions = rows.reduce((acc, row) => acc + Number(row.session_count), 0);

    const steps: LastObservedStepMetric[] = rows.map((row) => {
      const count = Number(row.session_count);
      const percentage =
        totalSessions > 0 ? Number(((count / totalSessions) * 100).toFixed(2)) : 0;
      return {
        lastEventName: row.last_event_name,
        sessionCount: count,
        percentage,
      };
    });

    return {
      steps,
      disclaimer: 'Estimated based on last observed event received; does not indicate cause of exit.',
    };
  }

  /**
   * Derived strictly from completed orders in the orders table, NOT browser-reported events.
   */
  public async getRevenueAttribution(
    tenantId: string,
    options: { fromDate: Date; toDate: Date }
  ): Promise<RevenueAttributionSummary> {
    if (!tenantId) {
      throw new ValidationError('Tenant ID is required');
    }

    const [summary] = await db
      .select({
        orderCount: sql<number>`count(*)::int`,
        totalRevenue: sql<number>`coalesce(sum(${orders.total}), 0)::bigint`,
        currency: orders.currency,
      })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.status, 'delivered'),
          gte(orders.createdAt, options.fromDate),
          lte(orders.createdAt, options.toDate)
        )
      )
      .groupBy(orders.currency);

    const orderCount = Number(summary?.orderCount ?? 0);
    const totalRevenueMinorUnits = Number(summary?.totalRevenue ?? 0);
    const averageOrderValueMinorUnits =
      orderCount > 0 ? Math.round(totalRevenueMinorUnits / orderCount) : 0;
    const currency = summary?.currency || 'INR';

    return {
      orderCount,
      totalRevenueMinorUnits,
      averageOrderValueMinorUnits,
      currency,
      disclaimer:
        'Revenue is derived strictly from completed orders in the tenant database, never unverified browser events.',
    };
  }

  /**
   * Deletes raw events older than retention window (default 90 days).
   */
  public async cleanupOldEvents(
    tenantId: string,
    retentionDays = 90
  ): Promise<{ deletedCount: number }> {
    if (!tenantId) {
      throw new ValidationError('Tenant ID is required');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await db
      .delete(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.tenantId, tenantId),
          lte(analyticsEvents.occurredAt, cutoffDate)
        )
      );

    return {
      deletedCount: (result as unknown as { rowCount?: number })?.rowCount ?? 0,
    };
  }
}

export const analyticsService = new AnalyticsService();
