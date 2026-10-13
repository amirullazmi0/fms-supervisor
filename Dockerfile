FROM node:22-alpine AS dependencies

WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json yarn.lock ./
COPY . .

# NEXT_PUBLIC_* are baked in at build time (CapRover passes app env vars as build args).
# The backend address is NOT one of them: the BFF reads API_URL at runtime.
ARG NEXT_PUBLIC_DARK_MODE

ENV NEXT_PUBLIC_DARK_MODE=${NEXT_PUBLIC_DARK_MODE}

RUN yarn build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3300

RUN corepack enable
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3300

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q -O - http://127.0.0.1:3300/auth/sign-in || exit 1

CMD ["yarn", "start", "-p", "3300"]
