import { PrismaService } from '../prisma/prisma.service';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto';
export declare class TeachersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getMyProfile(teacherId: string): Promise<{
        id: string;
        name: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        username: string;
        email: string | null;
        role: string;
        mobile: string | null;
    }>;
    updateMyProfile(teacherId: string, dto: UpdateTeacherProfileDto): Promise<{
        id: string;
        name: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        username: string;
        email: string | null;
        role: string;
        mobile: string | null;
    }>;
}
