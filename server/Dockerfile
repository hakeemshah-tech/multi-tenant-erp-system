# syntax=docker/dockerfile:1.7

###############################################################################
# Backend image: Express + TypeScript, bundled with tsup.
#
# Four stages so that the layer containing compiler toolchains and dev
# dependencies never reaches the published image. Only `dist/` and the
# production dependency tree are carried into the final stage.
###############################################################################

ARG NODE_VERSION=20.19.6

# --- Stage 1: full dependency tree (dev + prod), used only to compile --------
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# --- Stage 2: compile TypeScript to a CJS bundle in dist/ --------------------
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Stage 3: production-only dependency tree --------------------------------
# Resolved separately from the build tree so no dev dependency can leak in.
FROM node:${NODE_VERSION}-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# --- Stage 4: runtime --------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Pins the upload root to a path the service user owns. Without it the app falls
# back to <cwd>/uploads, which is the same directory here, but being explicit
# means a changed WORKDIR cannot silently relocate uploads.
ENV UPLOAD_DIR=/app/uploads

# tini reaps zombies and forwards SIGTERM, so `docker compose down` stops the
# process cleanly instead of waiting out the timeout.
RUN apk add --no-cache tini

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build     --chown=node:node /app/dist          ./dist
COPY --chown=node:node package.json ./

# Local disk target for multer before objects are pushed to object storage.
#
# `temp/` is created here rather than left to the application. A named volume
# mounted at /app/uploads inherits the ownership of this directory, so creating
# and chowning it now is what lets the non-root user write inside the mount.
RUN mkdir -p /app/uploads/temp && chown -R node:node /app/uploads

USER node

EXPOSE 5000

# Probed with `node` rather than curl or wget: neither is installed in this
# image and neither needs to be, since the runtime is already here.
#
# Timings are sized for a cold CI runner. The old 30s interval meant the very
# first probe did not run until 30s in, and three failures took ~120s to declare
# a verdict; 5s intervals with a 45s grace period surface a genuine failure
# faster while giving a slow boot room to finish.
HEALTHCHECK --interval=5s --timeout=5s --start-period=45s --retries=12 \
    CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
