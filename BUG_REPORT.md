# BUG_REPORT.md - Deep Codebase Diagnosis & Quality Audit

**Audit Date:** 15 October 2026  
**Auditor:** Senior QA & Stability Engineer  
**Worktree:** `worktree/qa-polish`  
**Constraint Enforced:** No functional feature changes. Only stability, bug, security, and test fixes.

---

## Summary of Findings

| Bug ID | Component / File | Line(s) | Severity | Category | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | `src/modules/checkout/checkout-service.ts` | 194, 211 | **High** | Database / SQL | Ready for Fix |
| **BUG-02** | `src/lib/db/seed.ts` | 29 | **Medium** | Auth / Consistency | Ready for Fix |
| **BUG-03** | `src/modules/orders/order-service.ts`<br>`src/modules/catalog/product-service.ts`<br>`src/modules/customers/customer-service.ts` | 243-245<br>385-387<br>86-88 | **Medium** | Backend / Pagination | Ready for Fix |
| **BUG-04** | `src/modules/promotions/coupon-service.ts` | 192-297 | **Medium** | Backend / Math | Ready for Fix |
| **BUG-05** | `tests/setup.ts` | 4-9 | **Low** | DX / Test Harness | Ready for Fix |
| **BUG-06** | `src/components/admin/tenant-switcher.tsx` | 50-96 | **Low** | Frontend / UI Safety | Ready for Fix |

---

## Detailed Bug Reports

### BUG-01: Array Binding in Raw SQL Fragment inside Checkout Service
- **File:** `src/modules/checkout/checkout-service.ts`
- **Line:** 194 and 211
- **Severity:** High
- **Category:** Backend / Database / Query Execution
- **Issue Description:**
  In `processCheckout()`, the service executes:
  ```typescript
  // Line 194
  sql`${products.id} IN ${productIds}`
  // Line 211
  sql`${productImages.productId} IN ${productIds}`
  ```
  In PostgreSQL via `postgres.js`, passing a JavaScript array directly into a tagged template literal binds it as a single array parameter `$1` (e.g. `$1 = ARRAY['id1', 'id2']`). Evaluating `products.id IN ($1)` causes a PostgreSQL runtime error: `operator does not exist: text = text[]`.
- **Fix Suggestion:**
  Import `inArray` from `'drizzle-orm'`. Guard against empty arrays and use:
  ```typescript
  productIds.length > 0 ? inArray(products.id, productIds) : undefined
  ```
  and
  ```typescript
  productIds.length > 0 ? inArray(productImages.productId, productIds) : undefined
  ```

---

### BUG-02: Seed Password Hash Mismatch with UI Demo Credentials
- **File:** `src/lib/db/seed.ts`
- **Line:** 29
- **Severity:** Medium
- **Category:** Auth / Environment Consistency
- **Issue Description:**
  `src/lib/db/seed.ts` hashes `'Admin123!'` for default tenant and platform users. However, `src/app/api/v1/auth/login/route.ts` (line 50) and the user-facing login form at `src/app/login/page.tsx` (line 184) instruct the user:
  `Default demo credentials: admin@byob.store / AdminPassword123!`
  When the database is populated via `pnpm seed`, entering the advertised credentials results in a failed login.
- **Fix Suggestion:**
  Update `seed.ts` line 29:
  ```typescript
  const defaultPasswordHash = bcrypt.hashSync('AdminPassword123!', 10);
  ```
  so that seeded accounts match demo mock accounts and UI documentation.

---

### BUG-03: `NaN` Propagation in Pagination Offset Calculation
- **File:**
  1. `src/modules/orders/order-service.ts` (lines 243-245)
  2. `src/modules/catalog/product-service.ts` (lines 385-387)
  3. `src/modules/customers/customer-service.ts` (lines 86-88)
- **Severity:** Medium
- **Category:** Backend / API Edge Case / Resilience
- **Issue Description:**
  The current pagination logic uses:
  ```typescript
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  ```
  If an API caller passes a non-numeric string (e.g. `?page=abc` or `?pageSize=null`), `options.page` converts to `NaN`. Because `Math.max(1, NaN)` evaluates to `NaN`, `offset` evaluates to `NaN`, causing Drizzle ORM to generate `OFFSET NaN`, which throws an unhandled database exception (500 Internal Server Error).
- **Fix Suggestion:**
  Validate with `Number.isFinite()` and positive integers before computing offset:
  ```typescript
  const rawPage = Number(options.page);
  const rawPageSize = Number(options.pageSize);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize >= 1 ? Math.min(100, Math.floor(rawPageSize)) : 20;
  const offset = (page - 1) * pageSize;
  ```

---

### BUG-04: Non-Finite / Negative Subtotal Handling in Coupon Validation
- **File:** `src/modules/promotions/coupon-service.ts`
- **Line:** 192-297
- **Severity:** Medium
- **Category:** Backend / Financial Calculations
- **Issue Description:**
  In `validateCoupon()`, `subtotal` defaults to `0` but is not validated against negative numbers or `NaN`. In percentage and fixed discount calculations:
  ```typescript
  discountAmount = Math.round((subtotal * coupon.discountValue) / 100);
  discountAmount = Math.min(discountAmount, subtotal);
  ```
  If `subtotal` is `NaN`, `discountAmount` produces `NaN`. If `subtotal` is negative, `discountAmount` can produce negative values, which violates minor-unit currency invariants.
- **Fix Suggestion:**
  Add input sanitization at the beginning of `validateCoupon`:
  ```typescript
  const safeSubtotal = typeof subtotal === 'number' && Number.isFinite(subtotal) ? Math.max(0, Math.floor(subtotal)) : 0;
  ```
  and compute discounts using `safeSubtotal`.

---

### BUG-05: Missing Default `DATABASE_URL` in Vitest Test Environment
- **File:** `tests/setup.ts`
- **Line:** 4-9
- **Severity:** Low
- **Category:** Test Suite / Developer Experience
- **Issue Description:**
  `src/lib/db/index.ts` logs `console.warn('DATABASE_URL environment variable is not defined.')` if `process.env.DATABASE_URL` is empty. Because `tests/setup.ts` does not assign a default placeholder, Vitest prints 5-6 stderr warnings during every test run.
- **Fix Suggestion:**
  Add fallback in `tests/setup.ts`:
  ```typescript
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/byob_test';
  ```

---

### BUG-06: Potential Null Pointer on Empty Tenants Array in TenantSwitcher
- **File:** `src/components/admin/tenant-switcher.tsx`
- **Line:** 50, 58, 96
- **Severity:** Low
- **Category:** Frontend / Defensive UI Rendering
- **Issue Description:**
  If `tenants` prop is passed as an empty array or undefined in an edge context, `tenants.find()` or `tenants.map()` without fallback could lead to unexpected UI behavior or blank headers.
- **Fix Suggestion:**
  Ensure `(tenants || [])` fallback is applied consistently.
