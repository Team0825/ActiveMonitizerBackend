export declare class CreateSessionDto {
    classTitle: string;
    durationMinutes: number;
    joinWindowMinutes?: number;
    allowedSites?: string[];
    blockedSites?: string[];
    sessionMode?: 'LAB' | 'EXAM' | 'VIVA';
    allowOffline?: boolean;
    restrictExistingFiles?: boolean;
    restrictUnauthorizedApps?: boolean;
    freezeOnEnd?: boolean;
    warningMinutes?: number;
    instructions?: string;
    questionMode?: 'COMMON' | 'INDIVIDUAL' | 'GROUP';
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
