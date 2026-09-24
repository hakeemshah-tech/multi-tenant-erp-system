# syntax=docker/dockerfile:1.7

###############################################################################
# Frontend image: Next.js 15 (App Router).
#
# This is NOT a static bundle served by Nginx. The app uses middleware, server
# components and route handlers, all of which need a Node runtime, so the image
# ships Next's `standalone` output and Nginx sits in front as a reverse proxy
# (see the `nginx` service in docker-compose.yml).
###############################################################################

ARG NODE_VERSION=20.19.6

# --- Stage 1: dependencies ---------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# --- Stage 2: build ----------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they
# must be present here rather than only at runtime. They are non-secret by
# definition: anything passed here is readable in the browser.
ARG NEXT_PUBLIC_API_BASE_URL=/api
ARG NEXT_PUBLIC_BASE_URL=/
ARG NEXT_PUBLIC_CDN_HOSTNAME=
ARG NEXT_PUBLIC_EXTRA_IMAGE_HOSTS=
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL} \
    NEXT_PUBLIC_CDN_HOSTNAME=${NEXT_PUBLIC_CDN_HOSTNAME} \
    NEXT_PUBLIC_EXTRA_IMAGE_HOSTS=${NEXT_PUBLIC_EXTRA_IMAGE_HOSTS} \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Stage 3: runtime --------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apk add --no-cache tini

# `standalone` already contains the pruned node_modules Next actually needs, so
# no dependency install happens in this stage. `static` and `public` are not
# included in that trace and must be copied alongside it.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static     ./.next/static
COPY --from=build --chown=node:node /app/public           ./public

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
