-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dateOfBirth" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "departmentName" TEXT,
ADD COLUMN     "institutionId" TEXT,
ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "semester" TEXT;

-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "activityMonitoring" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "activitySensitivity" TEXT NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "activityUpdateInterval" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "cbtCode" TEXT,
ADD COLUMN     "connectivityMode" TEXT NOT NULL DEFAULT 'HYBRID',
ADD COLUMN     "idleThresholdSeconds" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "institutionId" TEXT,
ADD COLUMN     "violationSensitivity" TEXT NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "websiteAccessMode" TEXT NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "Pc" ADD COLUMN     "assignedInvigilatorId" TEXT,
ADD COLUMN     "assignedStudentId" TEXT,
ADD COLUMN     "cbtStatus" TEXT NOT NULL DEFAULT 'IDLE',
ADD COLUMN     "emergencyTerminationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "institutionId" TEXT,
ADD COLUMN     "osArchitecture" TEXT;

-- CreateTable
CREATE TABLE "QuestionPaper" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "totalMarks" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "passingMarks" DOUBLE PRECISION NOT NULL DEFAULT 40.0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionPaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "questionPaperId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionType" TEXT NOT NULL DEFAULT 'MCQ',
    "section" TEXT NOT NULL DEFAULT 'General',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "marks" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "negativeMarks" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "explanation" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "cbtCode" TEXT,
    "reviewPeriodHours" INTEGER NOT NULL DEFAULT 24,
    "canGenerateResultAt" TIMESTAMP(3),
    "isPcConfigLocked" BOOLEAN NOT NULL DEFAULT false,
    "questionPaperId" TEXT NOT NULL,
    "sessionId" TEXT,
    "createdById" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "totalMarks" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "passingMarks" DOUBLE PRECISION NOT NULL DEFAULT 40.0,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT false,
    "allowReview" BOOLEAN NOT NULL DEFAULT true,
    "autoSubmitOnTimeUp" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "resultVisibility" TEXT NOT NULL DEFAULT 'AFTER_PUBLISH',
    "resultPublished" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "institutionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamAttempt" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT,
    "pcHostname" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "clientIp" TEXT,
    "timeRemainingSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOption" TEXT,
    "answerText" TEXT,
    "isMarkedForReview" BOOLEAN NOT NULL DEFAULT false,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isEvaluated" BOOLEAN NOT NULL DEFAULT false,
    "isCorrect" BOOLEAN,
    "marksObtained" DOUBLE PRECISION NOT NULL DEFAULT 0.0,

    CONSTRAINT "ExamAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamResult" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT,
    "totalQuestions" INTEGER NOT NULL,
    "attemptedCount" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "wrongCount" INTEGER NOT NULL,
    "unansweredCount" INTEGER NOT NULL,
    "totalMarks" DOUBLE PRECISION NOT NULL,
    "obtainedMarks" DOUBLE PRECISION NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "grade" TEXT,
    "isPassed" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EVALUATED',
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbtPcRegistration" (
    "id" TEXT NOT NULL,
    "examId" TEXT,
    "sessionId" TEXT,
    "cbtCode" TEXT NOT NULL,
    "pcHostname" TEXT NOT NULL,
    "pcId" TEXT,
    "assignedStudentId" TEXT,
    "assignedStudentName" TEXT,
    "assignedStudentRegNo" TEXT,
    "assignedInvigilatorId" TEXT,
    "assignedInvigilatorName" TEXT,
    "isDobVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CbtPcRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthoritySetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'AUTHORITY_PASSWORD',
    "passwordHash" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthoritySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultCorrectionAudit" (
    "id" TEXT NOT NULL,
    "examResultId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "previousMarks" DOUBLE PRECISION NOT NULL,
    "newMarks" DOUBLE PRECISION NOT NULL,
    "previousGrade" TEXT,
    "newGrade" TEXT,
    "reason" TEXT,
    "correctedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultCorrectionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbtRegistrationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedByPc" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CbtRegistrationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "board" TEXT,
    "location" TEXT,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "institutionId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "activationKey" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "machineFingerprint" TEXT,
    "machineName" TEXT,
    "licenseType" TEXT NOT NULL DEFAULT 'PRO',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isActivated" BOOLEAN NOT NULL DEFAULT false,
    "maxPcs" INTEGER NOT NULL DEFAULT 100,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastValidatedAt" TIMESTAMP(3),
    "serverSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppTheme" (
    "id" TEXT NOT NULL,
    "targetInterface" TEXT NOT NULL DEFAULT 'GLOBAL',
    "themeName" TEXT NOT NULL,
    "themeMode" TEXT NOT NULL DEFAULT 'AUTO',
    "palette" TEXT NOT NULL DEFAULT 'DEFAULT',
    "primaryColor" TEXT NOT NULL DEFAULT '#2563EB',
    "secondaryColor" TEXT NOT NULL DEFAULT '#0F172A',
    "accentColor" TEXT NOT NULL DEFAULT '#22C55E',
    "backgroundColor" TEXT NOT NULL DEFAULT '#0F172A',
    "cardBackground" TEXT NOT NULL DEFAULT '#1E293B',
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "mutedTextColor" TEXT NOT NULL DEFAULT '#94A3B8',
    "buttonColor" TEXT NOT NULL DEFAULT '#2563EB',
    "buttonTextColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "headerColor" TEXT NOT NULL DEFAULT '#0F172A',
    "sidebarColor" TEXT NOT NULL DEFAULT '#0F172A',
    "borderColor" TEXT NOT NULL DEFAULT '#334155',
    "statusSuccess" TEXT NOT NULL DEFAULT '#22C55E',
    "statusWarning" TEXT NOT NULL DEFAULT '#F59E0B',
    "statusDanger" TEXT NOT NULL DEFAULT '#EF4444',
    "statusInfo" TEXT NOT NULL DEFAULT '#3B82F6',
    "logoUrl" TEXT,
    "institutionName" TEXT,
    "institutionBoard" TEXT,
    "institutionLocation" TEXT,
    "institutionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppTheme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionPaper_createdById_idx" ON "QuestionPaper"("createdById");

-- CreateIndex
CREATE INDEX "QuestionPaper_subject_idx" ON "QuestionPaper"("subject");

-- CreateIndex
CREATE INDEX "Question_questionPaperId_idx" ON "Question"("questionPaperId");

-- CreateIndex
CREATE INDEX "Question_orderIndex_idx" ON "Question"("orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Exam_cbtCode_key" ON "Exam"("cbtCode");

-- CreateIndex
CREATE INDEX "Exam_questionPaperId_idx" ON "Exam"("questionPaperId");

-- CreateIndex
CREATE INDEX "Exam_sessionId_idx" ON "Exam"("sessionId");

-- CreateIndex
CREATE INDEX "Exam_createdById_idx" ON "Exam"("createdById");

-- CreateIndex
CREATE INDEX "Exam_status_idx" ON "Exam"("status");

-- CreateIndex
CREATE INDEX "Exam_cbtCode_idx" ON "Exam"("cbtCode");

-- CreateIndex
CREATE INDEX "Exam_institutionId_idx" ON "Exam"("institutionId");

-- CreateIndex
CREATE INDEX "ExamAttempt_examId_idx" ON "ExamAttempt"("examId");

-- CreateIndex
CREATE INDEX "ExamAttempt_studentId_idx" ON "ExamAttempt"("studentId");

-- CreateIndex
CREATE INDEX "ExamAttempt_status_idx" ON "ExamAttempt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAttempt_examId_studentId_key" ON "ExamAttempt"("examId", "studentId");

-- CreateIndex
CREATE INDEX "ExamAnswer_attemptId_idx" ON "ExamAnswer"("attemptId");

-- CreateIndex
CREATE INDEX "ExamAnswer_questionId_idx" ON "ExamAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAnswer_attemptId_questionId_key" ON "ExamAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamResult_attemptId_key" ON "ExamResult"("attemptId");

-- CreateIndex
CREATE INDEX "ExamResult_examId_idx" ON "ExamResult"("examId");

-- CreateIndex
CREATE INDEX "ExamResult_studentId_idx" ON "ExamResult"("studentId");

-- CreateIndex
CREATE INDEX "ExamResult_status_idx" ON "ExamResult"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExamResult_examId_studentId_key" ON "ExamResult"("examId", "studentId");

-- CreateIndex
CREATE INDEX "CbtPcRegistration_cbtCode_idx" ON "CbtPcRegistration"("cbtCode");

-- CreateIndex
CREATE INDEX "CbtPcRegistration_sessionId_idx" ON "CbtPcRegistration"("sessionId");

-- CreateIndex
CREATE INDEX "CbtPcRegistration_examId_idx" ON "CbtPcRegistration"("examId");

-- CreateIndex
CREATE INDEX "CbtPcRegistration_pcHostname_idx" ON "CbtPcRegistration"("pcHostname");

-- CreateIndex
CREATE UNIQUE INDEX "CbtPcRegistration_cbtCode_pcHostname_key" ON "CbtPcRegistration"("cbtCode", "pcHostname");

-- CreateIndex
CREATE UNIQUE INDEX "AuthoritySetting_key_key" ON "AuthoritySetting"("key");

-- CreateIndex
CREATE INDEX "ResultCorrectionAudit_examResultId_idx" ON "ResultCorrectionAudit"("examResultId");

-- CreateIndex
CREATE INDEX "ResultCorrectionAudit_examId_idx" ON "ResultCorrectionAudit"("examId");

-- CreateIndex
CREATE INDEX "ResultCorrectionAudit_studentId_idx" ON "ResultCorrectionAudit"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CbtRegistrationCode_code_key" ON "CbtRegistrationCode"("code");

-- CreateIndex
CREATE INDEX "CbtRegistrationCode_code_idx" ON "CbtRegistrationCode"("code");

-- CreateIndex
CREATE INDEX "CbtRegistrationCode_isUsed_idx" ON "CbtRegistrationCode"("isUsed");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_code_key" ON "Institution"("code");

-- CreateIndex
CREATE INDEX "Institution_code_idx" ON "Institution"("code");

-- CreateIndex
CREATE INDEX "Institution_isActive_idx" ON "Institution"("isActive");

-- CreateIndex
CREATE INDEX "Department_institutionId_idx" ON "Department"("institutionId");

-- CreateIndex
CREATE INDEX "Department_isActive_idx" ON "Department"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Department_institutionId_name_key" ON "Department"("institutionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_institutionId_code_key" ON "Department"("institutionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "License_licenseNumber_key" ON "License"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "License_activationKey_key" ON "License"("activationKey");

-- CreateIndex
CREATE INDEX "License_licenseNumber_idx" ON "License"("licenseNumber");

-- CreateIndex
CREATE INDEX "License_activationKey_idx" ON "License"("activationKey");

-- CreateIndex
CREATE INDEX "License_institutionId_idx" ON "License"("institutionId");

-- CreateIndex
CREATE INDEX "License_machineFingerprint_idx" ON "License"("machineFingerprint");

-- CreateIndex
CREATE INDEX "License_status_idx" ON "License"("status");

-- CreateIndex
CREATE INDEX "AppTheme_targetInterface_idx" ON "AppTheme"("targetInterface");

-- CreateIndex
CREATE INDEX "AppTheme_isActive_idx" ON "AppTheme"("isActive");

-- CreateIndex
CREATE INDEX "User_institutionId_idx" ON "User"("institutionId");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSession_cbtCode_key" ON "ClassSession"("cbtCode");

-- CreateIndex
CREATE INDEX "ClassSession_cbtCode_idx" ON "ClassSession"("cbtCode");

-- CreateIndex
CREATE INDEX "ClassSession_institutionId_idx" ON "ClassSession"("institutionId");

-- CreateIndex
CREATE INDEX "Pc_lastSeen_idx" ON "Pc"("lastSeen");

-- CreateIndex
CREATE INDEX "Pc_institutionId_idx" ON "Pc"("institutionId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pc" ADD CONSTRAINT "Pc_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionPaper" ADD CONSTRAINT "QuestionPaper_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_questionPaperId_fkey" FOREIGN KEY ("questionPaperId") REFERENCES "QuestionPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_questionPaperId_fkey" FOREIGN KEY ("questionPaperId") REFERENCES "QuestionPaper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAnswer" ADD CONSTRAINT "ExamAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAnswer" ADD CONSTRAINT "ExamAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtPcRegistration" ADD CONSTRAINT "CbtPcRegistration_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultCorrectionAudit" ADD CONSTRAINT "ResultCorrectionAudit_examResultId_fkey" FOREIGN KEY ("examResultId") REFERENCES "ExamResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppTheme" ADD CONSTRAINT "AppTheme_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
