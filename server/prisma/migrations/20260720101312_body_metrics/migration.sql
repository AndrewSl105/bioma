-- CreateEnum
CREATE TYPE "BodyMetricKind" AS ENUM ('WEIGHT', 'WAIST', 'RESTING_HR', 'BP_SYSTOLIC', 'BP_DIASTOLIC');

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "heightCm" INTEGER;

-- CreateTable
CREATE TABLE "BodyMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "BodyMetricKind" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BodyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BodyMetric_userId_kind_measuredAt_idx" ON "BodyMetric"("userId", "kind", "measuredAt");

-- AddForeignKey
ALTER TABLE "BodyMetric" ADD CONSTRAINT "BodyMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
