FROM node:22-alpine AS base

WORKDIR /app

# Copy manifest files first to cache dependency installation
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# If the repo uses pnpm, install pnpm first
RUN corepack enable || true

FROM base AS deps
# Update npm and clear cache to avoid "Exit handler never called" bug
RUN npm cache clean --force && npm install -g npm@latest
RUN if [ -f "pnpm-lock.yaml" ]; then pnpm install --frozen-lockfile; \
  elif [ -f "package-lock.json" ]; then npm ci || npm install; \
  else npm install; \
  fi


FROM deps AS development
ENV NODE_ENV=development
WORKDIR /app
COPY . .
CMD ["npm", "run", "dev"]

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:22-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

# Update npm and clear cache to avoid "Exit handler never called" bug
RUN npm cache clean --force && npm install -g npm@latest

COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install dependencies - use npm install for production because it is more stable
# npm ci has "Exit handler never called" bug in node:22-alpine
RUN if [ -f "pnpm-lock.yaml" ]; then \
      corepack enable && pnpm install --prod --frozen-lockfile; \
    elif [ -f "package-lock.json" ]; then \
      npm install --omit=dev --prefer-offline --no-audit; \
    else \
      npm install --omit=dev --no-audit; \
    fi

COPY --from=build /app/dist ./dist
# Include documentation folder to be used by RAG at runtime
COPY docs ./docs

# Default backend port according to README (can be overridden via env)
ENV BACKEND_PORT=7002
EXPOSE 7002

CMD ["sh", "-c", "node dist/server.js"]
