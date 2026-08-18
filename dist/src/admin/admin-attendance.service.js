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
exports.AdminAttendanceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AdminAttendanceService = class AdminAttendanceService {
    constructor(prisma) {
        this.prisma = prisma;
        this.attendanceSettings = {
            minAttendancePercent: 75,
            minActivityPercent: 50,
            autoReviewEnabled: true,
            unreviewedHoursThreshold: 48,
            reviewWindowHours: 24,
        };
    }
    async overview() {
        const [present, absent, pending, approved, rejected,] = await Promise.all([
            this.prisma.attendance.count({
                where: {
                    isPresent: true,
                    computedAt: {
                        not: null,
                    },
                },
            }),
            this.prisma.attendance.count({
                where: {
                    isPresent: false,
                    computedAt: {
                        not: null,
                    },
                },
            }),
            this.prisma.attendance.count({
                where: {
                    reviewStatus: 'PENDING',
                },
            }),
            this.prisma.attendance.count({
                where: {
                    reviewStatus: {
                        in: [
                            'APPROVED',
                            'AUTO_APPROVED',
                        ],
                    },
                },
            }),
            this.prisma.attendance.count({
                where: {
                    reviewStatus: {
                        in: [
                            'REJECTED',
                            'AUTO_REJECTED',
                        ],
                    },
                },
            }),
        ]);
        return {
            present,
            absent,
            total: present +
                absent,
            pending,
            approved,
            rejected,
        };
    }
    async listAttendance(classId, search) {
        const cleanSearch = search?.trim();
        const records = await this.prisma.attendance.findMany({
            where: {
                student: {
                    role: 'STUDENT',
                    ...(classId
                        ? {
                            classId,
                        }
                        : {}),
                    ...(cleanSearch
                        ? {
                            OR: [
                                {
                                    username: {
                                        contains: cleanSearch,
                                    },
                                },
                                {
                                    name: {
                                        contains: cleanSearch,
                                    },
                                },
                                {
                                    regNumber: {
                                        contains: cleanSearch,
                                    },
                                },
                            ],
                        }
                        : {}),
                },
            },
            include: {
                student: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        regNumber: true,
                        mobile: true,
                        email: true,
                        classId: true,
                        isActive: true,
                    },
                },
                session: {
                    select: {
                        id: true,
                        sessionCode: true,
                        classTitle: true,
                        teacherId: true,
                        status: true,
                        createdAt: true,
                        endsAt: true,
                    },
                },
            },
            orderBy: {
                computedAt: 'desc',
            },
        });
        return records;
    }
    async byClass(classId) {
        const students = await this.prisma.user.findMany({
            where: {
                role: 'STUDENT',
                classId,
            },
            select: {
                id: true,
            },
        });
        const studentIds = students.map((student) => student.id);
        const [present, absent, pending,] = await Promise.all([
            this.prisma.attendance.count({
                where: {
                    studentId: {
                        in: studentIds,
                    },
                    isPresent: true,
                    computedAt: {
                        not: null,
                    },
                },
            }),
            this.prisma.attendance.count({
                where: {
                    studentId: {
                        in: studentIds,
                    },
                    isPresent: false,
                    computedAt: {
                        not: null,
                    },
                },
            }),
            this.prisma.attendance.count({
                where: {
                    studentId: {
                        in: studentIds,
                    },
                    reviewStatus: 'PENDING',
                },
            }),
        ]);
        const total = present +
            absent;
        const attendancePercent = total > 0
            ? Math.round((present /
                total) *
                100)
            : 0;
        return {
            classId,
            students: studentIds.length,
            present,
            absent,
            total,
            pending,
            attendancePercent,
        };
    }
    async byStudent(studentId) {
        const student = await this.prisma.user.findUnique({
            where: {
                id: studentId,
            },
            select: {
                id: true,
                role: true,
                username: true,
                name: true,
                regNumber: true,
                mobile: true,
                email: true,
                classId: true,
                isActive: true,
            },
        });
        if (!student ||
            student.role !==
                'STUDENT') {
            throw new common_1.NotFoundException('Student not found');
        }
        const records = await this.prisma.attendance.findMany({
            where: {
                studentId,
            },
            include: {
                session: {
                    select: {
                        id: true,
                        sessionCode: true,
                        classTitle: true,
                        status: true,
                        createdAt: true,
                        endsAt: true,
                    },
                },
            },
            orderBy: {
                computedAt: 'desc',
            },
        });
        const computedRecords = records.filter((record) => record.computedAt !==
            null);
        const present = computedRecords.filter((record) => record.isPresent).length;
        const absent = computedRecords.length -
            present;
        const total = computedRecords.length;
        const attendancePercent = total > 0
            ? Math.round((present /
                total) *
                100)
            : 0;
        const recordsWithActivity = records.filter((record) => record.activityPercent !== null);
        const averageActivityPercent = recordsWithActivity.length > 0
            ? Math.round(recordsWithActivity.reduce((sum, record) => sum +
                (record.activityPercent ?? 0), 0) /
                recordsWithActivity.length)
            : 0;
        const totalWarnings = records.reduce((sum, record) => sum +
            record.warningCount, 0);
        return {
            student,
            summary: {
                present,
                absent,
                total,
                attendancePercent,
                averageActivityPercent,
                totalWarnings,
            },
            records,
        };
    }
    async approveAttendance(attendanceId, adminId, reason) {
        const attendance = await this.prisma.attendance.findUnique({
            where: {
                id: attendanceId,
            },
        });
        if (!attendance) {
            throw new common_1.NotFoundException('Attendance record not found');
        }
        return this.prisma.attendance.update({
            where: {
                id: attendanceId,
            },
            data: {
                isPresent: true,
                reviewStatus: 'APPROVED',
                reviewedById: adminId,
                reviewedAt: new Date(),
                autoReviewed: false,
                reviewReason: reason?.trim() ||
                    'Approved manually by Admin',
            },
        });
    }
    async rejectAttendance(attendanceId, adminId, reason) {
        const attendance = await this.prisma.attendance.findUnique({
            where: {
                id: attendanceId,
            },
        });
        if (!attendance) {
            throw new common_1.NotFoundException('Attendance record not found');
        }
        return this.prisma.attendance.update({
            where: {
                id: attendanceId,
            },
            data: {
                isPresent: false,
                reviewStatus: 'REJECTED',
                reviewedById: adminId,
                reviewedAt: new Date(),
                autoReviewed: false,
                reviewReason: reason?.trim() ||
                    'Rejected manually by Admin',
            },
        });
    }
    async getSettings() {
        return { ...this.attendanceSettings };
    }
    async updateSettings(dto) {
        if (dto.minAttendancePercent !== undefined) {
            this.attendanceSettings.minAttendancePercent = Math.max(1, Math.min(100, dto.minAttendancePercent));
        }
        if (dto.minActivityPercent !== undefined) {
            this.attendanceSettings.minActivityPercent = Math.max(1, Math.min(100, dto.minActivityPercent));
        }
        if (dto.autoReviewEnabled !== undefined) {
            this.attendanceSettings.autoReviewEnabled = Boolean(dto.autoReviewEnabled);
        }
        return { success: true, settings: this.attendanceSettings };
    }
    async runAutoAttendanceReview() {
        const cutoffDate = new Date(Date.now() - this.attendanceSettings.unreviewedHoursThreshold * 60 * 60 * 1000);
        const pendingRecords = await this.prisma.attendance.findMany({
            where: {
                reviewStatus: 'PENDING',
                OR: [
                    { computedAt: { lte: cutoffDate } },
                    { autoReviewAt: { lte: new Date() } },
                ],
            },
            include: {
                student: { select: { id: true, name: true, username: true, regNumber: true } },
                session: { select: { id: true, sessionCode: true, classTitle: true } },
            },
        });
        let autoApprovedCount = 0;
        let autoRejectedCount = 0;
        for (const record of pendingRecords) {
            const attPct = record.attendancePercent ?? 0;
            const actPct = record.activityPercent ?? 0;
            const qualifies = attPct >= this.attendanceSettings.minAttendancePercent &&
                actPct >= this.attendanceSettings.minActivityPercent;
            const newStatus = qualifies ? 'AUTO_APPROVED' : 'AUTO_REJECTED';
            const reason = qualifies
                ? `Auto-approved after 48h unreviewed. Criteria met: Attendance ${attPct}% (>=${this.attendanceSettings.minAttendancePercent}%), Activity ${actPct}% (>=${this.attendanceSettings.minActivityPercent}%).`
                : `Auto-rejected after 48h unreviewed. Below criteria: Attendance ${attPct}% / Activity ${actPct}%.`;
            await this.prisma.attendance.update({
                where: { id: record.id },
                data: {
                    isPresent: qualifies,
                    reviewStatus: newStatus,
                    autoReviewed: true,
                    reviewReason: reason,
                    reviewedAt: new Date(),
                    reviewedById: 'SYSTEM_AUTOMATION',
                },
            });
            await this.prisma.auditLog.create({
                data: {
                    actorId: 'SYSTEM_AUTOMATION',
                    action: newStatus,
                    targetPc: record.student?.username || record.studentId,
                    metadata: JSON.stringify({
                        attendanceId: record.id,
                        studentId: record.studentId,
                        sessionId: record.sessionId,
                        rule: `48H_UNREVIEWED_THRESHOLD_${this.attendanceSettings.minAttendancePercent}%`,
                        timestamp: new Date().toISOString(),
                    }),
                },
            });
            if (qualifies)
                autoApprovedCount++;
            else
                autoRejectedCount++;
        }
        return {
            evaluatedCount: pendingRecords.length,
            autoApprovedCount,
            autoRejectedCount,
            timestamp: new Date().toISOString(),
        };
    }
    async getAutoGeneratedAttendance() {
        const reviewWindowCutoff = new Date(Date.now() - this.attendanceSettings.reviewWindowHours * 60 * 60 * 1000);
        const records = await this.prisma.attendance.findMany({
            where: {
                autoReviewed: true,
                reviewedAt: { gte: reviewWindowCutoff },
            },
            include: {
                student: { select: { id: true, name: true, username: true, regNumber: true } },
                session: { select: { id: true, sessionCode: true, classTitle: true } },
            },
            orderBy: { reviewedAt: 'desc' },
        });
        return {
            reviewWindowHours: this.attendanceSettings.reviewWindowHours,
            totalAutoGenerated: records.length,
            records: records.map((r) => ({
                id: r.id,
                studentId: r.studentId,
                studentName: r.student.name || r.student.username,
                regNumber: r.student.regNumber || '—',
                sessionId: r.sessionId,
                sessionCode: r.session?.sessionCode || '—',
                classTitle: r.session?.classTitle || '—',
                isPresent: r.isPresent,
                reviewStatus: r.reviewStatus,
                attendancePercent: r.attendancePercent,
                activityPercent: r.activityPercent,
                overallPercent: r.overallPercent,
                autoReviewed: true,
                reviewReason: r.reviewReason,
                generatedAt: r.reviewedAt,
                windowExpiresAt: r.reviewedAt
                    ? new Date(r.reviewedAt.getTime() + this.attendanceSettings.reviewWindowHours * 60 * 60 * 1000)
                    : null,
            })),
        };
    }
};
exports.AdminAttendanceService = AdminAttendanceService;
exports.AdminAttendanceService = AdminAttendanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminAttendanceService);
//# sourceMappingURL=admin-attendance.service.js.map