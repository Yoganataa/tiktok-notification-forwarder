# ---------- Stage 1: Builder ----------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build


# ---------- Stage 2: Runner ----------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Prisma needs openssl
RUN apk add --no-cache openssl

# Create non-root user with UID 10001 (Choreo-compliant)
RUN addgroup -g 10001 appgroup \
 && adduser -D -u 10001 -G appgroup appuser

# Copy runtime artifacts
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Logs directory for Winston
RUN mkdir -p logs \
 && chown -R appuser:appgroup /app

# Switch to Choreo-compliant user
USER 10001

# Run migrations then start app
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
