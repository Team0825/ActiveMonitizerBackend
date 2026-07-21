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
exports.TeacherDashboardService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let TeacherDashboardService = class TeacherDashboardService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async overview(teacherId) {
        const totalStudents = await this.prisma.user.count({
            where: {
                role: 'STUDENT',
                isActive: true,
            },
        });
        const activeSessions = await this.prisma.classSession.count({
            where: {
                teacherId,
                status: 'ACTIVE',
            },
        });
        const totalSessions = await this.prisma.classSession.count({
            where: {
                teacherId,
            },
        });
        const teacherSessions = await this.prisma.classSession.findMany({
            where: {
                teacherId,
            },
            select: {
                id: true,
            },
        });
        const teacherSessionIds = teacherSessions.map((session) => session.id);
        const pendingAttendance = teacherSessionIds.length > 0
            ? await this.prisma.attendance.count({
                where: {
                    sessionId: {
                        in: teacherSessionIds,
                    },
                    reviewStatus: 'PENDING',
                },
            })
            : 0;
        const onlinePcs = await this.prisma.pc.count({
            where: {
                status: 'ONLINE',
            },
        });
        const recentSessions = await this.prisma.classSession.findMany({
            where: {
                teacherId,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 5,
            select: {
                id: true,
                sessionCode: true,
                classTitle: true,
                status: true,
                createdAt: true,
                endsAt: true,
                durationMinutes: true,
                _count: {
                    select: {
                        participants: true,
                    },
                },
            },
        });
        return {
            totalStudents,
            activeSessions,
            totalSessions,
            pendingAttendance,
            onlinePcs,
            recentSessions,
        };
    }
};
exports.TeacherDashboardService = TeacherDashboardService;
exports.TeacherDashboardService = TeacherDashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TeacherDashboardService);
//# sourceMappingURL=teacher-dashboard.service.js.map