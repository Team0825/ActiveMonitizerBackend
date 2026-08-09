-- AlterTable
ALTER TABLE "Pc" ADD COLUMN     "antivirusEnabled" BOOLEAN,
ADD COLUMN     "firewallEnabled" BOOLEAN,
ADD COLUMN     "gpuDriverVersion" TEXT,
ADD COLUMN     "gpuName" TEXT,
ADD COLUMN     "restartRequired" BOOLEAN,
ADD COLUMN     "uptimeSeconds" INTEGER;
