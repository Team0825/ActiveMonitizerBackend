import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminDto, CreateStudentDto, CreateTeacherDto, UpdateUserDto } from './dto/users.dto';
export declare class AdminUsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private getDefaultInstitutionId;
    createStudent(adminId: string, dto: CreateStudentDto): Promise<{
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
    createTeacher(adminId: string, dto: CreateTeacherDto): Promise<{
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
    createAdmin(adminId: string, dto: CreateAdminDto): Promise<{
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
    listUsers(role?: 'STUDENT' | 'TEACHER' | 'ADMIN', classId?: string, institutionId?: string, departmentId?: string): Promise<{
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
    updateUser(userId: string, dto: UpdateUserDto, callerId?: string): Promise<{
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
    deleteUser(userId: string, hard?: boolean, callerId?: string): Promise<{
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
        dateOfBirth: string | null;
        semester: string | null;
        departmentName: string | null;
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
    private assertUnique;
    private safeSelect;
}
