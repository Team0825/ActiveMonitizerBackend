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
    constructor(prisma: PrismaService, jwt: JwtService, rateLimiter: RateLimiterService, pcsService: PcsService, realtimeService: SessionRealtimeService);
    login(dto: LoginDto): Promise<{
        accessToken: string;
        user: {
            id: string;
            role: "ADMIN" | "TEACHER" | "STUDENT";
            username: string;
            regNumber: string | null;
            classId: string | null;
        };
    }>;
    changePassword(userId: string, currentPass: string, newPass: string, confirmPass: string): Promise<{
        success: boolean;
        message: string;
    }>;
    private audit;
}
