import { PrismaService } from '../prisma/prisma.service';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto';
export declare class TeachersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getMyProfile(teacherId: string): Promise<{
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
    updateMyProfile(teacherId: string, dto: UpdateTeacherProfileDto): Promise<{
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
