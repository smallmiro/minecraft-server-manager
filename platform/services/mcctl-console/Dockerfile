# Multi-stage Dockerfile for mcctl-console (Next.js)
# Optimized for minimal image size with standalone output

# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable pnpm

# Copy workspace files needed for pnpm install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY platform/services/mcctl-console ./platform/services/mcctl-console

# Install dependencies and build
# Combined to leverage Docker layer caching
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm install --frozen-lockfile && \
    pnpm --filter @minecraft-docker/mcctl-console build

# =============================================================================
# Stage 2: Production Runner (Minimal)
# =============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    # Remove unnecessary packages to reduce image size
    apk --no-cache add wget && \
    rm -rf /var/cache/apk/*

# Copy standalone build output
# The standalone output includes a minimal Node.js server
COPY --from=builder --chown=nextjs:nodejs /app/platform/services/mcctl-console/.next/standalone ./

# Copy static files (not included in standalone)
COPY --from=builder --chown=nextjs:nodejs /app/platform/services/mcctl-console/.next/static ./platform/services/mcctl-console/.next/static

# Copy public files
COPY --from=builder --chown=nextjs:nodejs /app/platform/services/mcctl-console/public ./platform/services/mcctl-console/public

# Switch to non-root user
USER nextjs

# Expose the application port
EXPOSE 3000

# Health check for container orchestration
# Using wget since curl is not available in alpine by default
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the server
CMD ["node", "platform/services/mcctl-console/server.js"]
