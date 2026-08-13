import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly jwt;
    constructor(prisma: PrismaService, jwt: JwtService);
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
