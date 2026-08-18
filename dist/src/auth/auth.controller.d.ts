import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './jwt.strategy';
type AuthenticatedRequest = Request & {
    user: JwtPayload;
};
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
    keepSession(req: AuthenticatedRequest, dto: {
        challengeId?: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    checkChallenge(dto: {
        challengeId: string;
    }): Promise<{
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
    changePassword(req: AuthenticatedRequest, dto: ChangePasswordDto): Promise<{
        success: boolean;
        message: string;
    }>;
}
export {};
