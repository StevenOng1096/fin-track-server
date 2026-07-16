# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl postgresql17-client

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl postgresql17-client

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN npm ci --omit=dev \
  && npm install --no-save prisma@7.8.0 \
  && chmod +x docker-entrypoint.sh

COPY --from=builder /app/dist ./dist

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
