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
    async createStudent(adminId, dto) {
        await this.assertUnique(dto.username, dto.regNumber, dto.email);
        const passwordHash = await bcrypt.hash(dto.password, 10);
        return this.prisma.user.create({
            data: {
                role: 'STUDENT',
                username: dto.username.trim(),
                passwordHash,
                regNumber: dto.regNumber.trim(),
                mobile: dto.mobile?.trim() ||
                    null,
                email: dto.email?.trim() ||
                    null,
                classId: dto.classId?.trim() ||
                    null,
                createdById: adminId,
                isActive: true,
            },
            select: this.safeSelect(),
        });
    }
    async createTeacher(adminId, dto) {
        await this.assertUnique(dto.username, undefined, dto.email);
        const passwordHash = await bcrypt.hash(dto.password, 10);
        return this.prisma.user.create({
            data: {
                role: 'TEACHER',
                name: dto.name?.trim() ||
                    null,
                username: dto.username.trim(),
                passwordHash,
                mobile: dto.mobile?.trim() ||
                    null,
                email: dto.email?.trim() ||
                    null,
                createdById: adminId,
                isActive: true,
            },
            select: this.safeSelect(),
        });
    }
    async createAdmin(adminId, dto) {
        await this.assertUnique(dto.username, undefined, dto.email);
        const passwordHash = await bcrypt.hash(dto.password, 10);
        return this.prisma.user.create({
            data: {
                role: 'ADMIN',
                name: dto.name?.trim() || null,
                username: dto.username.trim(),
                passwordHash,
                mobile: dto.mobile?.trim() || null,
                email: dto.email?.trim() || null,
                createdById: adminId,
                isActive: true,
            },
            select: this.safeSelect(),
        });
    }
    async listUsers(role, classId) {
        return this.prisma.user.findMany({
            where: {
                ...(role
                    ? { role }
                    : {}),
                ...(classId
                    ? { classId }
                    : {}),
            },
            select: this.safeSelect(),
            orderBy: {
                createdAt: 'desc',
            },
        });
    }
    async updateUser(userId, dto) {
        const existing = await this.prisma.user.findUnique({
            where: {
                id: userId,
            },
        });
        if (!existing) {
            throw new common_1.NotFoundException('User not found');
        }
        if (dto.username &&
            dto.username.trim() !==
                existing.username) {
            const usernameExists = await this.prisma.user.findUnique({
                where: {
                    username: dto.username.trim(),
                },
            });
            if (usernameExists) {
                throw new common_1.ConflictException('Username already in use');
            }
        }
        if (dto.regNumber &&
            dto.regNumber.trim() !==
                existing.regNumber) {
            const regNumberExists = await this.prisma.user.findUnique({
                where: {
                    regNumber: dto.regNumber.trim(),
                },
            });
            if (regNumberExists) {
                throw new common_1.ConflictException('Registration number already in use');
            }
        }
        if (dto.email &&
            dto.email.trim() !==
                existing.email) {
            const emailExists = await this.prisma.user.findUnique({
                where: {
                    email: dto.email.trim(),
                },
            });
            if (emailExists) {
                throw new common_1.ConflictException('Email already in use');
            }
        }
        const data = {};
        if (dto.name !==
            undefined) {
            data.name =
                dto.name.trim() ||
                    null;
        }
        if (dto.username !==
            undefined) {
            data.username =
                dto.username.trim();
        }
        if (dto.regNumber !==
            undefined) {
            data.regNumber =
                dto.regNumber.trim() ||
                    null;
        }
        if (dto.mobile !==
            undefined) {
            data.mobile =
                dto.mobile.trim() ||
                    null;
        }
        if (dto.email !==
            undefined) {
            data.email =
                dto.email.trim() ||
                    null;
        }
        if (dto.classId !==
            undefined) {
            data.classId =
                dto.classId.trim() ||
                    null;
        }
        if (dto.isActive !==
            undefined) {
            data.isActive =
                dto.isActive;
        }
        if (dto.password &&
            dto.password.trim()) {
            data.passwordHash =
                await bcrypt.hash(dto.password, 10);
        }
        return this.prisma.user.update({
            where: {
                id: userId,
            },
            data,
            select: this.safeSelect(),
        });
    }
    async deleteUser(userId, hard = false) {
        const existing = await this.prisma.user.findUnique({
            where: {
                id: userId,
            },
        });
        if (!existing) {
            throw new common_1.NotFoundException('User not found');
        }
        if (hard) {
            return this.prisma.user.delete({
                where: {
                    id: userId,
                },
            });
        }
        return this.prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                isActive: false,
            },
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
                    {
                        username: normalizedUsername,
                    },
                    ...(normalizedRegNumber
                        ? [
                            {
                                regNumber: normalizedRegNumber,
                            },
                        ]
                        : []),
                    ...(normalizedEmail
                        ? [
                            {
                                email: normalizedEmail,
                            },
                        ]
                        : []),
                ],
            },
        });
        if (clashes) {
            if (clashes.username ===
                normalizedUsername) {
                throw new common_1.ConflictException('Username already in use');
            }
            if (normalizedRegNumber &&
                clashes.regNumber ===
                    normalizedRegNumber) {
                throw new common_1.ConflictException('Registration number already in use');
            }
            if (normalizedEmail &&
                clashes.email ===
                    normalizedEmail) {
                throw new common_1.ConflictException('Email already in use');
            }
            throw new common_1.ConflictException('User information already in use');
        }
    }
    safeSelect() {
        return {
            id: true,
            role: true,
            name: true,
            username: true,
            regNumber: true,
            mobile: true,
            email: true,
            classId: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
        };
    }
};
exports.AdminUsersService = AdminUsersService;
exports.AdminUsersService = AdminUsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminUsersService);
//# sourceMappingURL=admin-users.service.js.map