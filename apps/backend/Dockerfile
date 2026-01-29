# ============================================================================
# CHATVISTA - Backend Dockerfile
# Multi-stage build for production
# ============================================================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++ linux-headers

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY turbo.json ./

# Copy packages
COPY packages ./packages
COPY apps/backend ./apps/backend

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN cd apps/backend && npx prisma generate

# Build
RUN pnpm run build --filter=@chatvista/backend

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install production dependencies
RUN apk add --no-cache ffmpeg

# Copy built files
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

# Create storage directories for local backup
RUN mkdir -p /app/storage/recordings \
             /app/storage/transcripts \
             /app/storage/minutes \
             /app/storage/exports \
             /app/storage/avatars \
             /app/storage/backup/daily \
             /app/storage/backup/weekly \
             /app/storage/backup/monthly \
             /app/storage/archive \
             /app/storage/temp

# Set environment
ENV NODE_ENV=production
ENV PORT=4000
ENV CHATVISTA_STORAGE_PATH=/app/storage

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Start command
CMD ["node", "dist/index.js"]
