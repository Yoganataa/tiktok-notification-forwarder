# Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json ./
RUN npm ci && \
    npm cache clean --force

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install runtime dependencies
RUN apk add --no-cache openssl dumb-init

# Create non-root user
RUN addgroup -g 10001 appgroup && \
    adduser -D -u 10001 -G appgroup appuser

# Copy built application
COPY --from=builder --chown=appuser:appgroup /app/package.json ./
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/src/core/database/migrations ./dist/core/database/migrations

# Buat folder logs secara eksplisit dan berikan izin ke appuser
RUN mkdir -p logs && \
    chown -R appuser:appgroup logs

# Switch to non-root user
USER appuser

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]