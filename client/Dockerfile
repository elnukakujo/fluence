FROM node:20-slim AS deps
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci

FROM deps AS build
COPY client/ ./
ARG LAPP_PUBLIC_HOST
ARG LAPP_PUBLIC_PORT
ARG LAPP_EXTRA_MEDIA_HOSTS
# LAPP_INTERNAL_HOST/PORT must be build args too: next.config.ts rewrites() are
# baked at build time, so the runtime-only env would leave /api/* pointing at
# 127.0.0.1:5050 (unreachable from the frontend container) and every API call 500s.
ARG LAPP_INTERNAL_HOST
ARG LAPP_INTERNAL_PORT
ENV LAPP_PUBLIC_HOST=$LAPP_PUBLIC_HOST LAPP_PUBLIC_PORT=$LAPP_PUBLIC_PORT LAPP_EXTRA_MEDIA_HOSTS=$LAPP_EXTRA_MEDIA_HOSTS LAPP_INTERNAL_HOST=$LAPP_INTERNAL_HOST LAPP_INTERNAL_PORT=$LAPP_INTERNAL_PORT
RUN node_modules/.bin/next build

FROM node:20-slim AS runtime
WORKDIR /app/client
COPY --from=build /app/client ./
ARG LAPP_PUBLIC_HOST
ARG LAPP_PUBLIC_PORT
ARG LAPP_EXTRA_MEDIA_HOSTS
ENV NODE_ENV=production PORT=3000 LAPP_PUBLIC_HOST=$LAPP_PUBLIC_HOST LAPP_PUBLIC_PORT=$LAPP_PUBLIC_PORT LAPP_EXTRA_MEDIA_HOSTS=$LAPP_EXTRA_MEDIA_HOSTS
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
