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
            isSuperAdmin: boolean;
            username: string;
            name: string | null;
            email: string | null;
            mobile: string | null;
            regNumber: string | null;
            classId: string | null;
            institutionId: string | null;
            institution: {
                id: string;
                name: string;
                code: string;
                board: string | null;
                location: string | null;
            } | null;
            departmentId: string | null;
            department: {
                id: string;
                name: string;
                code: string;
            } | null;
            createdAt: string;
            lastLoginAt: string;
        };
        duplicateDetected?: undefined;
        challengeId?: undefined;
        remainingSeconds?: undefined;
        expiresAt?: undefined;
        message?: undefined;
    }>;
    getProfile(userId: string): Promise<{
        id: string;
        name: string;
        username: string;
        email: string;
        mobile: string;
        role: string;
        isSuperAdmin: boolean;
        institution: {
            id: string;
            name: string;
            code: string;
            board: string | null;
            location: string | null;
        } | {
            name: string;
            id?: undefined;
            code?: undefined;
            board?: undefined;
            location?: undefined;
        };
        department: {
            id: string;
            name: string;
            code: string;
        } | null;
        licenseNumber: string;
        activationStatus: string;
        createdAt: string;
        lastLoginAt: string;
    }>;
    updateProfile(userId: string, data: {
        name?: string;
        email?: string;
        mobile?: string;
    }): Promise<{
        id: string;
        name: string | null;
        updatedAt: Date;
        username: string;
        email: string | null;
        role: string;
        isSuperAdmin: boolean;
        mobile: string | null;
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
