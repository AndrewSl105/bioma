-- Biomarker: name/shortName → canonicalName/canonicalShort (англ. канон),
-- локалізовані назви виносяться в окрему таблицю BiomarkerTranslation.
--
-- УВАГА: `prisma migrate diff` згенерував тут DROP COLUMN + ADD COLUMN.
-- Замінено вручну на RENAME COLUMN з двох причин:
--   1) DROP знищив би наявні назви біомаркерів;
--   2) ADD COLUMN "canonicalName" TEXT NOT NULL без DEFAULT впав би
--      на непорожній таблиці.

-- AlterTable
ALTER TABLE "Biomarker" RENAME COLUMN "name" TO "canonicalName";
ALTER TABLE "Biomarker" RENAME COLUMN "shortName" TO "canonicalShort";
ALTER TABLE "Biomarker" ADD COLUMN "bands" JSONB;

-- CreateTable
CREATE TABLE "BiomarkerTranslation" (
    "id" TEXT NOT NULL,
    "biomarkerId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiomarkerTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BiomarkerTranslation_biomarkerId_idx" ON "BiomarkerTranslation"("biomarkerId");

-- CreateIndex
CREATE UNIQUE INDEX "BiomarkerTranslation_biomarkerId_locale_key" ON "BiomarkerTranslation"("biomarkerId", "locale");

-- AddForeignKey
ALTER TABLE "BiomarkerTranslation" ADD CONSTRAINT "BiomarkerTranslation_biomarkerId_fkey" FOREIGN KEY ("biomarkerId") REFERENCES "Biomarker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Наявні назви фактично українські, а canonicalName призначений для англ. канону.
-- Зберігаємо їх як локаль "uk", щоб UI не втратив мову до першого запуску сіду.
-- На порожній БД це no-op. Приберіть блок, якщо бекфіл не потрібен.
INSERT INTO "BiomarkerTranslation" ("id", "biomarkerId", "locale", "name", "shortName", "category", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", 'uk', "canonicalName", "canonicalShort", "category", NOW(), NOW()
FROM "Biomarker"
ON CONFLICT ("biomarkerId", "locale") DO NOTHING;
