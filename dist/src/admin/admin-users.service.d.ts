import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto, CreateTeacherDto, UpdateUserDto } from './dto/users.dto';
export declare class AdminUsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createStudent(adminId: string, dto: CreateStudentDto): Promise<{
        id: string;
        username: string;
        regNumber: string | null;
        email: string | null;
        role: string;
        name: string | null;
        mobile: string | null;
        classId: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    createTeacher(adminId: string, dto: CreateTeacherDto): Promise<{
        id: string;
        username: string;
        regNumber: string | null;
        email: string | null;
        role: string;
        name: string | null;
        mobile: string | null;
        classId: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    listUsers(role?: 'STUDENT' | 'TEACHER', classId?: string): Promise<{
        id: string;
        username: string;
        regNumber: string | null;
        email: string | null;
        role: string;
        name: string | null;
        mobile: string | null;
        classId: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    updateUser(userId: string, dto: UpdateUserDto): Promise<{
        id: string;
        username: string;
        regNumber: string | null;
        email: string | null;
        role: string;
        name: string | null;
        mobile: string | null;
        classId: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteUser(userId: string, hard?: boolean): Promise<{
        id: string;
        username: string;
        regNumber: string | null;
        email: string | null;
        role: string;
        name: string | null;
        mobile: string | null;
        classId: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    private assertUnique;
    private safeSelect;
}
