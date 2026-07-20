-- AlterTable
ALTER TABLE "Biomarker" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "BiomarkerCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiomarkerCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BiomarkerCategory_slug_key" ON "BiomarkerCategory"("slug");

-- CreateIndex
CREATE INDEX "Biomarker_categoryId_idx" ON "Biomarker"("categoryId");

-- AddForeignKey
ALTER TABLE "Biomarker" ADD CONSTRAINT "Biomarker_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BiomarkerCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
--  BACKFILL. Дописано вручну: Prisma генерує лише зміни структури,
--  перенесення даних — ні. Стара колонка "category" тут свідомо
--  НЕ видаляється: вона лишається джерелом істини доти, доки код
--  не перейде на categoryId. Видалення — окремою міграцією.
-- ─────────────────────────────────────────────────────────────

-- 1. Категорія на кожне унікальне значення Biomarker.category.
--    slug — з англійського каноніка, name — з української локалізації
--    (BiomarkerTranslation.category), з відкатом на англійську.
--    sortOrder з кроком 10, щоб потім можна було вставляти між ними.
INSERT INTO "BiomarkerCategory" ("id", "slug", "name", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  trim(BOTH '-' FROM regexp_replace(lower(src.en), '[^a-z0-9]+', '-', 'g')),
  COALESCE(NULLIF(src.uk, ''), src.en),
  (row_number() OVER (ORDER BY COALESCE(NULLIF(src.uk, ''), src.en)))::int * 10,
  true,
  now(),
  now()
FROM (
  SELECT b."category" AS en, MIN(t."category") AS uk
  FROM "Biomarker" b
  LEFT JOIN "BiomarkerTranslation" t
    ON t."biomarkerId" = b."id" AND t."locale" = 'uk'
  WHERE b."category" IS NOT NULL AND b."category" <> ''
  GROUP BY b."category"
) src
-- Запобіжник на випадок, коли дві різні назви дають однаковий slug:
-- краще злити їх в одну категорію, ніж завалити міграцію.
ON CONFLICT ("slug") DO NOTHING;

-- 2. Прив'язати наявні маркери до створених категорій за тим самим slug.
--    Жоден маркер, результат чи референсний діапазон при цьому не зникає:
--    додається лише посилання.
UPDATE "Biomarker" b
SET "categoryId" = c."id"
FROM "BiomarkerCategory" c
WHERE b."category" IS NOT NULL
  AND b."category" <> ''
  AND c."slug" = trim(BOTH '-' FROM regexp_replace(lower(b."category"), '[^a-z0-9]+', '-', 'g'));
