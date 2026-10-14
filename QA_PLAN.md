# QA_PLAN.md - Final QA, Stability & Polish Plan

**Role:** Senior QA & Stability Engineer  
**Branch / Worktree:** `worktree/qa-polish` (`.worktrees/qa-polish`)  
**Target Milestone:** Production-Ready Hardening & Polish  
**Core Constraint:** ZERO feature changes. Existing functional logic, UI designs, and user flows are strictly protected. Only bugs, unhandled errors, safety checks, and test coverage are addressed.

---

## 1. Executive Summary & Objective

The **BeYourOwnBoss (BYOB)** platform is a multi-tenant e-commerce system built with Next.js 16, React 19, TypeScript, Tailwind CSS, PostgreSQL, and Drizzle ORM. The platform serves two distinct administrative levels:
1. **Platform Super Admin (`/tenants`):** Oversees all tenant stores, plans, ecosystem GMV, order volume, and platform revenue commissions.
2. **Tenant Store Owner (`/dashboard` & admin suite):** Manages an isolated online store catalog, inventory, visual drag-and-drop page builder, theme engine, orders, customers, and coupons.
3. **Storefront Shopper (`/(store)`):** Multi-tenant storefront with dynamic page rendering, cart, checkout, order placement, and public tracking.

This QA plan establishes the systematic verification protocol across all modules to ensure enterprise-grade stability, zero regressions, and robust error resilience.

---

## 2. Complete Inventory of System Modules

| Module ID | Directory Path | Core Responsibilities | Key Dependencies |
| :--- | :--- | :--- | :--- |
| **M1: Auth & Tenant Context** | `src/lib/auth`, `src/lib/middleware` | Session creation, JWT signing, multi-tenant resolution, RBAC permissions | `jose` / `jsonwebtoken`, `cookies`, `tenants` |
| **M2: Database & Core Libs** | `src/lib/db`, `src/lib/money`, `src/lib/errors`, `src/lib/utils`, `src/lib/api` | Drizzle connection pooling, minor-unit money math, error envelope, ULID, CSV escaping | `postgres`, `drizzle-orm`, `ulid` |
| **M3: Catalog & Inventory** | `src/modules/catalog`, `src/app/(admin)/products`, `src/app/(admin)/categories` | Product CRUD, multi-variant pricing, stock movements, pessimistic locking | `products`, `productVariants`, `inventoryMovements` |
| **M4: Cart, Checkout & Orders** | `src/modules/checkout`, `src/modules/orders`, `src/app/(admin)/orders`, `src/app/(store)/checkout` | Atomic checkout transaction, idempotency keys, state machine, PII-minimized tracking | `orders`, `orderItems`, `orderStatusHistory`, `carts` |
| **M5: Page Builder & Theme** | `src/modules/pages`, `src/modules/theme`, `src/modules/assets`, `src/app/(admin)/builder`, `src/app/(admin)/theme` | Drag-and-drop block rendering, JSON page schemas, CSS variable theming, asset upload | `@dnd-kit`, `pages`, `themeConfigurations`, `assets` |
| **M6: Marketing & Promotions** | `src/modules/promotions`, `src/modules/campaigns`, `src/app/(admin)/promotions`, `src/app/(admin)/banners` | Fixed/percentage coupons, usage limits, banner slots | `coupons`, `couponRedemptions`, `banners` |
| **M7: Customers & Audit** | `src/modules/customers`, `src/modules/audit`, `src/app/(admin)/customers` | Customer profiles, immutable audit logging with actor/action tracking | `customers`, `auditLogs` |
| **M8: Analytics & Telemetry** | `src/modules/analytics`, `src/modules/dashboard`, `src/app/(admin)/analytics` | Funnel drop-off calculation, Anti-PII event ingestion, verified revenue attribution | `analyticsEvents`, `consentRecords` |
| **M9: Super Admin Panel** | `src/app/(admin)/tenants` | Multi-store oversight, billing invoices, subscription fees, ecosystem GMV | `AdminContext`, `tenants` |
| **M10: Store Owner Dashboard** | `src/app/(admin)/dashboard` | Tenant KPI metrics, sales trends, recent orders, fulfillment status | `AdminContext`, `orders` |
| **M11: Storefront Shopper Experience** | `src/app/(store)` | Responsive home, product browsing, cart modal, atomic checkout, order confirmation | Store components, theme CSS variables |

---

## 3. STRICT PROTECTED FEATURES REGISTER

The following subsystems and user experiences are **FROZEN against functional or design changes**:

> **PROTECTED FEATURE 1: Authentication & Tenant Session Logic**
> - Files: `src/app/login/page.tsx`, `src/lib/auth/session.ts`, `src/lib/auth/context.ts`, `src/lib/auth/permissions.ts`
> - Rule: Do not alter the login credentials format, role hierarchy (`platform_admin`, `tenant_owner`, etc.), or session cookie signing mechanism.

> **PROTECTED FEATURE 2: Checkout & Payment Flow**
> - Files: `src/modules/checkout/checkout-service.ts`, `src/app/(store)/checkout/page.tsx`
> - Rule: Do not alter the order total computation (subtotal - discount + deliveryFee + tax), the idempotency guarantee, or the COD/Online mode selection.

> **PROTECTED FEATURE 3: Dashboard Analytics & Charts**
> - Files: `src/app/(admin)/dashboard/page.tsx`, `src/app/(admin)/tenants/page.tsx`
> - Rule: Do not modify the KPI metrics (GMV, Orders, Conversion Rate, Commission earnings), the tenant switcher, or the SVG/HTML charts and visualizations.

> **PROTECTED FEATURE 4: Drag-and-Drop Page Builder & Theme Customizer**
> - Files: `src/app/(admin)/builder/page.tsx`, `src/app/(admin)/theme/page.tsx`, `src/components/store/page-renderer.tsx`
> - Rule: Do not alter block components (`hero_banner`, `product_grid`, `featured_categories`, etc.) or theme color token definitions.

> **PROTECTED FEATURE 5: Public Storefront Navigation & UI**
> - Files: `src/app/(store)/page.tsx`, `src/app/(store)/[slug]/page.tsx`, `src/app/(store)/orders/[publicToken]/page.tsx`
> - Rule: Do not alter store layout, cart drawer, or order tracking UX.

---

## 4. Vulnerability & Risk Register

| Risk ID | Component | Failure Mode / Vulnerability | Severity | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **R-01** | `src/modules/checkout/checkout-service.ts` | Raw `sql\`${products.id} IN ${productIds}\`` instead of `inArray(products.id, productIds)` can fail if array formatting differs across driver versions | High | Use Drizzle's native `inArray(products.id, productIds)` and `inArray(productImages.productId, productIds)` with empty array guard. |
| **R-02** | `tests/setup.ts` | Missing default `process.env.DATABASE_URL` emits noisy stderr warning during test execution | Low | Provide default fallback in `tests/setup.ts` to ensure clean, noise-free test runs. |
| **R-03** | `src/modules/orders/order-service.ts` | Potential division by zero in CSV export or order list if pagination parameters receive invalid numbers | Medium | Reinforce `Math.max(1, page)` and `Math.max(1, pageSize)` boundaries and finite number checks. |
| **R-04** | `src/modules/analytics/analytics-service.ts` | Division by zero when `orderCount === 0` in AOV or when `totalStartSessions === 0` in funnel metrics | Medium | Verify that all percentage and AOV calculations safely return `0` when denominators are zero. |
| **R-05** | `src/lib/utils/index.ts` | CSV injection vector if formula characters (`=`, `+`, `-`, `@`) are unescaped in customer or order exports | High | Maintain strict formula injection sanitization via `csvEscape` across all export endpoints. |
| **R-06** | `src/lib/api/response.ts` | Response header manipulation on immutable/frozen responses | Medium | Ensure headers are safely cloned before setting `x-correlation-id`. |

---

## 5. Testing & Verification Protocol

### Phase 1: Clean Baseline Verification
- [x] Create isolated git worktree: `git worktree add .worktrees/qa-polish -b worktree/qa-polish`
- [x] Run `pnpm install` in worktree
- [x] Run baseline tests: `pnpm test` (161 tests, 10 files passing)
- [x] Run typecheck: `pnpm typecheck` (0 errors)

### Phase 2: Systematic Codebase Diagnosis & Bug Report
- Inspect each module for:
  - Error boundaries & unhandled rejections
  - Null/undefined checks on optional parameters
  - Edge cases in calculations & database queries
  - Security headers & sanitization
- Generate `BUG_REPORT.md` documenting every finding with severity and suggested fix.

### Phase 3: Subagent & TDD Implementation
- Fix bugs in segregated domains (Frontend, Backend, Security/Performance).
- Apply Test-Driven Development (TDD):
  1. Write failing test for edge case / bug.
  2. Implement minimal non-breaking fix.
  3. Verify test passes.
  4. Ensure all 161 existing tests remain 100% green.

### Phase 4: Final Verification Before Completion
- Run `pnpm test` (all tests passing).
- Run `pnpm typecheck` (0 errors).
- Run `pnpm build` (all 52 routes compile successfully).
- Verify protected features in browser or via automated smoke check.

### Phase 5: Review & Artifacts
- Generate `CODE_REVIEW.md` documenting all changes and no-feature-change guarantees.
- Generate `LEARNINGS.md` with operational insights.
