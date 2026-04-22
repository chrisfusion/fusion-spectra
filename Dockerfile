# =============================================================================
# fusion-spectra — Multi-stage Docker build
#
# Stage 1 (deps):  npm ci from configurable registry — replace NPM_REGISTRY
#                  with your internal mirror to build without internet access.
# Stage 2 (build): vite build — no network access required.
# Stage 3 (serve): nginx:alpine serving the static SPA.
#
# Local dev (mock registry):
#   docker compose -f mock-registry/docker-compose.yml up -d
#   docker build --build-arg NPM_REGISTRY=http://host.docker.internal:4873 \
#     -t fusion-spectra:latest .
#
# Production (internal registry, no internet):
#   docker build --build-arg NPM_REGISTRY=https://npm.registry.internal \
#     -t fusion-spectra:latest .
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — Install dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

ARG NPM_REGISTRY=https://registry.npmjs.org

WORKDIR /app
COPY package*.json ./
RUN npm ci --registry=$NPM_REGISTRY

# -----------------------------------------------------------------------------
# Stage 2 — Build (network not required; all deps already in node_modules)
# -----------------------------------------------------------------------------
FROM deps AS build

COPY . .
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3 — Serve
# -----------------------------------------------------------------------------
FROM nginx:alpine AS serve

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
