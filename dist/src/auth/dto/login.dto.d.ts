export declare class LoginDto {
    username: string;
    password: string;
    expectedRole: 'STUDENT' | 'TEACHER' | 'ADMIN';
    sessionId?: string;
    pcHostname?: string;
}
