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
exports.TeachersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = require("bcrypt");
const prisma_service_1 = require("../prisma/prisma.service");
let TeachersService = class TeachersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getMyProfile(teacherId) {
        const teacher = await this.prisma.user.findFirst({
            where: {
                id: teacherId,
                role: 'TEACHER',
            },
            select: {
                id: true,
                role: true,
                username: true,
                name: true,
                mobile: true,
                email: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!teacher) {
            throw new common_1.NotFoundException('Teacher profile not found');
        }
        return teacher;
    }
    async updateMyProfile(teacherId, dto) {
        const teacher = await this.prisma.user.findFirst({
            where: {
                id: teacherId,
                role: 'TEACHER',
            },
        });
        if (!teacher) {
            throw new common_1.NotFoundException('Teacher profile not found');
        }
        if (dto.email &&
            dto.email !== teacher.email) {
            const emailOwner = await this.prisma.user.findUnique({
                where: {
                    email: dto.email,
                },
                select: {
                    id: true,
                },
            });
            if (emailOwner &&
                emailOwner.id !== teacherId) {
                throw new common_1.ConflictException('Email address is already in use');
            }
        }
        const updateData = {};
        if (dto.name !== undefined) {
            updateData.name =
                dto.name.trim();
        }
        if (dto.mobile !== undefined) {
            updateData.mobile =
                dto.mobile.trim();
        }
        if (dto.email !== undefined) {
            updateData.email =
                dto.email.trim();
        }
        if (dto.password) {
            updateData.passwordHash =
                await bcrypt.hash(dto.password, 10);
        }
        return this.prisma.user.update({
            where: {
                id: teacherId,
            },
            data: updateData,
            select: {
                id: true,
                role: true,
                username: true,
                name: true,
                mobile: true,
                email: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }
};
exports.TeachersService = TeachersService;
exports.TeachersService = TeachersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TeachersService);
//# sourceMappingURL=teachers.service.js.map