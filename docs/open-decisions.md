# Architecture Decision Records & External Owner Dependencies

## 1. Overview

This document records architectural decisions and pending external business, legal, and operational dependencies that require product owner or executive sign-off prior to production go-live.

---

## 2. External Owner Dependencies Matrix

| Item # | Decision Domain | Current State / Default | Required External Owner Action | Impact if Delayed | Target Date |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **OD-01** | **AWS Account & Production Region** | Configured with `us-east-1` defaults. Local dev testing on mocks / dev account. | Product/FinOps Owner must designate dedicated AWS Production Account ID and primary operating region (e.g., `us-east-1` vs `ap-south-1` vs `eu-west-1`). | Blocks automated CI/CD pipeline deployment to live infrastructure. | 2026-10-20 |
| **OD-02** | **Production Domain & DNS Ownership** | Default placeholder `byoboss.io` registered in Terraform variables. | Owner must purchase root domain name and delegate Route 53 nameserver authority to the production AWS account. | Wildcard SSL certificates (`*.domain`) cannot complete DNS validation. | 2026-10-22 |
| **OD-03** | **Payment Gateway Merchant Accounts** | Architecture designed for Stripe Connect / Razorpay with integer-cents ledger. | Finance/Legal must finalize commercial agreements and provide production API keys and webhook signing secrets. | Storefront checkouts remain in simulated / test-mode. | 2026-10-25 |
| **OD-04** | **Transactional Email & SMS Gateway** | Cognito default email quota and mock notification service. | Operations must configure Amazon SES dedicated domain or SendGrid / Twilio accounts for transactional receipts and SMS OTP. | Email deliverability may be throttled to 200 emails/day sandbox limit. | 2026-10-28 |
| **OD-05** | **Legal Review & Privacy Terms** | DPDP (India) and GDPR (EU) consent schema implemented in database. | Legal counsel must review Storefront Terms of Service, Privacy Policy, Merchant Agreements, and Data Processing Addendum (DPA). | Compliance exposure for active EU/Indian consumer tracking. | 2026-11-01 |

---

## 3. Architecture Decision Records (ADRs)

### ADR-001: Integer Minor Units for Monetary Values
- **Status**: Accepted
- **Context**: Floating-point numbers introduce IEEE-754 precision errors during multi-item tax, discount, and currency conversions.
- **Decision**: All prices, subtotals, tax amounts, shipping fees, and discounts are strictly stored and computed as integer minor units (`priceCents: integer`). Formatting to currency strings occurs only at the view presentation layer.
- **Consequences**: Zero floating-point rounding discrepancies; 100% reliable audit reconciliation.

### ADR-002: Modular Monolith vs Microservices
- **Status**: Accepted
- **Context**: Early-to-growth SaaS requires rapid iteration, single-binary atomic deployments, and low operational overhead while maintaining clear domain boundaries.
- **Decision**: Build as a modular monolith in Next.js App Router with separated domain modules (Tenant, Store, Catalog, Orders, Analytics, Assets) backed by PostgreSQL 16.
- **Consequences**: Faster development velocity, straightforward transactions, zero distributed network overhead between modules; clear path to decompose into microservices if needed at > 500k DAU.

### ADR-003: ULID for External Identifiers
- **Status**: Accepted
- **Context**: Auto-incrementing integer IDs leak commercial volume (e.g. order numbers) and are vulnerable to enumeration attacks. Standard UUIDv4 lacks time-based sorting.
- **Decision**: Use Universally Unique Lexicographically Sortable Identifiers (ULID) for all external entity IDs (`01J9X8...`).
- **Consequences**: High-entropy, URL-safe identifiers that remain naturally ordered by creation timestamp without index fragmentation.
