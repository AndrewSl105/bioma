/*
  Warnings:

  - The `commonlyEvaluatedWith` column on the `BiomarkerContent` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `confirmatoryTests` column on the `BiomarkerContent` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "BiomarkerContent" ALTER COLUMN "relatedSystems" SET DATA TYPE TEXT,
ALTER COLUMN "influencingFactors" SET DATA TYPE TEXT,
DROP COLUMN "commonlyEvaluatedWith",
ADD COLUMN     "commonlyEvaluatedWith" TEXT[],
DROP COLUMN "confirmatoryTests",
ADD COLUMN     "confirmatoryTests" TEXT[],
ALTER COLUMN "foodSources" SET DATA TYPE TEXT;
