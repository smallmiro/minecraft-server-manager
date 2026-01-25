# ============================================================
# mcctl-api Dockerfile
# Multi-stage build for production-ready container
# ============================================================

# Build stage
FROM node:20-alpine AS builder

# Install build dependencies for native modules (bcrypt)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable pnpm

# Copy workspace configuration files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy shared package (dependency)
COPY platform/services/shared ./platform/services/shared

# Copy mcctl-api package
COPY platform/services/mcctl-api ./platform/services/mcctl-api

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared package first (dependency)
RUN pnpm --filter @minecraft-docker/shared build

# Build mcctl-api
RUN pnpm --filter @minecraft-docker/mcctl-api build

# Prune development dependencies
RUN pnpm --filter @minecraft-docker/mcctl-api --prod deploy /app/production

# ============================================================
# Production stage
# ============================================================
FROM node:20-alpine AS runner

# Install runtime dependencies for health check
RUN apk add --no-cache wget

WORKDIR /app

# Set environment
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs mcctl

# Copy built artifacts from builder
COPY --from=builder --chown=mcctl:nodejs /app/production/dist ./dist
COPY --from=builder --chown=mcctl:nodejs /app/production/node_modules ./node_modules
COPY --from=builder --chown=mcctl:nodejs /app/production/package.json ./package.json

# Copy shared package dist (required for workspace dependency)
COPY --from=builder --chown=mcctl:nodejs /app/platform/services/shared/dist ./node_modules/@minecraft-docker/shared/dist
COPY --from=builder --chown=mcctl:nodejs /app/platform/services/shared/package.json ./node_modules/@minecraft-docker/shared/package.json

# Create data directory for MCCTL_ROOT
RUN mkdir -p /data && chown mcctl:nodejs /data

# Health check configuration
# - interval: Check every 30 seconds
# - timeout: Fail if no response within 3 seconds
# - start-period: Allow 5 seconds for startup
# - retries: Mark unhealthy after 3 consecutive failures
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Expose API port
EXPOSE 3001

# Switch to non-root user
USER mcctl

# Default environment variables
ENV MCCTL_ROOT=/data
ENV LOG_LEVEL=info

# Start the application
CMD ["node", "dist/index.js"]
