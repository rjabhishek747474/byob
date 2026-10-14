# LEARNINGS.md - Engineering Guidelines & Bug Prevention for Vibe-Coding

**Context:** Key architectural and debugging insights gathered during the Final QA & Polish pass of the BeYourOwnBoss multi-tenant platform.  
**Purpose:** Prevent common vibe-coding regressions and pitfalls in future development iterations.

---

## 1. Skill-to-Bug Traceability Matrix

| Superpowers Skill Applied | Bug Detected | Root Cause & Detection Method |
| :--- | :--- | :--- |
| **`systematic-debugging`** | **BUG-01: Raw SQL Array Binding in Checkout** | Tracing database query syntax in `checkout-service.ts` revealed that `${productIds}` in template strings binds as PostgreSQL array `$1 = text[]`, failing with `operator does not exist: text = text[]`. Fixed using Drizzle's `inArray()`. |
| **`diagnosing-superpowers`** | **BUG-02: Seed Password Hash Inconsistency** | Cross-referencing seed scripts with UI components revealed `seed.ts` hashed `Admin123!` while the login UI instructed users to use `AdminPassword123!`. Unified to `AdminPassword123!`. |
| **`systematic-debugging`** | **BUG-03: `NaN` Propagation in Pagination** | Boundary testing query parameters revealed that `Math.max(1, NaN)` returns `NaN`. When non-numeric values (`?page=abc`) were passed, `OFFSET NaN` was emitted, crashing the endpoint with a 500 error. Fixed using `Number.isFinite()`. |
| **`test-driven-development`** | **BUG-04: Coupon Calculation with Negative/NaN Subtotals** | Writing adversarial tests for coupon validation revealed that unvalidated subtotals could return `NaN` or negative discounts. Added `safeSubtotal = Number.isFinite(subtotal) ? Math.max(0, Math.floor(subtotal)) : 0;`. |
| **`using-superpowers`** | **BUG-05: Test Environment Missing Fallback** | Auditing Vitest stderr revealed missing `process.env.DATABASE_URL` in `tests/setup.ts`, emitting repeated warnings across 5 test suites. Added safe fallback. |
| **`brainstorming`** | **BUG-06: Defensive Component Props in TenantSwitcher** | Scanning component props revealed potential crash if `tenants` prop was rendered empty or null. Added `(tenants || [])` guards. |

---

## 2. Core Lessons for Future Vibe-Coding Sessions

### Rule 1: Never Interpolate JavaScript Arrays Directly in SQL Templates
- **Bad:** `sql\`${table.id} IN ${array}\``
- **Good:** `array.length > 0 ? inArray(table.id, array) : undefined`
- **Why:** PostgreSQL drivers treat array bindings as single typed array parameters rather than comma-separated lists. Always rely on ORM operators or `= ANY(${array})`.

### Rule 2: Beware of JavaScript's `NaN ?? defaultValue` Trap
- **The Trap:** `NaN ?? 1` evaluates to `NaN`, NOT `1`!
- **The Consequence:** `Math.max(1, NaN)` returns `NaN`. `(NaN - 1) * 20` produces `NaN`. In database queries, `LIMIT 20 OFFSET NaN` crashes the server.
- **The Pattern:**
  ```typescript
  const raw = Number(input);
  const clean = Number.isFinite(raw) && raw >= min ? Math.floor(raw) : defaultVal;
  ```

### Rule 3: Single Source of Truth for Credentials & Mocks
- Keep mock credentials, seed script passwords, and UI helper text synchronized via shared constants or synchronized definitions to avoid "credentials do not match documentation" errors.

### Rule 4: Money Math Must Strictly Defend Against Non-Finite Values
- Always floor or round minor units (`paise`, `cents`) using `Math.floor()` or `Math.round()`.
- Always clamp discounts to `Math.max(0, Math.min(discount, subtotal))` to ensure totals can never be negative.

### Rule 5: Keep Test Runner Logs Clean
- A noisy test runner with stderr warnings masks real runtime errors. If an ORM or client warns about missing environment variables during tests, provide safe mock defaults in `tests/setup.ts`.
