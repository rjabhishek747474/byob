# Analytics Engine: Taxonomy, Privacy & Funnel Mathematics

## 1. Event Taxonomy Dictionary (21 Events)

The BeYourOwnBoss analytics engine ingests behavioral and commercial events into the tenant-isolated `analytics_events` table. Every event payload adheres to strict JSON schemas, links to an anonymous visitor UUID (`visitorId`) and session UUID (`sessionId`), and tags consent category verification.

| # | Event Name | Trigger Context | Required & Optional Properties Schema |
| :---: | :--- | :--- | :--- |
| **1** | `page_viewed` | Browser loads any public page | `{ path: string, title: string, referrer: string?, deviceType: "mobile"\|"desktop"\|"tablet" }` |
| **2** | `product_viewed` | Visitor opens a product detail page | `{ productId: string, title: string, priceCents: number, categoryId: string?, inStock: boolean }` |
| **3** | `category_viewed` | Visitor views a category or collection | `{ categoryId: string, categorySlug: string, productCount: number }` |
| **4** | `search_executed` | Visitor submits a search query | `{ query: string, resultCount: number, executionTimeMs: number }` |
| **5** | `filter_applied` | Visitor refines catalog by attribute/price | `{ filterKey: string, filterValue: string, activeCount: number }` |
| **6** | `product_card_clicked` | Visitor clicks a card in grid or recommendation | `{ productId: string, listPosition: number, sourceSection: "grid"\|"featured"\|"search" }` |
| **7** | `variant_selected` | Visitor switches size, color, or material | `{ productId: string, variantId: string, sku: string, priceCents: number }` |
| **8** | `quantity_changed` | Visitor alters item counter on PDP or cart | `{ productId: string, variantId: string?, previousQty: number, newQty: number }` |
| **9** | `cart_drawer_opened` | Slide-over cart or modal displays | `{ itemCount: number, subtotalCents: number }` |
| **10** | `cart_item_added` | Item added to shopping cart | `{ productId: string, variantId: string?, quantity: number, priceCents: number, source: string }` |
| **11** | `cart_item_removed` | Item removed from shopping cart | `{ productId: string, variantId: string?, quantity: number, priceCents: number }` |
| **12** | `cart_item_updated` | Cart item quantity modified | `{ productId: string, variantId: string?, oldQuantity: number, newQuantity: number }` |
| **13** | `checkout_started` | Visitor transitions from cart to checkout | `{ cartId: string, itemCount: number, subtotalCents: number, currency: string }` |
| **14** | `shipping_info_submitted` | Customer enters delivery address | `{ country: string, state: string, shippingMethodId: string, shippingCostCents: number }` |
| **15** | `billing_info_submitted` | Customer selects payment method | `{ paymentMethod: "stripe_card"\|"cod"\|"bank_transfer", billingSameAsShipping: boolean }` |
| **16** | `payment_attempted` | Payment authorization transaction initiated | `{ orderId: string, totalCents: number, paymentGateway: string }` |
| **17** | `payment_succeeded` | Gateway returns successful capture | `{ orderId: string, transactionId: string, amountCents: number, currency: string }` |
| **18** | `payment_failed` | Gateway declines or error occurs | `{ orderId: string, errorCode: string, errorMessage: string, retryCount: number }` |
| **19** | `order_completed` | Thank-you confirmation screen shown | `{ orderId: string, orderNumber: string, totalCents: number, itemCount: number, discountCents: number }` |
| **20** | `consent_updated` | Visitor sets or amends cookie preferences | `{ consentGranted: boolean, categories: ("essential"\|"analytics"\|"marketing")[] }` |
| **21** | `banner_clicked` | Visitor interacts with promotional callout | `{ bannerId: string, bannerName: string, destinationUrl: string }` |

---

## 2. Privacy & Consent Framework (DPDP & GDPR Principles)

### 2.1 Consent Categories
1. **Essential / Strictly Necessary**: Session maintenance, security validation (`x-correlation-id`), shopping cart persistence. Incurred without explicit banner prompt.
2. **Analytics & Performance**: Aggregate telemetry, funnel conversion rates, drop-off diagnostics. Ingested only when visitor has explicitly granted `analytics` category consent.
3. **Marketing & Personalization**: Retargeting pixels, tailored store recommendations. Off by default until affirmative opt-in.

### 2.2 Anonymous Telemetry by Design
- Zero IP address storage inside `analytics_events`. IP addresses are stripped at the Edge Middleware layer after rate check evaluation.
- Zero customer PII (email, phone, plaintext credit cards, physical home addresses) inside event `properties` payload.
- Pseudonymous visitor identifiers are rotated every 90 days.

---

## 3. Mathematical Definitions of Core Funnels & Rates

### 3.1 Primary Storefront Conversion Funnel
The primary conversion funnel tracks visitor progression from initial discovery to commercial purchase:

$$\text{Stage 1: Visitor Session} \longrightarrow \text{Stage 2: PDP View} \longrightarrow \text{Stage 3: Add-to-Cart} \longrightarrow \text{Stage 4: Checkout Start} \longrightarrow \text{Stage 5: Order Completed}$$

#### Mathematical Formulations

1. **Overall Store Conversion Rate ($CR_{\text{overall}}$)**:
   $$CR_{\text{overall}} = \left( \frac{\text{Count of Unique Sessions with } \texttt{order\_completed}}{\text{Total Unique Visitor Sessions}} \right) \times 100\%$$

2. **Add-to-Cart Rate ($R_{\text{ATC}}$)**:
   $$R_{\text{ATC}} = \left( \frac{\text{Count of Unique Sessions with } \texttt{cart\_item\_added}}{\text{Count of Unique Sessions with } \texttt{product\_viewed}} \right) \times 100\%$$

3. **Cart-to-Checkout Transition Rate ($R_{\text{Cart}\to\text{Chk}}$)**:
   $$R_{\text{Cart}\to\text{Chk}} = \left( \frac{\text{Count of Unique Sessions with } \texttt{checkout\_started}}{\text{Count of Unique Sessions with } \texttt{cart\_item\_added}} \right) \times 100\%$$

4. **Checkout Completion Rate ($R_{\text{ChkComplete}}$)**:
   $$R_{\text{ChkComplete}} = \left( \frac{\text{Count of Unique Sessions with } \texttt{order\_completed}}{\text{Count of Unique Sessions with } \texttt{checkout\_started}} \right) \times 100\%$$

5. **Stage Drop-Off Rate ($\Delta_{\text{Drop}}(S_i \to S_{i+1})$)**:
   $$\Delta_{\text{Drop}}(S_i \to S_{i+1}) = 100\% - \left( \frac{\text{Sessions reaching } S_{i+1}}{\text{Sessions reaching } S_i} \times 100\% \right)$$

---

## 4. Retention Policies & Right-to-be-Forgotten Procedures

### 4.1 Data Retention Schedule
- **Raw Event Telemetry (`analytics_events`)**: Retained for **90 days**. Scheduled CloudWatch event runs a monthly vacuum and truncation for events older than `NOW() - INTERVAL '90 days'`.
- **Hourly / Daily Aggregate Metrics**: Retained for **730 days (2 years)** for merchant comparative analytics and YoY sales reporting.
- **Consent Records (`consent_records`)**: Retained for **3 years** to demonstrate compliance with regulatory audit inquiries.

### 4.2 Right-to-be-Forgotten Execution
When a customer or visitor requests erasure under GDPR Article 17 or DPDP Section 12:

```typescript
// Procedure implemented in analytics service:
export async function executeRightToBeForgotten(
  tenantId: string,
  identifier: { visitorId?: string; customerId?: string }
): Promise<{ deletedEventsCount: number }> {
  // 1. Scrub analytics telemetry for the specified visitor
  const result = await db
    .delete(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.tenantId, tenantId),
        identifier.visitorId
          ? eq(analyticsEvents.visitorId, identifier.visitorId)
          : undefined
      )
    );

  // 2. Mark consent records as withdrawn
  if (identifier.visitorId) {
    await db
      .update(consentRecords)
      .set({ withdrawnAt: new Date(), categoriesGranted: [] })
      .where(
        and(
          eq(consentRecords.tenantId, tenantId),
          eq(consentRecords.visitorId, identifier.visitorId)
        )
      );
  }

  return { deletedEventsCount: result.rowCount ?? 0 };
}
```
