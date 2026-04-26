# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY scripts ./scripts
COPY mail-templates ./mail-templates
COPY src ./src
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nest -u 1001 -G nodejs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/mail-templates/dist ./mail-templates/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

# CLI для migrate deploy (после prune удалён из devDependencies)
RUN npm install prisma@7.7.0 --no-save --omit=optional

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && chown -R nest:nodejs /app

USER nest
EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
