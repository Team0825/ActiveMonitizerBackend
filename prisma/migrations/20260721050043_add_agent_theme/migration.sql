-- CreateTable
CREATE TABLE "AgentTheme" (
    "id" TEXT NOT NULL,
    "themeName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "mainBubbleBgColor" TEXT NOT NULL DEFAULT '#1E293B',
    "secondaryPanelColor" TEXT NOT NULL DEFAULT '#0F172A',
    "borderColor" TEXT NOT NULL DEFAULT '#334155',
    "accentColor" TEXT NOT NULL DEFAULT '#22C55E',
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "mutedTextColor" TEXT NOT NULL DEFAULT '#94A3B8',
    "buttonColor" TEXT NOT NULL DEFAULT '#334155',
    "buttonTextColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "progressBarAppearance" TEXT NOT NULL DEFAULT 'DEFAULT',
    "opacity" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "cornerRadius" INTEGER NOT NULL DEFAULT 20,
    "baseFontSize" INTEGER NOT NULL DEFAULT 12,
    "sessionTitleLabel" TEXT NOT NULL DEFAULT 'Active Session',
    "timerLabel" TEXT NOT NULL DEFAULT 'TIME REMAINING',
    "pcActivityLabel" TEXT NOT NULL DEFAULT 'PC ACTIVITY',
    "agentStatusText" TEXT NOT NULL DEFAULT 'Agent: Running',
    "networkStatusText" TEXT NOT NULL DEFAULT 'Network: Healthy',
    "minimizeButtonLabel" TEXT NOT NULL DEFAULT 'MINIMIZE',
    "closeButtonLabel" TEXT NOT NULL DEFAULT 'CLOSE',
    "sendReplyButtonLabel" TEXT NOT NULL DEFAULT 'SEND REPLY',
    "defaultInformationalText" TEXT NOT NULL DEFAULT 'Session is active. Keep this Activity Monitor running.',
    "organizationLogoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTheme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentTheme_themeName_key" ON "AgentTheme"("themeName");

-- CreateIndex
CREATE INDEX "AgentTheme_isActive_idx" ON "AgentTheme"("isActive");
