-- CreateTable
CREATE TABLE "BiomarkerContent" (
    "id" TEXT NOT NULL,
    "biomarkerId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "overview" TEXT,
    "whatItMeasures" TEXT,
    "roleInBody" TEXT,
    "relatedSystems" JSONB,
    "functionalLinks" TEXT,
    "lowMeaning" TEXT,
    "highMeaning" TEXT,
    "influencingFactors" JSONB,
    "preparation" TEXT,
    "commonlyEvaluatedWith" JSONB,
    "confirmatoryTests" JSONB,
    "foodSources" JSONB,
    "supplementsInfo" TEXT,
    "drugClassesInfo" TEXT,
    "medicalSources" JSONB,
    "lastReviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiomarkerContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BiomarkerContent_biomarkerId_idx" ON "BiomarkerContent"("biomarkerId");

-- CreateIndex
CREATE UNIQUE INDEX "BiomarkerContent_biomarkerId_locale_key" ON "BiomarkerContent"("biomarkerId", "locale");

-- AddForeignKey
ALTER TABLE "BiomarkerContent" ADD CONSTRAINT "BiomarkerContent_biomarkerId_fkey" FOREIGN KEY ("biomarkerId") REFERENCES "Biomarker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
