# BeYourOwnBoss (BYOB) – Multi-Tenant E-Commerce SaaS Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.x-black.svg)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Terraform](https://img.shields.io/badge/Terraform-1.5+-purple.svg)](https://www.terraform.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-38B2AC.svg)](https://tailwindcss.com/)

A modern, high-concurrency multi-tenant e-commerce platform and website builder SaaS. Designed as a tenant-aware modular monolith featuring drag-and-drop store building, transactional order fulfillment, integer-minor-unit monetary calculations, strict multi-tenant database isolation, edge routing, and automated production AWS Terraform infrastructure.

---

## 🌟 Feature Inventory

- **Multi-Tenancy Isolation**:
  - Edge middleware tenant resolution (`x-tenant-slug`) from subdomains and custom domains.
  - Zero trust for client-provided tenant IDs. Every query is tenant-scoped with Drizzle ORM and Row-Level Security (RLS).
  - Isolated database schemas with composite indexes keyed on `tenant_id`.
- **E-Commerce & Commerce Engine**:
  - Full product catalog management (variants, inventory tracking, categories, rich media).
  - Transactional order processing with row locking (`FOR UPDATE`) to prevent overselling.
  - Money represented exclusively in integer minor units (`priceCents`) to eliminate IEEE-754 floating-point errors.
- **Storefront Website Builder**:
  - Visual drag-and-drop page editor with instant live preview.
  - Versioned page publishing (`published`, `draft`, `superseded`) with rollback capabilities.
- **Enterprise Security & Compliance**:
  - OWASP ASVS 5.0.0 aligned security architecture.
  - AWS WAFv2 with Managed Common Rule Set, 2000 req/5m IP rate limits, and 50 req/5m authentication throttling.
  - Amazon Cognito User Pool with mandatory MFA in production and strict password policies.
  - Correlation ID propagation (`x-correlation-id`) and comprehensive audit logging.
- **Telemetry & Funnel Analytics**:
  - 21-event analytics taxonomy tracking full conversion funnels (views $\to$ cart $\to$ checkout $\to$ orders).
  - DPDP & GDPR compliant privacy engine with affirmative cookie consent management and right-to-be-forgotten erasure.
- **Cloud-Native AWS Infrastructure (Terraform)**:
  - Multi-AZ VPC across 2 Availability Zones with public, private app, and private DB subnets.
  - ECS Fargate compute with container autoscaling (CPU & Memory at 70%).
  - Multi-AZ Amazon RDS PostgreSQL 16 with storage autoscaling (20GB - 100GB gp3) and KMS encryption.
  - CloudFront CDN with Origin Access Control (OAC) serving KMS-encrypted private S3 media assets.
  - Full CloudWatch alerting (5XX rates, CPU, memory, DB storage & connections) and unified observability dashboard.

---

## 🏗️ Project Structure

```text
beyourownboss/
├── .github/                 # CI/CD Workflows
├── database/migrations/     # Drizzle SQL migration files
├── docs/                    # Complete Engineering Documentation Suite
│   ├── api.md               # Complete REST API reference & RBAC matrix
│   ├── analytics.md         # Event taxonomy (21 events), funnels, & privacy framework
│   ├── architecture.md      # Modular monolith design, topology & multi-tenancy model
│   ├── deploy-aws.md        # AWS Terraform & CI/CD deployment guide
│   ├── open-decisions.md    # External owner dependencies & ADR records
│   ├── runbook.md           # Operational playbooks & incident response protocols
│   └── security.md          # Threat model & OWASP ASVS 5.0.0 compliance mapping
├── src/
│   ├── app/                 # Next.js App Router (Storefront, Admin, API routes)
│   ├── components/          # Reusable UI components & Admin shell
│   ├── config/              # Environment & application configuration
│   ├── lib/                 # Core utilities (auth, db, money, errors, logging, middleware)
│   ├── modules/             # Domain modules (tenant, catalog, orders, assets, theme, audit)
│   └── middleware.ts        # Next.js Edge middleware (tenant resolution & rate limiting)
├── terraform/               # Production Infrastructure as Code
│   ├── environments/        # Environment definitions
│   │   ├── dev/             # Development configuration & variables
│   │   └── prod/            # Production Multi-AZ configuration & strict alarms
│   ├── modules/             # Reusable infrastructure modules
│   │   ├── alb/             # Application Load Balancer (HTTP->HTTPS, Target Group)
│   │   ├── auth/            # Amazon Cognito User Pool & App Client
│   │   ├── compute/         # ECS Cluster, Fargate Service, IAM roles, Autoscaling
│   │   ├── database/        # Amazon RDS PostgreSQL 16 Multi-AZ & DB Subnet Group
│   │   ├── monitoring/      # CloudWatch metric alarms & unified dashboard
│   │   ├── networking/      # VPC, Dual-AZ Subnets, NAT GW, Security Groups
│   │   ├── secrets/         # AWS KMS CMK & AWS Secrets Manager secrets
│   │   ├── storage/         # Private S3 Bucket, CloudFront CDN with OAC, CORS
│   │   └── waf/             # AWS WAFv2 Web ACL (CRS, General & Auth Rate Limits)
│   └── variables.tf         # Root Terraform variables
├── tests/                   # Vitest & Playwright test suites
├── Dockerfile               # Multi-stage production container image
├── docker-compose.yml       # Local development dependencies (PostgreSQL 16)
└── drizzle.config.ts        # Drizzle ORM configuration
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- [Node.js](https://nodejs.org/) `>= 22.0.0`
- [pnpm](https://pnpm.io/) `>= 9.0.0`
- [Docker](https://www.docker.com/) & Docker Compose

### 2. Environment Setup
Clone the repository and copy the example environment file:
```bash
cp .env.example .env
```

### 3. Start Local Database with Docker Compose
Start local PostgreSQL 16:
```bash
docker compose up -d postgres
```

### 4. Install Dependencies & Run Database Migrations
```bash
pnpm install
pnpm db:migrate
pnpm db:seed
```

### 5. Launch the Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) for the storefront or [http://localhost:3000/admin](http://localhost:3000/admin) for the administrative console.

---

## 🧪 Testing Commands

Execute unit, integration, and UI component tests:
```bash
# Run unit & integration test suites
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run linter
pnpm lint

# Build standalone production bundle
pnpm build
```

---

## 🐳 Docker Production Build

Build the production multi-stage Docker container locally:
```bash
docker build -t beyourownboss:local -f Dockerfile .
docker run -p 3000:3000 --env-file .env beyourownboss:local
```

---

## ☁️ Terraform Infrastructure Deployment

Verify and plan production cloud infrastructure:
```bash
cd terraform/environments/prod
terraform init
terraform plan
```
For complete deployment instructions, see [docs/deploy-aws.md](docs/deploy-aws.md).

---

## 📚 Complete Documentation Links

- [Architecture Overview](docs/architecture.md)
- [API Reference & RBAC Matrix](docs/api.md)
- [Security Architecture & OWASP ASVS](docs/security.md)
- [Analytics Engine, Taxonomy & Privacy](docs/analytics.md)
- [AWS Deployment Guide](docs/deploy-aws.md)
- [Operational Runbooks & Incident Response](docs/runbook.md)
- [Architecture Decision Records & Open Decisions](docs/open-decisions.md)


---

## 📄 License
Private & Confidential. All rights reserved.
