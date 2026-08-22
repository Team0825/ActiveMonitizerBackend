"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminUsersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = require("bcrypt");
const prisma_service_1 = require("../prisma/prisma.service");
let AdminUsersService = class AdminUsersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDefaultInstitutionId() {
        const inst = await this.prisma.institution.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
        });
        return inst?.id;
    }
    async createStudent(adminId, dto) {
        await this.assertUnique(dto.username, dto.regNumber, dto.email);
        const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
        const institutionId = dto.institutionId || admin?.institutionId || (await this.getDefaultInstitutionId());
        const passwordHash = await bcrypt.hash(dto.password, 10);
        return this.prisma.user.create({
            data: {
                role: 'STUDENT',
                username: dto.username.trim(),
                name: dto.name?.trim() || null,
                passwordHash,
                regNumber: dto.regNumber.trim(),
                mobile: dto.mobile?.trim() || null,
                email: dto.email?.trim() || null,
                classId: dto.classId?.trim() || null,
                dateOfBirth: dto.dateOfBirth?.trim() || null,
                semester: dto.semester?.trim() || null,
                departmentId: dto.departmentId || null,
                institutionId: institutionId || null,
                createdById: adminId,
                isActive: true,
            },
            select: this.safeSelect(),
        });
    }
    async createTeacher(adminId, dto) {
        await this.assertUnique(dto.username, undefined, dto.email);
        const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
        const institutionId = dto.institutionId || admin?.institutionId || (await this.getDefaultInstitutionId());
        const passwordHash = await bcrypt.hash(dto.password, 10);
        return this.prisma.user.create({
            data: {
                role: 'TEACHER',
                name: dto.name?.trim() || null,
                username: dto.username.trim(),
                passwordHash,
                mobile: dto.mobile?.trim() || null,
                email: dto.email?.trim() || null,
                departmentId: dto.departmentId || null,
                institutionId: institutionId || null,
                createdById: adminId,
                isActive: true,
            },
            select: this.safeSelect(),
        });
    }
    async createAdmin(adminId, dto) {
        const creator = await this.prisma.user.findUnique({ where: { id: adminId } });
        if (!creator?.isSuperAdmin && creator?.role !== 'SUPER_ADMIN') {
            throw new common_1.ForbiddenException('Only Super Admin can create Administrator accounts.');
        }
        await this.assertUnique(dto.username, undefined, dto.email);
        const institutionId = dto.institutionId || creator.institutionId || (await this.getDefaultInstitutionId());
        const passwordHash = await bcrypt.hash(dto.password, 10);
        return this.prisma.user.create({
            data: {
                role: 'ADMIN',
                isSuperAdmin: false,
                name: dto.name?.trim() || null,
                username: dto.username.trim(),
                passwordHash,
                mobile: dto.mobile?.trim() || null,
                email: dto.email?.trim() || null,
                institutionId: institutionId || null,
                createdById: adminId,
                isActive: true,
            },
            select: this.safeSelect(),
        });
    }
    async listUsers(role, classId, institutionId, departmentId) {
        return this.prisma.user.findMany({
            where: {
                ...(role ? { role } : {}),
                ...(classId ? { classId } : {}),
                ...(institutionId ? { institutionId } : {}),
                ...(departmentId ? { departmentId } : {}),
            },
            select: this.safeSelect(),
            orderBy: { createdAt: 'desc' },
        });
    }
    async updateUser(userId, dto, callerId) {
        const existing = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!existing) {
            throw new common_1.NotFoundException('User not found');
        }
        if (callerId) {
            const caller = await this.prisma.user.findUnique({ where: { id: callerId } });
            if (existing.isSuperAdmin && (!caller?.isSuperAdmin && caller?.role !== 'SUPER_ADMIN')) {
                throw new common_1.ForbiddenException('Only Super Admin can modify the Super Admin account.');
            }
            if (existing.role === 'ADMIN' &&
                existing.id !== callerId &&
                (!caller?.isSuperAdmin && caller?.role !== 'SUPER_ADMIN')) {
                throw new common_1.ForbiddenException('Administrators cannot modify another Administrator account. Contact Super Admin.');
            }
        }
        if (dto.username && dto.username.trim() !== existing.username) {
            const usernameExists = await this.prisma.user.findUnique({
                where: { username: dto.username.trim() },
            });
            if (usernameExists)
                throw new common_1.ConflictException('Username already in use');
        }
        if (dto.regNumber && dto.regNumber.trim() !== existing.regNumber) {
            const regNumberExists = await this.prisma.user.findUnique({
                where: { regNumber: dto.regNumber.trim() },
            });
            if (regNumberExists)
                throw new common_1.ConflictException('Registration number already in use');
        }
        if (dto.email && dto.email.trim() !== existing.email) {
            const emailExists = await this.prisma.user.findUnique({
                where: { email: dto.email.trim() },
            });
            if (emailExists)
                throw new common_1.ConflictException('Email already in use');
        }
        const data = {};
        if (dto.name !== undefined)
            data.name = dto.name.trim() || null;
        if (dto.username !== undefined)
            data.username = dto.username.trim();
        if (dto.regNumber !== undefined)
            data.regNumber = dto.regNumber.trim() || null;
        if (dto.mobile !== undefined)
            data.mobile = dto.mobile.trim() || null;
        if (dto.email !== undefined)
            data.email = dto.email.trim() || null;
        if (dto.classId !== undefined)
            data.classId = dto.classId.trim() || null;
        if (dto.dateOfBirth !== undefined)
            data.dateOfBirth = dto.dateOfBirth.trim() || null;
        if (dto.semester !== undefined)
            data.semester = dto.semester.trim() || null;
        if (dto.departmentId !== undefined)
            data.departmentId = dto.departmentId || null;
        if (dto.institutionId !== undefined)
            data.institutionId = dto.institutionId || null;
        if (dto.isActive !== undefined)
            data.isActive = dto.isActive;
        if (dto.password && dto.password.trim()) {
            data.passwordHash = await bcrypt.hash(dto.password, 10);
        }
        return this.prisma.user.update({
            where: { id: userId },
            data,
            select: this.safeSelect(),
        });
    }
    async deleteUser(userId, hard = false, callerId) {
        const existing = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                _count: {
                    select: {
                        examAttempts: true,
                        examResults: true,
                        sessionsAsTeacher: true,
                        questionPapers: true,
                        examsCreated: true,
                        attendanceRecords: true,
                        participations: true,
                    },
                },
            },
        });
        if (!existing)
            throw new common_1.NotFoundException('User not found');
        if (existing.isSuperAdmin) {
            throw new common_1.ForbiddenException('Super Admin account cannot be deleted or disabled.');
        }
        if (callerId) {
            if (existing.id === callerId) {
                throw new common_1.ForbiddenException('You cannot delete or deactivate your own currently logged-in account.');
            }
            const caller = await this.prisma.user.findUnique({ where: { id: callerId } });
            if (existing.role === 'ADMIN' &&
                existing.id !== callerId &&
                (!caller?.isSuperAdmin && caller?.role !== 'SUPER_ADMIN')) {
                throw new common_1.ForbiddenException('Administrators cannot delete other Administrators.');
            }
        }
        await this.prisma.cbtPcRegistration.updateMany({
            where: { assignedStudentId: userId },
            data: {
                assignedStudentId: null,
                assignedStudentName: null,
                assignedStudentRegNo: null,
                status: 'AVAILABLE',
            },
        });
        const hasHistory = existing._count.examAttempts > 0 ||
            existing._count.examResults > 0 ||
            existing._count.sessionsAsTeacher > 0 ||
            existing._count.questionPapers > 0 ||
            existing._count.examsCreated > 0 ||
            existing._count.attendanceRecords > 0 ||
            existing._count.participations > 0;
        if (hard && !hasHistory) {
            return this.prisma.user.delete({ where: { id: userId } });
        }
        return this.prisma.user.update({
            where: { id: userId },
            data: { isActive: false },
            select: this.safeSelect(),
        });
    }
    async assertUnique(username, regNumber, email) {
        const normalizedUsername = username.trim();
        const normalizedRegNumber = regNumber?.trim();
        const normalizedEmail = email?.trim();
        const clashes = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { username: normalizedUsername },
                    ...(normalizedRegNumber ? [{ regNumber: normalizedRegNumber }] : []),
                    ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
                ],
            },
        });
        if (clashes) {
            if (clashes.username === normalizedUsername)
                throw new common_1.ConflictException('Username already in use');
            if (normalizedRegNumber && clashes.regNumber === normalizedRegNumber)
                throw new common_1.ConflictException('Registration number already in use');
            if (normalizedEmail && clashes.email === normalizedEmail)
                throw new common_1.ConflictException('Email already in use');
            throw new common_1.ConflictException('User information already in use');
        }
    }
    safeSelect() {
        return {
            id: true,
            role: true,
            isSuperAdmin: true,
            name: true,
            username: true,
            regNumber: true,
            mobile: true,
            email: true,
            classId: true,
            dateOfBirth: true,
            semester: true,
            departmentId: true,
            department: {
                select: {
                    id: true,
                    name: true,
                    code: true,
                },
            },
            institutionId: true,
            institution: {
                select: {
                    id: true,
                    name: true,
                    code: true,
                    board: true,
                    location: true,
                },
            },
            isActive: true,
            createdAt: true,
            updatedAt: true,
            lastLoginAt: true,
        };
    }
};
exports.AdminUsersService = AdminUsersService;
exports.AdminUsersService = AdminUsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminUsersService);
//# sourceMappingURL=admin-users.service.js.map