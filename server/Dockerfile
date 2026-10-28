# Bioma API (NestJS + Prisma).
# Один етап свідомо: на старті контейнер сам накочує міграції й сід,
# а для цього потрібні prisma CLI і tsx — тобто dev-залежності.
FROM node:24-slim

# Двигуну міграцій Prisma потрібен OpenSSL.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
# prisma.config.ts вимагає DATABASE_URL навіть для generate; до бази він
# тут не звертається, тож вистачає заглушки.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate \
  && npx nest build

ENV NODE_ENV=production PORT=3001
EXPOSE 3001

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
