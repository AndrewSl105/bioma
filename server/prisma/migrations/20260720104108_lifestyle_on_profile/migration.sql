-- CreateEnum
CREATE TYPE "SmokingStatus" AS ENUM ('NEVER', 'FORMER', 'CURRENT');

-- CreateEnum
CREATE TYPE "AlcoholUse" AS ENUM ('NONE', 'OCCASIONAL', 'REGULAR');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'HIGH');

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "activityLevel" "ActivityLevel",
ADD COLUMN     "alcoholUse" "AlcoholUse",
ADD COLUMN     "smokingStatus" "SmokingStatus";
