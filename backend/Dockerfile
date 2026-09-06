# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM dependencies AS build
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
COPY backend/nest-cli.json backend/tsconfig.json backend/tsconfig.build.json backend/prisma.config.ts ./
COPY backend/prisma ./prisma
COPY backend/src ./src
RUN npm run prisma:generate && npm run build

FROM dependencies AS migrate
ENV NODE_ENV=production
COPY backend/prisma.config.ts ./
COPY backend/prisma ./prisma
USER node
CMD ["npm", "run", "db:deploy"]

FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
