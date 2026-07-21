-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "regNumber" TEXT,
    "rollNumber" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "classId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" TEXT NOT NULL,
    "sessionCode" TEXT NOT NULL,
    "classTitle" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "joinWindowMinutes" INTEGER NOT NULL DEFAULT 15,
    "allowedSites" TEXT NOT NULL DEFAULT '[]',
    "blockedSites" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pc" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "displayName" TEXT,
    "labName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "healthStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "internetStatus" TEXT NOT NULL DEFAULT 'OFFLINE',
    "latencyMs" INTEGER,
    "osName" TEXT,
    "osVersion" TEXT,
    "cpuName" TEXT,
    "totalMemoryMb" INTEGER,
    "availableMemoryMb" INTEGER,
    "totalDiskMb" INTEGER,
    "availableDiskMb" INTEGER,
    "agentVersion" TEXT,
    "clientVersion" TEXT,
    "updateStatus" TEXT NOT NULL DEFAULT 'UPDATED',
    "currentSessionId" TEXT,
    "currentStudentId" TEXT,
    "lastSeen" TIMESTAMP(3),
    "lastHealthCheck" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PcHealthReport" (
    "id" TEXT NOT NULL,
    "pcId" TEXT NOT NULL,
    "healthStatus" TEXT NOT NULL,
    "internetStatus" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "cpuUsagePercent" DOUBLE PRECISION,
    "memoryUsagePercent" DOUBLE PRECISION,
    "diskUsagePercent" DOUBLE PRECISION,
    "availableMemoryMb" INTEGER,
    "availableDiskMb" INTEGER,
    "issueCode" TEXT,
    "issueMessage" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PcHealthReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PcSoftware" (
    "id" TEXT NOT NULL,
    "pcId" TEXT NOT NULL,
    "softwareName" TEXT NOT NULL,
    "installedVersion" TEXT,
    "requiredVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INSTALLED',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PcSoftware_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "pcHostname" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "approvedLate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SessionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "presentSeconds" INTEGER NOT NULL,
    "requiredSeconds" INTEGER NOT NULL,
    "isPresent" BOOLEAN NOT NULL DEFAULT false,
    "attendancePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activityPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overallPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "autoReviewAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "autoReviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewReason" TEXT,
    "computedAt" TIMESTAMP(3),

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialAccessRequest" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),

    CONSTRAINT "SpecialAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT,
    "recipientType" TEXT NOT NULL DEFAULT 'USER',
    "classId" TEXT,
    "messageType" TEXT NOT NULL DEFAULT 'MESSAGE',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "allowReply" BOOLEAN NOT NULL DEFAULT false,
    "parentMessageId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetPc" TEXT,
    "targetUser" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_regNumber_key" ON "User"("regNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_classId_idx" ON "User"("classId");

-- CreateIndex
CREATE INDEX "User_rollNumber_idx" ON "User"("rollNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSession_sessionCode_key" ON "ClassSession"("sessionCode");

-- CreateIndex
CREATE INDEX "ClassSession_status_idx" ON "ClassSession"("status");

-- CreateIndex
CREATE INDEX "ClassSession_createdAt_idx" ON "ClassSession"("createdAt");

-- CreateIndex
CREATE INDEX "ClassSession_teacherId_idx" ON "ClassSession"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "Pc_hostname_key" ON "Pc"("hostname");

-- CreateIndex
CREATE INDEX "Pc_labName_idx" ON "Pc"("labName");

-- CreateIndex
CREATE INDEX "Pc_status_idx" ON "Pc"("status");

-- CreateIndex
CREATE INDEX "Pc_healthStatus_idx" ON "Pc"("healthStatus");

-- CreateIndex
CREATE INDEX "Pc_internetStatus_idx" ON "Pc"("internetStatus");

-- CreateIndex
CREATE INDEX "Pc_updateStatus_idx" ON "Pc"("updateStatus");

-- CreateIndex
CREATE INDEX "Pc_currentSessionId_idx" ON "Pc"("currentSessionId");

-- CreateIndex
CREATE INDEX "Pc_currentStudentId_idx" ON "Pc"("currentStudentId");

-- CreateIndex
CREATE INDEX "Pc_lastSeen_idx" ON "Pc"("lastSeen");

-- CreateIndex
CREATE INDEX "PcHealthReport_pcId_idx" ON "PcHealthReport"("pcId");

-- CreateIndex
CREATE INDEX "PcHealthReport_healthStatus_idx" ON "PcHealthReport"("healthStatus");

-- CreateIndex
CREATE INDEX "PcHealthReport_internetStatus_idx" ON "PcHealthReport"("internetStatus");

-- CreateIndex
CREATE INDEX "PcHealthReport_reportedAt_idx" ON "PcHealthReport"("reportedAt");

-- CreateIndex
CREATE INDEX "PcSoftware_pcId_idx" ON "PcSoftware"("pcId");

-- CreateIndex
CREATE INDEX "PcSoftware_softwareName_idx" ON "PcSoftware"("softwareName");

-- CreateIndex
CREATE INDEX "PcSoftware_status_idx" ON "PcSoftware"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PcSoftware_pcId_softwareName_key" ON "PcSoftware"("pcId", "softwareName");

-- CreateIndex
CREATE INDEX "SessionParticipant_studentId_idx" ON "SessionParticipant"("studentId");

-- CreateIndex
CREATE INDEX "SessionParticipant_pcHostname_idx" ON "SessionParticipant"("pcHostname");

-- CreateIndex
CREATE UNIQUE INDEX "SessionParticipant_sessionId_studentId_key" ON "SessionParticipant"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "Attendance_studentId_idx" ON "Attendance"("studentId");

-- CreateIndex
CREATE INDEX "Attendance_reviewStatus_idx" ON "Attendance"("reviewStatus");

-- CreateIndex
CREATE INDEX "Attendance_autoReviewAt_idx" ON "Attendance"("autoReviewAt");

-- CreateIndex
CREATE INDEX "Attendance_reviewedById_idx" ON "Attendance"("reviewedById");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_sessionId_studentId_key" ON "Attendance"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "SpecialAccessRequest_sessionId_status_idx" ON "SpecialAccessRequest"("sessionId", "status");

-- CreateIndex
CREATE INDEX "SpecialAccessRequest_studentId_idx" ON "SpecialAccessRequest"("studentId");

-- CreateIndex
CREATE INDEX "Message_sessionId_idx" ON "Message"("sessionId");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_recipientId_idx" ON "Message"("recipientId");

-- CreateIndex
CREATE INDEX "Message_recipientType_idx" ON "Message"("recipientType");

-- CreateIndex
CREATE INDEX "Message_classId_idx" ON "Message"("classId");

-- CreateIndex
CREATE INDEX "Message_messageType_idx" ON "Message"("messageType");

-- CreateIndex
CREATE INDEX "Message_parentMessageId_idx" ON "Message"("parentMessageId");

-- CreateIndex
CREATE INDEX "Message_sentAt_idx" ON "Message"("sentAt");

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PcHealthReport" ADD CONSTRAINT "PcHealthReport_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "Pc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PcSoftware" ADD CONSTRAINT "PcSoftware_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "Pc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialAccessRequest" ADD CONSTRAINT "SpecialAccessRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialAccessRequest" ADD CONSTRAINT "SpecialAccessRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialAccessRequest" ADD CONSTRAINT "SpecialAccessRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
