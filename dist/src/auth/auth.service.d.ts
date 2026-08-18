import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RateLimiterService } from '../common/rate-limiter.service';
import { PcsService } from '../pcs/pcs.service';
import { SessionRealtimeService } from '../realtime/session-realtime.service';
export declare class AuthService {
    private readonly prisma;
    private readonly jwt;
    private readonly rateLimiter;
    private readonly pcsService;
    private readonly realtimeService;
    private readonly logger;
    private readonly activeStaffSessions;
    private readonly pendingChallenges;
    constructor(prisma: PrismaService, jwt: JwtService, rateLimiter: RateLimiterService, pcsService: PcsService, realtimeService: SessionRealtimeService);
    login(dto: LoginDto): Promise<{
        duplicateDetected: boolean;
        challengeId: string;
        remainingSeconds: number;
        expiresAt: string;
        message: string;
        accessToken?: undefined;
        user?: undefined;
    } | {
        accessToken: string;
        user: {
            id: string;
            role: "ADMIN" | "TEACHER" | "STUDENT";
            username: string;
            name: string | null;
            regNumber: string | null;
            classId: string | null;
        };
        duplicateDetected?: undefined;
        challengeId?: undefined;
        remainingSeconds?: undefined;
        expiresAt?: undefined;
        message?: undefined;
    }>;
    keepSession(userId: string, challengeId?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    checkChallengeStatus(challengeId: string): Promise<{
        status: string;
        allowed: boolean;
        message?: undefined;
        remainingSeconds?: undefined;
        expiresAt?: undefined;
    } | {
        status: string;
        allowed: boolean;
        message: string;
        remainingSeconds?: undefined;
        expiresAt?: undefined;
    } | {
        status: string;
        allowed: boolean;
        remainingSeconds: number;
        expiresAt: string;
        message?: undefined;
    }>;
    changePassword(userId: string, currentPass: string, newPass: string, confirmPass: string): Promise<{
        success: boolean;
        message: string;
    }>;
    private audit;
}
