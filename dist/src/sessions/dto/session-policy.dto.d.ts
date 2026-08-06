export declare class UpdateSessionPolicyDto {
    allowInternet?: boolean;
    allowClipboard?: boolean;
    allowUsb?: boolean;
    allowTaskManager?: boolean;
    allowAltTab?: boolean;
    allowWindowsKey?: boolean;
    allowPrintScreen?: boolean;
    freezeOnEnd?: boolean;
    allowOffline?: boolean;
    restrictExistingFiles?: boolean;
    restrictUnauthorizedApps?: boolean;
    sessionMode?: 'LAB' | 'EXAM' | 'VIVA';
    questionMode?: 'COMMON' | 'INDIVIDUAL' | 'GROUP';
    screenshotInterval?: number;
    warningMinutes?: number;
    instructions?: string;
    startupUrl?: string;
    allowedWebsites?: string[];
    blockedWebsites?: string[];
    allowedApplications?: string[];
    blockedApplications?: string[];
}
