-- CreateEnum
CREATE TYPE "CyclePhase" AS ENUM ('MENSTRUAL', 'FOLLICULAR', 'OVULATION', 'LUTEAL');

-- CreateEnum
CREATE TYPE "FlowLevel" AS ENUM ('SPOTTING', 'LIGHT', 'MEDIUM', 'HEAVY');

-- CreateTable
CREATE TABLE "MenstrualDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isPeriod" BOOLEAN NOT NULL DEFAULT false,
    "flow" "FlowLevel",
    "symptoms" TEXT[],
    "mood" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenstrualDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleSettings" (
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "avgCycleLength" INTEGER,
    "avgPeriodLength" INTEGER,
    "trackingGoal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CycleSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "MenstrualDay_userId_date_idx" ON "MenstrualDay"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MenstrualDay_userId_date_key" ON "MenstrualDay"("userId", "date");

-- AddForeignKey
ALTER TABLE "MenstrualDay" ADD CONSTRAINT "MenstrualDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleSettings" ADD CONSTRAINT "CycleSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
