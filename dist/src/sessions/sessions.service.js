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
exports.SessionsService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const session_realtime_service_1 = require("../realtime/session-realtime.service");
let SessionsService = class SessionsService {
    constructor(prisma, jwt, sessionRealtimeService) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.sessionRealtimeService = sessionRealtimeService;
    }
    generateSessionCode() {
        const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            const randomIndex = Math.floor(Math.random() *
                characters.length);
            code +=
                characters[randomIndex];
        }
        return code;
    }
    async generateUniqueSessionCode() {
        const maxAttempts = 10;
        for (let attempt = 0; attempt <
            maxAttempts; attempt++) {
            const sessionCode = this.generateSessionCode();
            const existing = await this.prisma
                .classSession
                .findUnique({
                where: {
                    sessionCode,
                },
                select: {
                    id: true,
                },
            });
            if (!existing) {
                return sessionCode;
            }
        }
        throw new common_1.BadRequestException('Unable to generate a unique session code. Please try again.');
    }
    async createSession(teacherId, dto) {
        const createdAt = new Date();
        const endsAt = new Date(createdAt.getTime() +
            dto.durationMinutes * 60_000);
        const sessionCode = await this.generateUniqueSessionCode();
        const created = await this.prisma.$transaction(async (tx) => {
            const session = await tx.classSession.create({
                data: {
                    sessionCode,
                    classTitle: dto.classTitle,
                    teacherId,
                    durationMinutes: dto.durationMinutes,
                    joinWindowMinutes: dto.joinWindowMinutes ??
                        15,
                    allowInternet: dto.allowInternet ??
                        true,
                    allowClipboard: dto.allowClipboard ??
                        true,
                    allowUsb: dto.allowUsb ??
                        true,
                    allowTaskManager: dto.allowTaskManager ??
                        true,
                    allowAltTab: dto.allowAltTab ??
                        true,
                    allowWindowsKey: dto.allowWindowsKey ??
                        true,
                    allowPrintScreen: dto.allowPrintScreen ??
                        true,
                    freezeOnEnd: dto.freezeOnEnd ??
                        false,
                    allowOffline: dto.allowOffline ??
                        true,
                    restrictExistingFiles: dto.restrictExistingFiles ??
                        false,
                    restrictUnauthorizedApps: dto.restrictUnauthorizedApps ??
                        false,
                    screenshotInterval: dto.screenshotInterval,
                    warningMinutes: dto.warningMinutes ??
                        5,
                    instructions: dto.instructions,
                    sessionMode: dto.sessionMode ??
                        'LAB',
                    questionMode: dto.questionMode ??
                        'COMMON',
                    createdAt,
                    endsAt,
                },
            });
            if (dto.allowedWebsites?.length) {
                await tx.allowedWebsite.createMany({
                    data: dto.allowedWebsites.map((domain) => ({
                        sessionId: session.id,
                        domain,
                    })),
                });
            }
            if (dto.blockedWebsites?.length) {
                await tx.blockedWebsite.createMany({
                    data: dto.blockedWebsites.map((domain) => ({
                        sessionId: session.id,
                        domain,
                    })),
                });
            }
            if (dto.allowedApplications?.length) {
                await tx.allowedApplication.createMany({
                    data: dto.allowedApplications.map((processName) => ({
                        sessionId: session.id,
                        processName,
                    })),
                });
            }
            if (dto.blockedApplications?.length) {
                await tx.blockedApplication.createMany({
                    data: dto.blockedApplications.map((processName) => ({
                        sessionId: session.id,
                        processName,
                    })),
                });
            }
            return tx.classSession.findUnique({
                where: {
                    id: session.id,
                },
                include: {
                    allowedWebsites: true,
                    blockedWebsites: true,
                    allowedApplications: true,
                    blockedApplications: true,
                },
            });
        });
        return {
            ...created,
            sessionId: created?.sessionCode,
        };
    }
    async studentLogin(dto) {
        const regNumber = dto.regNumber.trim();
        const sessionCode = dto.sessionId
            .trim()
            .toUpperCase();
        const student = await this.prisma
            .user
            .findUnique({
            where: {
                regNumber,
            },
        });
        if (!student) {
            throw new common_1.NotFoundException('Student registration number not found.');
        }
        if (student.role !==
            'STUDENT') {
            throw new common_1.ForbiddenException('This registration number does not belong to a student account.');
        }
        if (!student.isActive) {
            throw new common_1.ForbiddenException('This student account is inactive. Please contact the administrator.');
        }
        const session = await this.prisma
            .classSession
            .findUnique({
            where: {
                sessionCode,
            },
            include: {
                allowedWebsites: true,
                blockedWebsites: true,
                allowedApplications: true,
                blockedApplications: true,
            },
        });
        if (!session) {
            throw new common_1.NotFoundException('Invalid Session Code.');
        }
        if (session.status !==
            'ACTIVE') {
            throw new common_1.ForbiddenException('This session is not active.');
        }
        const now = new Date();
        if (now >=
            session.endsAt) {
            throw new common_1.ForbiddenException('This session has ended. The Session Code can no longer be used.');
        }
        const windowCloses = new Date(session.createdAt
            .getTime() +
            session
                .joinWindowMinutes *
                60_000);
        const withinWindow = now <=
            windowCloses;
        if (!withinWindow) {
            const approvedRequest = await this.prisma
                .specialAccessRequest
                .findFirst({
                where: {
                    sessionId: session.id,
                    studentId: student.id,
                    status: 'APPROVED',
                },
            });
            if (!approvedRequest) {
                const existingRequest = await this.prisma
                    .specialAccessRequest
                    .findFirst({
                    where: {
                        sessionId: session.id,
                        studentId: student.id,
                        status: 'PENDING',
                    },
                });
                const accessRequest = existingRequest ??
                    await this.prisma
                        .specialAccessRequest
                        .create({
                        data: {
                            sessionId: session.id,
                            studentId: student.id,
                            status: 'PENDING',
                        },
                    });
                return {
                    success: false,
                    requiresSpecialAccess: true,
                    message: 'The normal join window has closed. A special access request has been sent to the teacher.',
                    accessRequest: {
                        id: accessRequest.id,
                        status: accessRequest.status,
                    },
                    student: {
                        id: student.id,
                        username: student.username,
                        regNumber: student.regNumber,
                        classId: student.classId,
                    },
                    session: {
                        id: session.id,
                        sessionCode: session.sessionCode,
                        sessionId: session.sessionCode,
                        classTitle: session.classTitle,
                        endsAt: session.endsAt,
                    },
                };
            }
        }
        const joinResult = await this.joinSession(student.id, {
            sessionId: session.sessionCode,
            regNumber: student.regNumber ??
                regNumber,
            pcHostname: dto.pcHostname,
        });
        const sessionAccessToken = await this.jwt
            .signAsync({
            sub: student.id,
            role: 'STUDENT',
            username: student.username,
            sessionId: session.id,
            sessionCode: session.sessionCode,
            pcHostname: dto.pcHostname,
            tokenType: 'SESSION',
        }, {
            expiresIn: Math.max(60, Math.floor((session.endsAt
                .getTime() -
                Date.now()) /
                1000)),
        });
        return {
            success: true,
            message: 'Student successfully joined the session.',
            sessionAccessToken,
            student: {
                id: student.id,
                username: student.username,
                regNumber: student.regNumber,
                classId: student.classId,
            },
            ...joinResult,
        };
    }
    async joinSession(studentId, dto) {
        const sessionCode = dto.sessionId
            .trim()
            .toUpperCase();
        const session = await this.prisma
            .classSession
            .findUnique({
            where: {
                sessionCode,
            },
            include: {
                allowedWebsites: true,
                blockedWebsites: true,
                allowedApplications: true,
                blockedApplications: true,
            },
        });
        if (!session ||
            session.status !==
                'ACTIVE') {
            throw new common_1.NotFoundException('Session not found or not active');
        }
        const now = new Date();
        if (now >=
            session.endsAt) {
            throw new common_1.ForbiddenException('This session has ended. The Session Code can no longer be used to join.');
        }
        const windowCloses = new Date(session.createdAt
            .getTime() +
            session
                .joinWindowMinutes *
                60_000);
        const withinWindow = now <=
            windowCloses;
        if (!withinWindow) {
            const approved = await this.prisma
                .specialAccessRequest
                .findFirst({
                where: {
                    sessionId: session.id,
                    studentId,
                    status: 'APPROVED',
                },
            });
            if (!approved) {
                throw new common_1.ForbiddenException('Join window has closed. Request special access from the teacher to join this session.');
            }
        }
        const participant = await this.prisma
            .sessionParticipant
            .upsert({
            where: {
                sessionId_studentId: {
                    sessionId: session.id,
                    studentId,
                },
            },
            create: {
                sessionId: session.id,
                studentId,
                pcHostname: dto.pcHostname,
                approvedLate: !withinWindow,
            },
            update: {
                pcHostname: dto.pcHostname,
                leftAt: null,
            },
        });
        const requiredSeconds = Math.floor(session
            .durationMinutes *
            60 *
            0.7);
        await this.prisma
            .attendance
            .upsert({
            where: {
                sessionId_studentId: {
                    sessionId: session.id,
                    studentId,
                },
            },
            create: {
                sessionId: session.id,
                studentId,
                presentSeconds: 0,
                requiredSeconds,
            },
            update: {},
        });
        return {
            session: {
                id: session.id,
                sessionCode: session.sessionCode,
                sessionId: session.sessionCode,
                classTitle: session.classTitle,
                durationMinutes: session.durationMinutes,
                joinWindowMinutes: session.joinWindowMinutes,
                createdAt: session.createdAt,
                endsAt: session.endsAt,
                status: session.status,
                allowInternet: session.allowInternet,
                allowClipboard: session.allowClipboard,
                allowUsb: session.allowUsb,
                allowTaskManager: session.allowTaskManager,
                allowAltTab: session.allowAltTab,
                allowWindowsKey: session.allowWindowsKey,
                allowPrintScreen: session.allowPrintScreen,
                freezeOnEnd: session.freezeOnEnd,
                allowOffline: session.allowOffline,
                restrictExistingFiles: session.restrictExistingFiles,
                restrictUnauthorizedApps: session.restrictUnauthorizedApps,
                warningMinutes: session.warningMinutes,
                screenshotInterval: session.screenshotInterval,
                sessionMode: session.sessionMode,
                questionMode: session.questionMode,
                instructions: session.instructions,
                allowedWebsites: session.allowedWebsites.map(site => site.domain),
                blockedWebsites: session.blockedWebsites.map(site => site.domain),
                allowedApplications: session.allowedApplications.map(app => app.processName),
                blockedApplications: session.blockedApplications.map(app => app.processName),
            },
            participant,
        };
    }
    async requestSpecialAccess(studentId, dto) {
        const sessionCode = dto.sessionId
            .trim()
            .toUpperCase();
        const session = await this.prisma
            .classSession
            .findUnique({
            where: {
                sessionCode,
            },
        });
        if (!session ||
            session.status !==
                'ACTIVE') {
            throw new common_1.NotFoundException('Session not found or not active');
        }
        if (new Date() >=
            session.endsAt) {
            throw new common_1.BadRequestException('Session has already ended');
        }
        const existingRequest = await this.prisma
            .specialAccessRequest
            .findFirst({
            where: {
                sessionId: session.id,
                studentId,
                status: {
                    in: [
                        'PENDING',
                        'APPROVED',
                    ],
                },
            },
        });
        if (existingRequest) {
            return existingRequest;
        }
        return this.prisma
            .specialAccessRequest
            .create({
            data: {
                sessionId: session.id,
                studentId,
                status: 'PENDING',
            },
        });
    }
    async handleAccessRequest(actorId, actorRole, dto) {
        const request = await this.prisma
            .specialAccessRequest
            .findUnique({
            where: {
                id: dto.requestId,
            },
            include: {
                session: true,
            },
        });
        if (!request) {
            throw new common_1.NotFoundException('Access request not found');
        }
        if (actorRole ===
            'TEACHER' &&
            request.session
                .teacherId !==
                actorId) {
            throw new common_1.ForbiddenException('Not your session');
        }
        return this.prisma
            .specialAccessRequest
            .update({
            where: {
                id: dto.requestId,
            },
            data: {
                status: dto.approve
                    ? 'APPROVED'
                    : 'REJECTED',
                handledById: actorId,
                handledAt: new Date(),
            },
        });
    }
    async getSessions(actorId, actorRole) {
        const sessions = await this.prisma
            .classSession
            .findMany({
            where: actorRole ===
                'TEACHER'
                ? {
                    teacherId: actorId,
                }
                : {},
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                _count: {
                    select: {
                        participants: true,
                    },
                },
                allowedWebsites: true,
                blockedWebsites: true,
                allowedApplications: true,
                blockedApplications: true,
            },
        });
        return sessions.map((session) => {
            const allowedWebsites = session.allowedWebsites.map(site => site.domain);
            const blockedWebsites = session.blockedWebsites.map(site => site.domain);
            const allowedApplications = session.allowedApplications.map(app => app.processName);
            const blockedApplications = session.blockedApplications.map(app => app.processName);
            return {
                id: session.id,
                sessionId: session.sessionCode,
                sessionCode: session.sessionCode,
                classTitle: session.classTitle,
                durationMinutes: session.durationMinutes,
                joinWindowMinutes: session.joinWindowMinutes,
                createdAt: session.createdAt,
                endsAt: session.endsAt,
                status: session.status,
                teacherId: session.teacherId,
                participantCount: session._count
                    .participants,
                allowInternet: session.allowInternet,
                allowClipboard: session.allowClipboard,
                allowUsb: session.allowUsb,
                allowTaskManager: session.allowTaskManager,
                allowAltTab: session.allowAltTab,
                allowWindowsKey: session.allowWindowsKey,
                allowPrintScreen: session.allowPrintScreen,
                freezeOnEnd: session.freezeOnEnd,
                allowOffline: session.allowOffline,
                restrictExistingFiles: session.restrictExistingFiles,
                restrictUnauthorizedApps: session.restrictUnauthorizedApps,
                warningMinutes: session.warningMinutes,
                screenshotInterval: session.screenshotInterval,
                sessionMode: session.sessionMode,
                questionMode: session.questionMode,
                instructions: session.instructions,
                allowedWebsites,
                blockedWebsites,
                allowedApplications,
                blockedApplications,
            };
        });
    }
    async getOnlineParticipants(sessionId) {
        return this.prisma
            .sessionParticipant
            .findMany({
            where: {
                sessionId,
                leftAt: null,
            },
            include: {
                student: {
                    select: {
                        id: true,
                        username: true,
                        regNumber: true,
                    },
                },
            },
        });
    }
    async endSession(actorId, actorRole, sessionId) {
        const session = await this.prisma
            .classSession
            .findUnique({
            where: {
                id: sessionId,
            },
            include: {
                participants: true,
            },
        });
        if (!session) {
            throw new common_1.NotFoundException('Session not found');
        }
        if (actorRole ===
            'TEACHER' &&
            session.teacherId !==
                actorId) {
            throw new common_1.ForbiddenException('Not your session');
        }
        if (session.status ===
            'ENDED') {
            return {
                id: session.id,
                sessionCode: session.sessionCode,
                sessionId: session.sessionCode,
                status: session.status,
                alreadyEnded: true,
            };
        }
        const now = new Date();
        await this.prisma
            .$transaction([
            this.prisma
                .classSession
                .update({
                where: {
                    id: sessionId,
                },
                data: {
                    status: 'ENDED',
                },
            }),
            this.prisma
                .sessionParticipant
                .updateMany({
                where: {
                    sessionId,
                    leftAt: null,
                },
                data: {
                    leftAt: now,
                },
            }),
        ]);
        const participants = await this.prisma
            .sessionParticipant
            .findMany({
            where: {
                sessionId,
            },
        });
        for (const participant of participants) {
            const participantEndTime = participant.leftAt ??
                now;
            const presentSeconds = Math.max(0, Math.floor((participantEndTime
                .getTime() -
                participant
                    .joinedAt
                    .getTime()) /
                1000));
            const requiredSeconds = Math.floor(session
                .durationMinutes *
                60 *
                0.7);
            await this.prisma
                .attendance
                .upsert({
                where: {
                    sessionId_studentId: {
                        sessionId,
                        studentId: participant
                            .studentId,
                    },
                },
                create: {
                    sessionId,
                    studentId: participant
                        .studentId,
                    presentSeconds,
                    requiredSeconds,
                    isPresent: presentSeconds >=
                        requiredSeconds,
                    computedAt: now,
                },
                update: {
                    presentSeconds,
                    requiredSeconds,
                    isPresent: presentSeconds >=
                        requiredSeconds,
                    computedAt: now,
                },
            });
        }
        const endedReason = actorRole ===
            'ADMIN'
            ? 'ADMIN_TERMINATED'
            : 'COMPLETED';
        this.sessionRealtimeService
            .emitSessionEnded(session.id, {
            sessionId: session.id,
            sessionCode: session.sessionCode,
            classTitle: session.classTitle,
            endedAt: now.toISOString(),
            endedById: actorId,
            endedByRole: actorRole,
            reason: endedReason,
        });
        return {
            id: session.id,
            sessionCode: session.sessionCode,
            sessionId: session.sessionCode,
            status: 'ENDED',
            endedAt: now,
            endedById: actorId,
            endedByRole: actorRole,
            reason: endedReason,
        };
    }
    async handleExpiredSessions() {
        const now = new Date();
        const expiredSessions = await this.prisma.classSession.findMany({
            where: {
                status: 'ACTIVE',
                endsAt: {
                    lte: now,
                },
            },
            select: {
                id: true,
                teacherId: true,
            },
        });
        if (expiredSessions.length === 0) {
            return;
        }
        for (const session of expiredSessions) {
            try {
                await this.endSession(session.teacherId, 'TEACHER', session.id);
            }
            catch (error) {
                console.error(`[CRON] Failed to auto-end expired session ${session.id}:`, error);
            }
        }
    }
    async getSessionPolicy(sessionId) {
        const session = await this.prisma.classSession.findUnique({
            where: {
                id: sessionId,
            },
            include: {
                allowedWebsites: true,
                blockedWebsites: true,
                allowedApplications: true,
                blockedApplications: true,
            },
        });
        if (!session) {
            throw new common_1.NotFoundException('Session not found');
        }
        return {
            allowInternet: session.allowInternet,
            allowClipboard: session.allowClipboard,
            allowUsb: session.allowUsb,
            allowTaskManager: session.allowTaskManager,
            allowAltTab: session.allowAltTab,
            allowWindowsKey: session.allowWindowsKey,
            allowPrintScreen: session.allowPrintScreen,
            allowOffline: session.allowOffline,
            restrictExistingFiles: session.restrictExistingFiles,
            restrictUnauthorizedApps: session.restrictUnauthorizedApps,
            freezeOnEnd: session.freezeOnEnd,
            warningMinutes: session.warningMinutes,
            screenshotInterval: session.screenshotInterval,
            sessionMode: session.sessionMode,
            questionMode: session.questionMode,
            instructions: session.instructions,
            allowedWebsites: session.allowedWebsites.map(s => s.domain),
            blockedWebsites: session.blockedWebsites.map(s => s.domain),
            allowedApplications: session.allowedApplications.map(a => a.processName),
            blockedApplications: session.blockedApplications.map(a => a.processName),
        };
    }
    async updateSessionPolicy(sessionId, dto) {
        await this.prisma.$transaction(async (tx) => {
            await tx.classSession.update({
                where: {
                    id: sessionId,
                },
                data: {
                    allowInternet: dto.allowInternet,
                    allowClipboard: dto.allowClipboard,
                    allowUsb: dto.allowUsb,
                    allowTaskManager: dto.allowTaskManager,
                    allowAltTab: dto.allowAltTab,
                    allowWindowsKey: dto.allowWindowsKey,
                    allowPrintScreen: dto.allowPrintScreen,
                    allowOffline: dto.allowOffline,
                    restrictExistingFiles: dto.restrictExistingFiles,
                    restrictUnauthorizedApps: dto.restrictUnauthorizedApps,
                    freezeOnEnd: dto.freezeOnEnd,
                    warningMinutes: dto.warningMinutes,
                    screenshotInterval: dto.screenshotInterval,
                    sessionMode: dto.sessionMode,
                    questionMode: dto.questionMode,
                    instructions: dto.instructions,
                },
            });
            await tx.allowedWebsite.deleteMany({
                where: {
                    sessionId,
                },
            });
            await tx.blockedWebsite.deleteMany({
                where: {
                    sessionId,
                },
            });
            await tx.allowedApplication.deleteMany({
                where: {
                    sessionId,
                },
            });
            await tx.blockedApplication.deleteMany({
                where: {
                    sessionId,
                },
            });
            if (dto.allowedWebsites?.length) {
                await tx.allowedWebsite.createMany({
                    data: dto.allowedWebsites.map((domain) => ({
                        sessionId,
                        domain,
                    })),
                });
            }
            if (dto.blockedWebsites?.length) {
                await tx.blockedWebsite.createMany({
                    data: dto.blockedWebsites.map((domain) => ({
                        sessionId,
                        domain,
                    })),
                });
            }
            if (dto.allowedApplications?.length) {
                await tx.allowedApplication.createMany({
                    data: dto.allowedApplications.map((processName) => ({
                        sessionId,
                        processName,
                    })),
                });
            }
            if (dto.blockedApplications?.length) {
                await tx.blockedApplication.createMany({
                    data: dto.blockedApplications.map((processName) => ({
                        sessionId,
                        processName,
                    })),
                });
            }
        });
        return this.getSessionPolicy(sessionId);
    }
};
exports.SessionsService = SessionsService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SessionsService.prototype, "handleExpiredSessions", null);
exports.SessionsService = SessionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        session_realtime_service_1.SessionRealtimeService])
], SessionsService);
//# sourceMappingURL=sessions.service.js.map