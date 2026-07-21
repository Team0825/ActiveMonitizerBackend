import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
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
}
