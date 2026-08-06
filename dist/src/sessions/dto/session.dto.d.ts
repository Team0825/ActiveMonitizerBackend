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
    allowOffline?: boolean;
    restrictExistingFiles?: boolean;
    restrictUnauthorizedApps?: boolean;
    freezeOnEnd?: boolean;
    warningMinutes?: number;
    screenshotInterval?: number;
    instructions?: string;
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
