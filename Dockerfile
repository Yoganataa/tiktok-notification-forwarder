# Dockerfile
# ---------- Stage 1: Builder ----------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY . .

RUN npm run build


# ---------- Stage 2: Runner ----------
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

# Create non-root user
RUN addgroup -g 10001 appgroup \
 && adduser -D -u 10001 -G appgroup appuser

# Copy runtime artifacts only
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

RUN chown -R appuser:appgroup /app

USER appuser

# Prisma generate dijalankan SAAT RUNTIME (env sudah ada)
CMD ["sh", "-c", "npx prisma generate && node dist/index.js"]
