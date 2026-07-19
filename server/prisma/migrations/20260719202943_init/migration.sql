-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'ANY');

-- CreateEnum
CREATE TYPE "ResultSource" AS ENUM ('MANUAL', 'AI_PHOTO', 'IMPORT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ResultFlag" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'UNKNOWN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "sex" "Sex",
    "birthDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Biomarker" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "unit" TEXT NOT NULL,
    "category" TEXT,
    "loincCode" TEXT,
    "description" TEXT,
    "precision" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Biomarker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceRange" (
    "id" TEXT NOT NULL,
    "biomarkerId" TEXT NOT NULL,
    "low" DOUBLE PRECISION,
    "high" DOUBLE PRECISION,
    "optimalLow" DOUBLE PRECISION,
    "optimalHigh" DOUBLE PRECISION,
    "unit" TEXT NOT NULL,
    "sex" "Sex" NOT NULL DEFAULT 'ANY',
    "ageMinYears" INTEGER,
    "ageMaxYears" INTEGER,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabPanel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "labName" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "biomarkerId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "flag" "ResultFlag" NOT NULL DEFAULT 'UNKNOWN',
    "source" "ResultSource" NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "rawText" TEXT,
    "confidence" DOUBLE PRECISION,
    "panelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "aiRaw" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromInstrument" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "schema" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromInstrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromResponse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Biomarker_slug_idx" ON "Biomarker"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Biomarker_ownerId_slug_key" ON "Biomarker"("ownerId", "slug");

-- CreateIndex
CREATE INDEX "ReferenceRange_biomarkerId_idx" ON "ReferenceRange"("biomarkerId");

-- CreateIndex
CREATE INDEX "LabPanel_userId_takenAt_idx" ON "LabPanel"("userId", "takenAt");

-- CreateIndex
CREATE INDEX "LabResult_userId_biomarkerId_measuredAt_idx" ON "LabResult"("userId", "biomarkerId", "measuredAt");

-- CreateIndex
CREATE INDEX "Document_userId_status_idx" ON "Document"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PromInstrument_slug_key" ON "PromInstrument"("slug");

-- CreateIndex
CREATE INDEX "PromResponse_userId_instrumentId_takenAt_idx" ON "PromResponse"("userId", "instrumentId", "takenAt");

-- AddForeignKey
ALTER TABLE "Biomarker" ADD CONSTRAINT "Biomarker_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceRange" ADD CONSTRAINT "ReferenceRange_biomarkerId_fkey" FOREIGN KEY ("biomarkerId") REFERENCES "Biomarker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabPanel" ADD CONSTRAINT "LabPanel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabPanel" ADD CONSTRAINT "LabPanel_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_biomarkerId_fkey" FOREIGN KEY ("biomarkerId") REFERENCES "Biomarker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "LabPanel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromResponse" ADD CONSTRAINT "PromResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromResponse" ADD CONSTRAINT "PromResponse_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "PromInstrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
