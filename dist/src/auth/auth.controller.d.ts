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
        success?: undefined;
        accessToken?: undefined;
        token?: undefined;
        access_token?: undefined;
        user?: undefined;
    } | {
        success: boolean;
        accessToken: string;
        token: string;
        access_token: string;
        expiresAt: string;
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
            institutionName: string | null;
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
        message?: undefined;
    }>;
    logout(req: AuthenticatedRequest): Promise<{
        success: boolean;
        message: string;
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
    getProfileGet(req: AuthenticatedRequest): Promise<{
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
    getProfilePost(req: AuthenticatedRequest): Promise<{
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
    updateProfile(req: AuthenticatedRequest, body: {
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
}
export {};
