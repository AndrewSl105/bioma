-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'uk';

-- CreateTable
CREATE TABLE "BiomarkerCategoryTranslation" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiomarkerCategoryTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BiomarkerCategoryTranslation_categoryId_idx" ON "BiomarkerCategoryTranslation"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "BiomarkerCategoryTranslation_categoryId_locale_key" ON "BiomarkerCategoryTranslation"("categoryId", "locale");

-- AddForeignKey
ALTER TABLE "BiomarkerCategoryTranslation" ADD CONSTRAINT "BiomarkerCategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BiomarkerCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
