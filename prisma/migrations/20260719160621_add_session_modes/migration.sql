-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "allowOffline" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "freezeOnEnd" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "questionMode" TEXT NOT NULL DEFAULT 'COMMON',
ADD COLUMN     "restrictExistingFiles" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "restrictUnauthorizedApps" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sessionMode" TEXT NOT NULL DEFAULT 'LAB',
ADD COLUMN     "warningMinutes" INTEGER NOT NULL DEFAULT 5;
