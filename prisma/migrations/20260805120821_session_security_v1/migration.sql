/*
  Warnings:

  - You are about to drop the column `allowedSites` on the `ClassSession` table. All the data in the column will be lost.
  - You are about to drop the column `blockedSites` on the `ClassSession` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `MessageAttachment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ClassSession" DROP COLUMN "allowedSites",
DROP COLUMN "blockedSites",
ADD COLUMN     "allowAltTab" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowClipboard" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowInternet" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowPrintScreen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowTaskManager" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowUsb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowWindowsKey" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "policyVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "screenshotInterval" INTEGER,
ALTER COLUMN "freezeOnEnd" SET DEFAULT false;

-- AlterTable
ALTER TABLE "MessageAttachment" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "AllowedWebsite" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllowedWebsite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedWebsite" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockedWebsite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllowedApplication" (
    "id" TEXT NOT NULL,
    "processName" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllowedApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedApplication" (
    "id" TEXT NOT NULL,
    "processName" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockedApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPolicyLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "changedBy" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionPolicyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AllowedWebsite_sessionId_idx" ON "AllowedWebsite"("sessionId");

-- CreateIndex
CREATE INDEX "BlockedWebsite_sessionId_idx" ON "BlockedWebsite"("sessionId");

-- CreateIndex
CREATE INDEX "AllowedApplication_sessionId_idx" ON "AllowedApplication"("sessionId");

-- CreateIndex
CREATE INDEX "BlockedApplication_sessionId_idx" ON "BlockedApplication"("sessionId");

-- CreateIndex
CREATE INDEX "SessionPolicyLog_sessionId_idx" ON "SessionPolicyLog"("sessionId");

-- AddForeignKey
ALTER TABLE "AllowedWebsite" ADD CONSTRAINT "AllowedWebsite_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedWebsite" ADD CONSTRAINT "BlockedWebsite_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllowedApplication" ADD CONSTRAINT "AllowedApplication_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedApplication" ADD CONSTRAINT "BlockedApplication_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPolicyLog" ADD CONSTRAINT "SessionPolicyLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
