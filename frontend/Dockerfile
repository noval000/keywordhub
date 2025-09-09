FROM node:18-alpine AS base

# Установка зависимостей
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retry-factor 10 && \
    npm config set fetch-retries 5 && \
    npm ci --omit=dev --cache /tmp/.npm

# Сборка приложения
FROM base AS builder
WORKDIR /app

# Копируем node_modules и устанавливаем dev зависимости
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
RUN npm install --cache /tmp/.npm

# Копируем исходный код
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Production образ
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Копируем необходимые файлы
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/package.json ./package.json

# Копируем public папку (если есть файлы)
COPY --from=builder /app/public ./public

# Копируем собранное приложение
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]