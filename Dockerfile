# ---------- Stage 1: Builder ----------
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

COPY . .
RUN npm run build


# ---------- Stage 2: Runner ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

# Choreo-compliant user
RUN addgroup -g 10001 appgroup \
 && adduser -D -u 10001 -G appgroup appuser

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p logs && chown -R appuser:appgroup /app
USER 10001

# 🔴 Prisma dijalankan DI RUNTIME
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && node dist/index.js"]
