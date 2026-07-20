-- AlterTable
ALTER TABLE "Biomarker" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UserBiomarker" (
    "userId" TEXT NOT NULL,
    "biomarkerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBiomarker_pkey" PRIMARY KEY ("userId","biomarkerId")
);

-- CreateIndex
CREATE INDEX "UserBiomarker_userId_idx" ON "UserBiomarker"("userId");

-- CreateIndex
CREATE INDEX "UserBiomarker_biomarkerId_idx" ON "UserBiomarker"("biomarkerId");

-- CreateIndex
CREATE INDEX "Biomarker_isSystem_idx" ON "Biomarker"("isSystem");

-- AddForeignKey
ALTER TABLE "UserBiomarker" ADD CONSTRAINT "UserBiomarker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBiomarker" ADD CONSTRAINT "UserBiomarker_biomarkerId_fkey" FOREIGN KEY ("biomarkerId") REFERENCES "Biomarker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: увесь наявний глобальний каталог стає системним, заведеним адміном.
UPDATE "Biomarker" SET "isSystem" = true, "createdBy" = 'admin' WHERE "ownerId" IS NULL;

-- Backfill: дашборд тепер будується з обраних показників, а не з результатів.
-- Без цього кроку користувачі, які вже мають аналізи, побачили б порожньо —
-- тож обраним стає все, по чому в них є бодай один результат.
INSERT INTO "UserBiomarker" ("userId", "biomarkerId")
SELECT DISTINCT r."userId", r."biomarkerId" FROM "LabResult" r
ON CONFLICT DO NOTHING;
