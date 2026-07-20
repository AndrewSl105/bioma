-- CreateEnum
CREATE TYPE "IntakeType" AS ENUM ('MEDICATION', 'SUPPLEMENT');

-- AlterTable
ALTER TABLE "BiomarkerContent" ADD COLUMN     "affectedByDrugClasses" TEXT[];

-- CreateTable
CREATE TABLE "UserIntake" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "IntakeType" NOT NULL,
    "name" TEXT NOT NULL,
    "drugClassKey" TEXT,
    "dosageText" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserIntake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserIntake_userId_idx" ON "UserIntake"("userId");

-- AddForeignKey
ALTER TABLE "UserIntake" ADD CONSTRAINT "UserIntake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
