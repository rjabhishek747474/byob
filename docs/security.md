# Security Architecture & OWASP ASVS 5.0.0 Compliance

## 1. Threat Modeling Overview

The BeYourOwnBoss platform serves multiple independent e-commerce businesses on shared cloud infrastructure. The primary threat vectors analyzed in our threat model (STRIDE framework) include:

| STRIDE Category | Threat Description | Architectural Mitigation |
| :--- | :--- | :--- |
| **Spoofing** | Adversary attempts to impersonate tenant admin or another store | Cognito MFA required in production; cryptographically signed session tokens; Argon2id password hashing; rejection of client-supplied tenant IDs. |
| **Tampering** | Modification of prices, order totals, or tenant database records | Integer-minor-unit server-side calculations; Drizzle ORM parameterized queries; immutable audit log stream. |
| **Repudiation** | Tenant claiming an order status or configuration was modified without authorization | Structured audit logging with tenant ID, actor user ID, correlation ID, IP address, and old/new delta state. |
| **Information Disclosure** | Cross-tenant data leakage or exposed S3 storage assets | Strict query-level tenant filtering; private S3 buckets with Origin Access Control (OAC); KMS encryption for data-at-rest. |
| **Denial of Service** | Volumetric HTTP floods or authentication brute-force attacks | AWS WAFv2 Managed Common Rule Set; IP rate limiting (2000 req/5m); Auth endpoint throttling (50 req/5m); Next.js in-memory edge rate limiter. |
| **Elevation of Privilege** | Store staff elevating privileges to store owner or platform admin | Role-Based Access Control (RBAC) checked before domain service execution; hard separation of platform admin vs tenant admin routes. |

---

## 2. OWASP ASVS 5.0.0 Compliance Mapping

The Application Security Verification Standard (ASVS) 5.0.0 defines levels of security verification. The table below details our implementation status across core security domains:

### V2: Authentication Verification Standard
| ASVS Requirement | Platform Implementation Status | Control Details |
| :--- | :--- | :--- |
| **2.1.1** Minimum password length (12+ characters) | **IMPLEMENTED** | Enforced via Cognito User Pool policy (`minimum_length = 12`, uppercase, lowercase, numbers, symbols). |
| **2.1.2** Password complexity checks | **IMPLEMENTED** | Zod schema validation on signup/reset + Cognito password policy enforcement. |
| **2.1.7** Credential stuffing & brute-force defense | **IMPLEMENTED** | AWS WAF rate limit (50 req/5m on `/api/v1/auth/*`) + Edge middleware rate limiter + Cognito advanced security. |
| **2.8.1** Multi-Factor Authentication (MFA) | **IMPLEMENTED** | TOTP software tokens configured in Cognito (`mfa_configuration = "REQUIRED"` in production). |

### V4: Access Control Verification Standard
| ASVS Requirement | Platform Implementation Status | Control Details |
| :--- | :--- | :--- |
| **4.1.1** Principle of least privilege for roles | **IMPLEMENTED** | Granular RBAC matrix (Owner, Manager, Staff, Analyst) enforced via permission checks. |
| **4.1.2** Server-side authorization enforcement | **IMPLEMENTED** | All administrative endpoints verify JWT claims and tenant ownership on the server side prior to query execution. |
| **4.1.3** Tenant isolation (Multi-tenancy defense) | **IMPLEMENTED** | Every Drizzle query includes mandatory `eq(table.tenantId, tenantId)` predicates. Client-provided tenant IDs are never trusted. |

### V5: Validation, Sanitization, and Encoding Standard
| ASVS Requirement | Platform Implementation Status | Control Details |
| :--- | :--- | :--- |
| **5.1.1** Structured input validation | **IMPLEMENTED** | Strict Zod validation schemas for 100% of incoming request payloads, URL query parameters, and headers. |
| **5.3.1** SQL Injection prevention | **IMPLEMENTED** | Zero raw dynamic SQL string interpolation; Drizzle ORM provides parameter binding; AWS WAF CRS blocks SQLi payloads at edge. |
| **5.3.3** Cross-Site Scripting (XSS) defense | **IMPLEMENTED** | React automatic JSX escaping; strict Content Security Policy headers; WAF CRS inspection. |

### V6: Stored Cryptography Verification Standard
| ASVS Requirement | Platform Implementation Status | Control Details |
| :--- | :--- | :--- |
| **6.2.1** Cryptographic algorithm standards | **IMPLEMENTED** | AES-256 via AWS KMS for data-at-rest; TLS 1.3 enforced for data-in-transit. |
| **6.4.1** Secret management and isolation | **IMPLEMENTED** | Zero secrets in source code, Docker images, or Git; secrets injected from AWS Secrets Manager at task startup. |

### V8: Data Protection Verification Standard
| ASVS Requirement | Platform Implementation Status | Control Details |
| :--- | :--- | :--- |
| **8.1.1** Data isolation and compartmentalization | **IMPLEMENTED** | Private subnets for application and database tiers; S3 buckets block all public ACLs and public policies. |
| **8.2.1** Data at rest encryption | **IMPLEMENTED** | Amazon RDS PostgreSQL gp3 encrypted with KMS; S3 buckets encrypted with KMS Customer Managed Keys. |
| **8.3.1** Data in transit encryption | **IMPLEMENTED** | ALB enforces HTTPS redirect (HTTP 301 to 443); TLS 1.3 cipher suites enforced; PostgreSQL parameter `rds.force_ssl = 1`. |

---

## 3. Defense-in-Depth Control Matrix

```
       [ Public Internet ]
               │
               ▼
   [ AWS WAFv2 Web ACL ]       <-- Layer 1: DDoS & Exploitation Filter (OWASP CRS, Rate Limits)
               │
               ▼
   [ Application Load Balancer ]<-- Layer 2: TLS 1.3 Termination, Port 80->443 Redirect
               │
               ▼
   [ Next.js Edge Middleware ]  <-- Layer 3: Correlation ID, Subdomain Resolution, In-Memory Rate Limit
               │
               ▼
   [ App Router & RBAC Layer ]  <-- Layer 4: Session Verification, Role Permissions Check
               │
               ▼
   [ Domain Services & Zod ]   <-- Layer 5: Strict Payload Validation, Integer Currency Rules
               │
               ▼
   [ Drizzle ORM Repositories ] <-- Layer 6: Mandatory Tenant-Scoped WHERE Clauses & Parameter Binding
               │
               ▼
   [ PostgreSQL RLS & Schema ]  <-- Layer 7: Row-Level Security, Encrypted Storage, Private Subnet
```

---

## 4. Implemented Controls vs. External Infrastructure Dependencies

| Control Domain | Implemented in Codebase / Terraform | Delegated to External Infrastructure / Provider |
| :--- | :--- | :--- |
| **Tenant Isolation** | Verified in middleware, schemas, repositories, and unit tests. | RDS DB subnet isolation in private VPC subnets. |
| **Secrets & Keys** | Automated via `terraform/modules/secrets/main.tf` using KMS. | Key rotation lifecycle handled by AWS KMS. |
| **Payment PCI-DSS** | Zero raw credit card storage; integer minor units only. | PCI-DSS Level 1 certified gateway (e.g., Stripe Elements). |
| **DDoS Protection** | WAFv2 rate limiting rules and application middleware limiters. | AWS Shield Standard (automatic on Route 53 / CloudFront). |
| **Identity & MFA** | Cognito user pool configuration in `terraform/modules/auth/`. | SMS OTP / TOTP authenticator push managed by Cognito. |
