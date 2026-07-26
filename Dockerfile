# Multi-stage build for the Next.js app (standalone output).
FROM node:22-alpine AS deps
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY app/ .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
# Named timezones (TZ env) need the zoneinfo database
RUN apk add --no-cache tzdata
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Schema migrations run before the server accepts traffic (see CMD). Not part
# of the standalone trace, so they are copied in explicitly; `pg` itself the
# trace does include, since the store layer imports it.
COPY --from=builder /app/db ./db
COPY --from=builder /app/scripts/migrate.mjs ./scripts/migrate.mjs

# Writable mountpoint for the webauthn-data volume; a fresh volume inherits
# this ownership, so the non-root app user can persist passkeys.
RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node server.js"]
