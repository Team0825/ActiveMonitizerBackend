export declare class LoginDto {
    username: string;
    password: string;
    expectedRole?: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN';
    sessionId?: string;
    pcHostname?: string;
    forceLogin?: boolean;
    challengeId?: string;
}
