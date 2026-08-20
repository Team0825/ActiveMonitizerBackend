-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dateOfBirth" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "departmentName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "semester" TEXT;

-- AlterTable ClassSession
ALTER TABLE "ClassSession" ADD COLUMN IF NOT EXISTS "activityMonitoring" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ClassSession" ADD COLUMN IF NOT EXISTS "activitySensitivity" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "ClassSession" ADD COLUMN IF NOT EXISTS "activityUpdateInterval" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "ClassSession" ADD COLUMN IF NOT EXISTS "cbtCode" TEXT;
ALTER TABLE "ClassSession" ADD COLUMN IF NOT EXISTS "connectivityMode" TEXT NOT NULL DEFAULT 'HYBRID';
ALTER TABLE "ClassSession" ADD COLUMN IF NOT EXISTS "idleThresholdSeconds" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "ClassSession" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "ClassSession" ADD COLUMN IF NOT EXISTS "violationSensitivity" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "ClassSession" ADD COLUMN IF NOT EXISTS "websiteAccessMode" TEXT NOT NULL DEFAULT 'NORMAL';

-- AlterTable Pc
ALTER TABLE "Pc" ADD COLUMN IF NOT EXISTS "assignedInvigilatorId" TEXT;
ALTER TABLE "Pc" ADD COLUMN IF NOT EXISTS "assignedStudentId" TEXT;
ALTER TABLE "Pc" ADD COLUMN IF NOT EXISTS "cbtStatus" TEXT NOT NULL DEFAULT 'IDLE';
ALTER TABLE "Pc" ADD COLUMN IF NOT EXISTS "emergencyTerminationEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Pc" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "Pc" ADD COLUMN IF NOT EXISTS "osArchitecture" TEXT;

-- CreateTable QuestionPaper
CREATE TABLE IF NOT EXISTS "QuestionPaper" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "totalMarks" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "passingMarks" DOUBLE PRECISION NOT NULL DEFAULT 40.0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionPaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable Question
CREATE TABLE IF NOT EXISTS "Question" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable Exam
CREATE TABLE IF NOT EXISTS "Exam" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable ExamAttempt
CREATE TABLE IF NOT EXISTS "ExamAttempt" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable ExamAnswer
CREATE TABLE IF NOT EXISTS "ExamAnswer" (
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

-- CreateTable ExamResult
CREATE TABLE IF NOT EXISTS "ExamResult" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable CbtPcRegistration
CREATE TABLE IF NOT EXISTS "CbtPcRegistration" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CbtPcRegistration_pkey" PRIMARY KEY ("id")
);

-- AlterTable CbtPcRegistration columns if table previously existed
ALTER TABLE "CbtPcRegistration" ADD COLUMN IF NOT EXISTS "assignedStudentId" TEXT;
ALTER TABLE "CbtPcRegistration" ADD COLUMN IF NOT EXISTS "assignedStudentName" TEXT;
ALTER TABLE "CbtPcRegistration" ADD COLUMN IF NOT EXISTS "assignedStudentRegNo" TEXT;
ALTER TABLE "CbtPcRegistration" ADD COLUMN IF NOT EXISTS "assignedInvigilatorId" TEXT;
ALTER TABLE "CbtPcRegistration" ADD COLUMN IF NOT EXISTS "assignedInvigilatorName" TEXT;
ALTER TABLE "CbtPcRegistration" ADD COLUMN IF NOT EXISTS "isDobVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable AuthoritySetting
CREATE TABLE IF NOT EXISTS "AuthoritySetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'AUTHORITY_PASSWORD',
    "passwordHash" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthoritySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable ResultCorrectionAudit
CREATE TABLE IF NOT EXISTS "ResultCorrectionAudit" (
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

-- CreateTable CbtRegistrationCode
CREATE TABLE IF NOT EXISTS "CbtRegistrationCode" (
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

-- CreateTable Institution
CREATE TABLE IF NOT EXISTS "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "board" TEXT,
    "location" TEXT,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable Department
CREATE TABLE IF NOT EXISTS "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "institutionId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable License
CREATE TABLE IF NOT EXISTS "License" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable AppTheme
CREATE TABLE IF NOT EXISTS "AppTheme" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppTheme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuestionPaper_createdById_idx" ON "QuestionPaper"("createdById");
CREATE INDEX IF NOT EXISTS "QuestionPaper_subject_idx" ON "QuestionPaper"("subject");
CREATE INDEX IF NOT EXISTS "Question_questionPaperId_idx" ON "Question"("questionPaperId");
CREATE INDEX IF NOT EXISTS "Question_orderIndex_idx" ON "Question"("orderIndex");
CREATE UNIQUE INDEX IF NOT EXISTS "Exam_cbtCode_key" ON "Exam"("cbtCode");
CREATE INDEX IF NOT EXISTS "Exam_questionPaperId_idx" ON "Exam"("questionPaperId");
CREATE INDEX IF NOT EXISTS "Exam_sessionId_idx" ON "Exam"("sessionId");
CREATE INDEX IF NOT EXISTS "Exam_createdById_idx" ON "Exam"("createdById");
CREATE INDEX IF NOT EXISTS "Exam_status_idx" ON "Exam"("status");
CREATE INDEX IF NOT EXISTS "Exam_cbtCode_idx" ON "Exam"("cbtCode");
CREATE INDEX IF NOT EXISTS "Exam_institutionId_idx" ON "Exam"("institutionId");
CREATE INDEX IF NOT EXISTS "ExamAttempt_examId_idx" ON "ExamAttempt"("examId");
CREATE INDEX IF NOT EXISTS "ExamAttempt_studentId_idx" ON "ExamAttempt"("studentId");
CREATE INDEX IF NOT EXISTS "ExamAttempt_status_idx" ON "ExamAttempt"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "ExamAttempt_examId_studentId_key" ON "ExamAttempt"("examId", "studentId");
CREATE INDEX IF NOT EXISTS "ExamAnswer_attemptId_idx" ON "ExamAnswer"("attemptId");
CREATE INDEX IF NOT EXISTS "ExamAnswer_questionId_idx" ON "ExamAnswer"("questionId");
CREATE UNIQUE INDEX IF NOT EXISTS "ExamAnswer_attemptId_questionId_key" ON "ExamAnswer"("attemptId", "questionId");
CREATE UNIQUE INDEX IF NOT EXISTS "ExamResult_attemptId_key" ON "ExamResult"("attemptId");
CREATE INDEX IF NOT EXISTS "ExamResult_examId_idx" ON "ExamResult"("examId");
CREATE INDEX IF NOT EXISTS "ExamResult_studentId_idx" ON "ExamResult"("studentId");
CREATE INDEX IF NOT EXISTS "ExamResult_status_idx" ON "ExamResult"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "ExamResult_examId_studentId_key" ON "ExamResult"("examId", "studentId");
CREATE INDEX IF NOT EXISTS "CbtPcRegistration_cbtCode_idx" ON "CbtPcRegistration"("cbtCode");
CREATE INDEX IF NOT EXISTS "CbtPcRegistration_sessionId_idx" ON "CbtPcRegistration"("sessionId");
CREATE INDEX IF NOT EXISTS "CbtPcRegistration_examId_idx" ON "CbtPcRegistration"("examId");
CREATE INDEX IF NOT EXISTS "CbtPcRegistration_pcHostname_idx" ON "CbtPcRegistration"("pcHostname");
CREATE UNIQUE INDEX IF NOT EXISTS "CbtPcRegistration_cbtCode_pcHostname_key" ON "CbtPcRegistration"("cbtCode", "pcHostname");
CREATE UNIQUE INDEX IF NOT EXISTS "AuthoritySetting_key_key" ON "AuthoritySetting"("key");
CREATE INDEX IF NOT EXISTS "ResultCorrectionAudit_examResultId_idx" ON "ResultCorrectionAudit"("examResultId");
CREATE INDEX IF NOT EXISTS "ResultCorrectionAudit_examId_idx" ON "ResultCorrectionAudit"("examId");
CREATE INDEX IF NOT EXISTS "ResultCorrectionAudit_studentId_idx" ON "ResultCorrectionAudit"("studentId");
CREATE UNIQUE INDEX IF NOT EXISTS "CbtRegistrationCode_code_key" ON "CbtRegistrationCode"("code");
CREATE INDEX IF NOT EXISTS "CbtRegistrationCode_code_idx" ON "CbtRegistrationCode"("code");
CREATE INDEX IF NOT EXISTS "CbtRegistrationCode_isUsed_idx" ON "CbtRegistrationCode"("isUsed");
CREATE UNIQUE INDEX IF NOT EXISTS "Institution_code_key" ON "Institution"("code");
CREATE INDEX IF NOT EXISTS "Institution_code_idx" ON "Institution"("code");
CREATE INDEX IF NOT EXISTS "Institution_isActive_idx" ON "Institution"("isActive");
CREATE INDEX IF NOT EXISTS "Department_institutionId_idx" ON "Department"("institutionId");
CREATE INDEX IF NOT EXISTS "Department_isActive_idx" ON "Department"("isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "Department_institutionId_name_key" ON "Department"("institutionId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "Department_institutionId_code_key" ON "Department"("institutionId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "License_licenseNumber_key" ON "License"("licenseNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "License_activationKey_key" ON "License"("activationKey");
CREATE INDEX IF NOT EXISTS "License_licenseNumber_idx" ON "License"("licenseNumber");
CREATE INDEX IF NOT EXISTS "License_activationKey_idx" ON "License"("activationKey");
CREATE INDEX IF NOT EXISTS "License_institutionId_idx" ON "License"("institutionId");
CREATE INDEX IF NOT EXISTS "License_machineFingerprint_idx" ON "License"("machineFingerprint");
CREATE INDEX IF NOT EXISTS "License_status_idx" ON "License"("status");
CREATE INDEX IF NOT EXISTS "AppTheme_targetInterface_idx" ON "AppTheme"("targetInterface");
CREATE INDEX IF NOT EXISTS "AppTheme_isActive_idx" ON "AppTheme"("isActive");
CREATE INDEX IF NOT EXISTS "User_institutionId_idx" ON "User"("institutionId");
CREATE INDEX IF NOT EXISTS "User_departmentId_idx" ON "User"("departmentId");
CREATE UNIQUE INDEX IF NOT EXISTS "ClassSession_cbtCode_key" ON "ClassSession"("cbtCode");
CREATE INDEX IF NOT EXISTS "ClassSession_cbtCode_idx" ON "ClassSession"("cbtCode");
CREATE INDEX IF NOT EXISTS "ClassSession_institutionId_idx" ON "ClassSession"("institutionId");
CREATE INDEX IF NOT EXISTS "Pc_lastSeen_idx" ON "Pc"("lastSeen");
CREATE INDEX IF NOT EXISTS "Pc_institutionId_idx" ON "Pc"("institutionId");

-- AddForeignKeys safely
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_institutionId_fkey') THEN
        ALTER TABLE "User" ADD CONSTRAINT "User_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_departmentId_fkey') THEN
        ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassSession_institutionId_fkey') THEN
        ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Pc_institutionId_fkey') THEN
        ALTER TABLE "Pc" ADD CONSTRAINT "Pc_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuestionPaper_createdById_fkey') THEN
        ALTER TABLE "QuestionPaper" ADD CONSTRAINT "QuestionPaper_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Question_questionPaperId_fkey') THEN
        ALTER TABLE "Question" ADD CONSTRAINT "Question_questionPaperId_fkey" FOREIGN KEY ("questionPaperId") REFERENCES "QuestionPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Exam_questionPaperId_fkey') THEN
        ALTER TABLE "Exam" ADD CONSTRAINT "Exam_questionPaperId_fkey" FOREIGN KEY ("questionPaperId") REFERENCES "QuestionPaper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Exam_sessionId_fkey') THEN
        ALTER TABLE "Exam" ADD CONSTRAINT "Exam_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Exam_createdById_fkey') THEN
        ALTER TABLE "Exam" ADD CONSTRAINT "Exam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Exam_institutionId_fkey') THEN
        ALTER TABLE "Exam" ADD CONSTRAINT "Exam_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExamAttempt_examId_fkey') THEN
        ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExamAttempt_studentId_fkey') THEN
        ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExamAnswer_attemptId_fkey') THEN
        ALTER TABLE "ExamAnswer" ADD CONSTRAINT "ExamAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExamAnswer_questionId_fkey') THEN
        ALTER TABLE "ExamAnswer" ADD CONSTRAINT "ExamAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExamResult_examId_fkey') THEN
        ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExamResult_attemptId_fkey') THEN
        ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExamResult_studentId_fkey') THEN
        ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CbtPcRegistration_examId_fkey') THEN
        ALTER TABLE "CbtPcRegistration" ADD CONSTRAINT "CbtPcRegistration_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ResultCorrectionAudit_examResultId_fkey') THEN
        ALTER TABLE "ResultCorrectionAudit" ADD CONSTRAINT "ResultCorrectionAudit_examResultId_fkey" FOREIGN KEY ("examResultId") REFERENCES "ExamResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Department_institutionId_fkey') THEN
        ALTER TABLE "Department" ADD CONSTRAINT "Department_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'License_institutionId_fkey') THEN
        ALTER TABLE "License" ADD CONSTRAINT "License_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppTheme_institutionId_fkey') THEN
        ALTER TABLE "AppTheme" ADD CONSTRAINT "AppTheme_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
