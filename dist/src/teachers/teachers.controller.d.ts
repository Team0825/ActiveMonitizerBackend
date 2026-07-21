import { Request } from 'express';
import { JwtPayload } from '../auth/jwt.strategy';
import { TeachersService } from './teachers.service';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto';
type AuthenticatedTeacherRequest = Request & {
    user: JwtPayload;
};
export declare class TeachersController {
    private readonly teachersService;
    constructor(teachersService: TeachersService);
    getMyProfile(req: AuthenticatedTeacherRequest): Promise<{
        id: string;
        username: string;
        email: string | null;
        role: string;
        name: string | null;
        mobile: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateMyProfile(req: AuthenticatedTeacherRequest, dto: UpdateTeacherProfileDto): Promise<{
        id: string;
        username: string;
        email: string | null;
        role: string;
        name: string | null;
        mobile: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
export {};
