FROM node:22-alpine AS base

WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN corepack enable || true

FROM base AS deps
RUN if [ -f "pnpm-lock.yaml" ]; then pnpm install; \
  elif [ -f "package-lock.json" ]; then npm ci; \
  else npm install; \
  fi

# Development mode: install all deps and run dev server
FROM deps AS development
ENV NODE_ENV=development
# Set HOSTNAME for development mode to be accessible from outside container
ENV HOSTNAME=0.0.0.0
# Create public directory if it doesn't exist
RUN mkdir -p public
COPY . .
# Create entrypoint script to install mcp-server deps
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'if [ -d "/app/mcp-server" ] && [ ! -d "/app/mcp-server/node_modules" ]; then' >> /entrypoint.sh && \
    echo '  echo "📦 Installing MCP server dependencies..."' >> /entrypoint.sh && \
    echo '  cd /app/mcp-server && npm install' >> /entrypoint.sh && \
    echo 'fi' >> /entrypoint.sh && \
    echo 'exec "$@"' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh
EXPOSE 7001
# Set PORT for Next.js to listen on port 7001
ENV PORT=7001
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "dev"]

# Production mode: build optimized production bundle
FROM deps AS build
# Create public directory if it doesn't exist (Next.js may need it)
RUN mkdir -p public
COPY . .
# RUN npm run build
RUN NEXT_DIST_DIR=.next-docker npm run build

FROM node:22-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN if [ -f "pnpm-lock.yaml" ]; then corepack enable && pnpm install --prod; \
  elif [ -f "package-lock.json" ]; then npm ci --omit=dev; \
  else npm install --omit=dev; \
  fi

# Install nginx for reverse proxy
RUN apk add --no-cache nginx && \
    mkdir -p /run/nginx /var/log/nginx

# Create entrypoint script to install mcp-server deps
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'if [ -d "/app/mcp-server" ] && [ ! -d "/app/mcp-server/node_modules" ]; then' >> /entrypoint.sh && \
    echo '  echo "📦 Installing MCP server dependencies..."' >> /entrypoint.sh && \
    echo '  cd /app/mcp-server && npm install' >> /entrypoint.sh && \
    echo 'fi' >> /entrypoint.sh && \
    echo 'exec "$@"' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

COPY --from=build /app/.next-docker ./.next
COPY --from=build /app/next.config.ts ./next.config.ts
# Copy public folder (now guaranteed to exist from build stage)
COPY --from=build /app/public ./public

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
EXPOSE 7001
ENV HOSTNAME=0.0.0.0
ENV PORT=7001

ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "npm run start & nginx -g 'daemon off;'"]


