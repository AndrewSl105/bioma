-- CreateTable
CREATE TABLE "WellbeingLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "energy" INTEGER,
    "sleepQuality" INTEGER,
    "sleepHours" DOUBLE PRECISION,
    "mood" INTEGER,
    "digestion" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WellbeingLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WellbeingLog_userId_date_idx" ON "WellbeingLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WellbeingLog_userId_date_key" ON "WellbeingLog"("userId", "date");

-- AddForeignKey
ALTER TABLE "WellbeingLog" ADD CONSTRAINT "WellbeingLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
