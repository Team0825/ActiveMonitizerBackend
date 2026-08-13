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
        accessToken: string;
        user: {
            id: string;
            role: "ADMIN" | "TEACHER" | "STUDENT";
            username: string;
            regNumber: string | null;
            classId: string | null;
        };
    }>;
    changePassword(req: AuthenticatedRequest, dto: ChangePasswordDto): Promise<{
        success: boolean;
        message: string;
    }>;
}
export {};
