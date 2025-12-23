# Dockerfile
# Multi-stage build for stable production deployment

# =========================
# Stage 1: Builder
# =========================
FROM node:20-slim AS builder

WORKDIR /app

# Install build tools for native dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# =========================
# Stage 2: Runner
# =========================
FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production

# Runtime dependencies
RUN apt-get update && apt-get install -y \
    dumb-init \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -m appuser

# Copy built artifacts
COPY --from=builder --chown=appuser:appgroup /app/package.json ./
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/src/core/database/migrations ./dist/core/database/migrations

# Logs directory
RUN mkdir -p logs && chown -R appuser:appgroup logs

USER appuser

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
