# ---------- Stage 1: Builder ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY prisma ./prisma/

# Install all deps (including devDeps for prisma CLI)
RUN npm ci

# Copy source
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build


# ---------- Stage 2: Runner ----------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Prisma needs openssl
RUN apk add --no-cache openssl

# Copy runtime artifacts
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Logs directory for Winston
RUN mkdir -p logs && chown -R node:node logs

USER node

# IMPORTANT:
# - prisma migrate deploy → uses DIRECT_URL
# - node dist/index.js → runtime uses DATABASE_URL
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
