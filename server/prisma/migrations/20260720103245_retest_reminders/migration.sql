-- AlterTable
ALTER TABLE "Biomarker" ADD COLUMN     "defaultRetestDays" INTEGER;

-- AlterTable
ALTER TABLE "UserBiomarker" ADD COLUMN     "retestIntervalDays" INTEGER;
