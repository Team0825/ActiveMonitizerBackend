export declare class CreateSessionDto {
    classTitle: string;
    durationMinutes: number;
    joinWindowMinutes?: number;
    sessionMode?: 'LAB' | 'EXAM' | 'VIVA';
    allowInternet?: boolean;
    allowClipboard?: boolean;
    allowUsb?: boolean;
    allowTaskManager?: boolean;
    allowAltTab?: boolean;
    allowWindowsKey?: boolean;
    allowPrintScreen?: boolean;
    allowAiAssistant?: boolean;
    allowOffline?: boolean;
    connectivityMode?: 'ONLINE_ONLY' | 'OFFLINE_ONLY' | 'HYBRID';
    websiteAccessMode?: 'NORMAL' | 'ALLOWED_ONLY' | 'BLOCKED';
    restrictExistingFiles?: boolean;
    restrictUnauthorizedApps?: boolean;
    activityMonitoring?: boolean;
    activityUpdateInterval?: number;
    activitySensitivity?: 'LOW' | 'NORMAL' | 'HIGH';
    idleThresholdSeconds?: number;
    violationSensitivity?: 'LOW' | 'NORMAL' | 'HIGH';
    freezeOnEnd?: boolean;
    warningMinutes?: number;
    screenshotInterval?: number;
    instructions?: string;
    startupUrl?: string;
    questionMode?: 'COMMON' | 'INDIVIDUAL' | 'GROUP';
    allowedWebsites?: string[];
    blockedWebsites?: string[];
    allowedApplications?: string[];
    blockedApplications?: string[];
}
export declare class JoinSessionDto {
    sessionId: string;
    regNumber: string;
    pcHostname?: string;
}
export declare class RequestSpecialAccessDto {
    sessionId: string;
}
export declare class HandleAccessRequestDto {
    requestId: string;
    approve: boolean;
}
export declare class GenerateRecoveryCodeDto {
    sessionId: string;
    studentIdOrReg: string;
    hostname?: string;
    reason?: string;
}
export declare class ValidateRecoveryCodeDto {
    recoveryCode: string;
    pcHostname?: string;
}
