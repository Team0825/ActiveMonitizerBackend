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
        name: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        institution: {
            id: string;
            code: string;
            name: string;
            board: string | null;
            location: string | null;
        } | null;
        institutionId: string | null;
        department: {
            id: string;
            code: string;
            name: string;
        } | null;
        username: string;
        regNumber: string | null;
        email: string | null;
        role: string;
        isSuperAdmin: boolean;
        mobile: string | null;
        classId: string | null;
        departmentId: string | null;
        lastLoginAt: Date | null;
    }>;
    createTeacher(req: AuthenticatedRequest, dto: CreateTeacherDto): Promise<{
        id: string;
        name: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        institution: {
            id: string;
            code: string;
            name: string;
            board: string | null;
            location: string | null;
        } | null;
        institutionId: string | null;
        department: {
            id: string;
            code: string;
            name: string;
        } | null;
        username: string;
        regNumber: string | null;
        email: string | null;
        role: string;
        isSuperAdmin: boolean;
        mobile: string | null;
        classId: string | null;
        departmentId: string | null;
        lastLoginAt: Date | null;
    }>;
    createAdmin(req: AuthenticatedRequest, dto: {
        name?: string;
        username: string;
        password: string;
        mobile?: string;
        email?: string;
    }): Promise<{
        id: string;
        name: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        institution: {
            id: string;
            code: string;
            name: string;
            board: string | null;
            location: string | null;
        } | null;
        institutionId: string | null;
        department: {
            id: string;
            code: string;
            name: string;
        } | null;
        username: string;
        regNumber: string | null;
        email: string | null;
        role: string;
        isSuperAdmin: boolean;
        mobile: string | null;
        classId: string | null;
        departmentId: string | null;
        lastLoginAt: Date | null;
    }>;
    list(req: AuthenticatedRequest, role?: 'STUDENT' | 'TEACHER' | 'ADMIN', classId?: string, institutionId?: string, departmentId?: string): Promise<{
        id: string;
        name: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        institution: {
            id: string;
            code: string;
            name: string;
            board: string | null;
            location: string | null;
        } | null;
        institutionId: string | null;
        department: {
            id: string;
            code: string;
            name: string;
        } | null;
        username: string;
        regNumber: string | null;
        email: string | null;
        role: string;
        isSuperAdmin: boolean;
        mobile: string | null;
        classId: string | null;
        departmentId: string | null;
        lastLoginAt: Date | null;
    }[]>;
    update(req: AuthenticatedRequest, id: string, dto: UpdateUserDto): Promise<{
        id: string;
        name: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        institution: {
            id: string;
            code: string;
            name: string;
            board: string | null;
            location: string | null;
        } | null;
        institutionId: string | null;
        department: {
            id: string;
            code: string;
            name: string;
        } | null;
        username: string;
        regNumber: string | null;
        email: string | null;
        role: string;
        isSuperAdmin: boolean;
        mobile: string | null;
        classId: string | null;
        departmentId: string | null;
        lastLoginAt: Date | null;
    }>;
    remove(req: AuthenticatedRequest, id: string, hard?: string): Promise<{
        id: string;
        name: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        institutionId: string | null;
        username: string;
        regNumber: string | null;
        email: string | null;
        role: string;
        isSuperAdmin: boolean;
        passwordHash: string;
        rollNumber: string | null;
        mobile: string | null;
        classId: string | null;
        departmentId: string | null;
        lastLoginAt: Date | null;
        lastActiveAt: Date | null;
        createdById: string | null;
    } | {
        id: string;
        name: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        institution: {
            id: string;
            code: string;
            name: string;
            board: string | null;
            location: string | null;
        } | null;
        institutionId: string | null;
        department: {
            id: string;
            code: string;
            name: string;
        } | null;
        username: string;
        regNumber: string | null;
        email: string | null;
        role: string;
        isSuperAdmin: boolean;
        mobile: string | null;
        classId: string | null;
        departmentId: string | null;
        lastLoginAt: Date | null;
    }>;
}
export declare class TeacherStudentsController {
    private readonly usersService;
    constructor(usersService: AdminUsersService);
    listStudents(classId?: string): Promise<{
        id: string;
        name: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        institution: {
            id: string;
            code: string;
            name: string;
            board: string | null;
            location: string | null;
        } | null;
        institutionId: string | null;
        department: {
            id: string;
            code: string;
            name: string;
        } | null;
        username: string;
        regNumber: string | null;
        email: string | null;
        role: string;
        isSuperAdmin: boolean;
        mobile: string | null;
        classId: string | null;
        departmentId: string | null;
        lastLoginAt: Date | null;
    }[]>;
}
export {};
