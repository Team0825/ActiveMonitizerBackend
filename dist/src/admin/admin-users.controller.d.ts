import { Request } from 'express';
import { JwtPayload } from '../auth/jwt.strategy';
import { AdminUsersService } from './admin-users.service';
import { CreateStudentDto, CreateTeacherDto, UpdateUserDto } from './dto/users.dto';
type AuthenticatedRequest = Request & {
    user: JwtPayload;
};
export declare class AdminUsersController {
    private readonly usersService;
    constructor(usersService: AdminUsersService);
    createStudent(req: AuthenticatedRequest, dto: CreateStudentDto): Promise<{
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
    createTeacher(req: AuthenticatedRequest, dto: CreateTeacherDto): Promise<{
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
    list(role?: 'STUDENT' | 'TEACHER', classId?: string): Promise<{
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
    update(id: string, dto: UpdateUserDto): Promise<{
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
    remove(id: string, hard?: string): Promise<{
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
}
export declare class TeacherStudentsController {
    private readonly usersService;
    constructor(usersService: AdminUsersService);
    listStudents(classId?: string): Promise<{
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
}
export {};
