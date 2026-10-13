# ─────────────────────────────────────────────────────────────────────
# BeYourOwnBoss – Production multi-stage Dockerfile
#
# Assumptions:
#   • next.config.ts has `output: 'standalone'`
#   • pnpm is the package manager (pnpm-lock.yaml committed)
#   • A /api/health endpoint exists for the container health check
# ─────────────────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ────────────────────────────────────
FROM node:22-alpine AS deps

# Install pnpm via corepack (ships with Node 22)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy only the files needed to resolve + install deps (maximises layer cache)
COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prefer-offline

# ── Stage 2: Build the application ──────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js anonymous telemetry during the build
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ── Stage 3: Production runner ──────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install curl for the health-check probe
RUN apk add --no-cache curl

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy the standalone build output (requires `output: 'standalone'` in next.config)
COPY --from=builder /app/public              ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
