#!/bin/sh
set -e

# Міграції ідемпотентні — безпечно на кожному старті.
npx prisma migrate deploy

# Сід теж ідемпотентний (каталог — upsert, панелі — за номером замовлення).
if [ "$SEED_ON_START" = "true" ]; then
  npx tsx prisma/seed.ts
fi

exec node dist/main.js
