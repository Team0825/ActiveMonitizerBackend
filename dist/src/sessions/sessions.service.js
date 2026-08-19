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
var SessionsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionsService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const session_realtime_service_1 = require("../realtime/session-realtime.service");
const rate_limiter_service_1 = require("../common/rate-limiter.service");
const pcs_service_1 = require("../pcs/pcs.service");
const crypto_1 = require("crypto");
let SessionsService = SessionsService_1 = class SessionsService {
    constructor(prisma, jwt, sessionRealtimeService, rateLimiter, pcsService) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.sessionRealtimeService = sessionRealtimeService;
        this.rateLimiter = rateLimiter;
        this.pcsService = pcsService;
        this.logger = new common_1.Logger(SessionsService_1.name);
        this.recoveryCodes = new Map();
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
                    connectivityMode: dto.connectivityMode ??
                        'HYBRID',
                    websiteAccessMode: dto.websiteAccessMode ??
                        'NORMAL',
                    restrictExistingFiles: dto.restrictExistingFiles ??
                        false,
                    restrictUnauthorizedApps: dto.restrictUnauthorizedApps ??
                        false,
                    activityMonitoring: dto.activityMonitoring ??
                        true,
                    activityUpdateInterval: dto.activityUpdateInterval ??
                        2,
                    activitySensitivity: dto.activitySensitivity ??
                        'NORMAL',
                    idleThresholdSeconds: dto.idleThresholdSeconds ??
                        10,
                    violationSensitivity: dto.violationSensitivity ??
                        'NORMAL',
                    screenshotInterval: dto.screenshotInterval,
                    warningMinutes: dto.warningMinutes ??
                        5,
                    instructions: dto.instructions,
                    startupUrl: dto.startupUrl,
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
        const rateLimitKey = `student-login:${dto.pcHostname || 'pc'}:${regNumber.toUpperCase()}`;
        const limitStatus = this.rateLimiter.checkLimit(rateLimitKey);
        if (!limitStatus.allowed) {
            throw new common_1.HttpException('Too many attempts. Please try again later.', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const student = await this.prisma
            .user
            .findUnique({
            where: {
                regNumber,
            },
        });
        if (!student || student.role !== 'STUDENT' || !student.isActive) {
            const attemptResult = this.rateLimiter.recordAttempt(rateLimitKey);
            try {
                const violation = await this.pcsService.logViolation(dto.pcHostname || 'Workstation', sessionCode || null, attemptResult.isNewlyBlocked ? 'RATE_LIMIT_TRIGGERED' : 'FAILED_STUDENT_LOGIN', attemptResult.isNewlyBlocked
                    ? `Rate limit triggered: Maximum 5 failed student login attempts reached for ${regNumber} on ${dto.pcHostname || 'PC'}.`
                    : `Failed student login attempt with regNumber "${regNumber}" on ${dto.pcHostname || 'PC'}. (Attempt ${attemptResult.attempts}/5)`, new Date().toISOString(), attemptResult.isNewlyBlocked ? 'HIGH' : 'LOW', student ? { id: student.id, name: student.name, username: student.username, regNumber: student.regNumber } : null);
                const socketServer = this.sessionRealtimeService.getServer();
                if (socketServer)
                    socketServer.emit('pc:violation', violation);
            }
            catch (err) {
                this.logger.error('Failed to log student login violation:', err);
            }
            if (!attemptResult.allowed) {
                throw new common_1.HttpException('Too many attempts. Please try again later.', common_1.HttpStatus.TOO_MANY_REQUESTS);
            }
            if (!student) {
                throw new common_1.NotFoundException('Student registration number not found.');
            }
            if (student.role !== 'STUDENT') {
                throw new common_1.ForbiddenException('This registration number does not belong to a student account.');
            }
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
        this.rateLimiter.reset(rateLimitKey);
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
        if (dto.pcHostname?.trim()) {
            const host = dto.pcHostname.trim();
            await this.prisma.pc.upsert({
                where: { hostname: host },
                create: {
                    hostname: host,
                    displayName: host,
                    labName: 'DEFAULT-LAB',
                    status: 'ONLINE',
                    currentSessionId: session.id,
                    currentStudentId: studentId,
                    lastSeen: new Date(),
                },
                update: {
                    status: 'ONLINE',
                    currentSessionId: session.id,
                    currentStudentId: studentId,
                    lastSeen: new Date(),
                },
            });
        }
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
                startupUrl: session.startupUrl,
                allowedWebsites: session.allowedWebsites?.map((site) => site.domain) ?? [],
                blockedWebsites: session.blockedWebsites?.map((site) => site.domain) ?? [],
                allowedApplications: session.allowedApplications?.map((app) => app.processName) ?? [],
                blockedApplications: session.blockedApplications?.map((app) => app.processName) ?? [],
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
        const updated = await this.prisma
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
            include: {
                session: true,
                student: {
                    select: { id: true, username: true, regNumber: true, name: true },
                },
            },
        });
        const eventName = dto.approve ? 'special-access:approved' : 'special-access:rejected';
        this.sessionRealtimeService.emitToSession(request.sessionId, eventName, {
            requestId: updated.id,
            sessionId: updated.sessionId,
            sessionCode: request.session.sessionCode,
            studentId: updated.studentId,
            status: updated.status,
            handledById: actorId,
            handledAt: updated.handledAt,
        });
        const socketServer = this.sessionRealtimeService.server;
        if (socketServer) {
            socketServer.emit(eventName, {
                requestId: updated.id,
                sessionId: updated.sessionId,
                sessionCode: request.session.sessionCode,
                studentId: updated.studentId,
                status: updated.status,
            });
        }
        return updated;
    }
    async listAccessRequests(actorId, actorRole, sessionId) {
        return this.prisma.specialAccessRequest.findMany({
            where: {
                sessionId: sessionId || undefined,
                session: actorRole === 'TEACHER' ? { teacherId: actorId } : undefined,
            },
            include: {
                student: {
                    select: { id: true, username: true, regNumber: true, name: true },
                },
                session: {
                    select: { id: true, sessionCode: true, classTitle: true, createdAt: true, joinWindowMinutes: true, endsAt: true },
                },
            },
            orderBy: { requestedAt: 'desc' },
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
                teacher: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                    },
                },
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
            const allowedWebsites = session.allowedWebsites?.map((site) => site.domain) ?? [];
            const blockedWebsites = session.blockedWebsites?.map((site) => site.domain) ?? [];
            const allowedApplications = session.allowedApplications?.map((app) => app.processName) ?? [];
            const blockedApplications = session.blockedApplications?.map((app) => app.processName) ?? [];
            return {
                id: session.id,
                sessionId: session.sessionCode,
                sessionCode: session.sessionCode,
                cbtCode: session.cbtCode,
                classTitle: session.classTitle,
                durationMinutes: session.durationMinutes,
                joinWindowMinutes: session.joinWindowMinutes,
                createdAt: session.createdAt,
                endsAt: session.endsAt,
                status: session.status,
                teacherId: session.teacherId,
                teacher: session.teacher
                    ? {
                        id: session.teacher.id,
                        name: session.teacher.name,
                        username: session.teacher.username,
                    }
                    : null,
                participantCount: session._count
                    ?.participants ?? 0,
                allowInternet: session.allowInternet,
                allowClipboard: session.allowClipboard,
                allowUsb: session.allowUsb,
                allowTaskManager: session.allowTaskManager,
                allowAltTab: session.allowAltTab,
                allowWindowsKey: session.allowWindowsKey,
                allowPrintScreen: session.allowPrintScreen,
                freezeOnEnd: session.freezeOnEnd,
                allowOffline: session.allowOffline,
                connectivityMode: session.connectivityMode,
                websiteAccessMode: session.websiteAccessMode,
                restrictExistingFiles: session.restrictExistingFiles,
                restrictUnauthorizedApps: session.restrictUnauthorizedApps,
                activityMonitoring: session.activityMonitoring,
                activityUpdateInterval: session.activityUpdateInterval,
                activitySensitivity: session.activitySensitivity,
                idleThresholdSeconds: session.idleThresholdSeconds,
                violationSensitivity: session.violationSensitivity,
                warningMinutes: session.warningMinutes,
                screenshotInterval: session.screenshotInterval,
                sessionMode: session.sessionMode,
                questionMode: session.questionMode,
                instructions: session.instructions,
                startupUrl: session.startupUrl,
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
            id: session.id,
            sessionId: session.id,
            sessionCode: session.sessionCode,
            classTitle: session.classTitle,
            allowInternet: session.allowInternet,
            allowClipboard: session.allowClipboard,
            allowUsb: session.allowUsb,
            allowTaskManager: session.allowTaskManager,
            allowAltTab: session.allowAltTab,
            allowWindowsKey: session.allowWindowsKey,
            allowPrintScreen: session.allowPrintScreen,
            allowOffline: session.allowOffline,
            connectivityMode: session.connectivityMode,
            websiteAccessMode: session.websiteAccessMode,
            restrictExistingFiles: session.restrictExistingFiles,
            restrictUnauthorizedApps: session.restrictUnauthorizedApps,
            activityMonitoring: session.activityMonitoring,
            activityUpdateInterval: session.activityUpdateInterval,
            activitySensitivity: session.activitySensitivity,
            idleThresholdSeconds: session.idleThresholdSeconds,
            violationSensitivity: session.violationSensitivity,
            freezeOnEnd: session.freezeOnEnd,
            warningMinutes: session.warningMinutes,
            screenshotInterval: session.screenshotInterval,
            sessionMode: session.sessionMode,
            questionMode: session.questionMode,
            instructions: session.instructions,
            startupUrl: session.startupUrl,
            allowedWebsites: session.allowedWebsites?.map((s) => s.domain) ?? [],
            blockedWebsites: session.blockedWebsites?.map((s) => s.domain) ?? [],
            allowedApplications: session.allowedApplications?.map((a) => a.processName) ?? [],
            blockedApplications: session.blockedApplications?.map((a) => a.processName) ?? [],
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
                    connectivityMode: dto.connectivityMode,
                    websiteAccessMode: dto.websiteAccessMode,
                    restrictExistingFiles: dto.restrictExistingFiles,
                    restrictUnauthorizedApps: dto.restrictUnauthorizedApps,
                    activityMonitoring: dto.activityMonitoring,
                    activityUpdateInterval: dto.activityUpdateInterval,
                    activitySensitivity: dto.activitySensitivity,
                    idleThresholdSeconds: dto.idleThresholdSeconds,
                    violationSensitivity: dto.violationSensitivity,
                    freezeOnEnd: dto.freezeOnEnd,
                    warningMinutes: dto.warningMinutes,
                    screenshotInterval: dto.screenshotInterval,
                    sessionMode: dto.sessionMode,
                    questionMode: dto.questionMode,
                    instructions: dto.instructions,
                    startupUrl: dto.startupUrl,
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
        const updatedPolicy = await this.getSessionPolicy(sessionId);
        this.sessionRealtimeService.emitPolicyUpdated(sessionId, updatedPolicy);
        this.sessionRealtimeService.emitToSession(sessionId, 'session:policy', updatedPolicy);
        return updatedPolicy;
    }
    async generateRecoveryCode(issuerId, role, dto) {
        const session = await this.prisma.classSession.findFirst({
            where: {
                OR: [{ id: dto.sessionId }, { sessionCode: dto.sessionId.toUpperCase() }],
            },
        });
        if (!session) {
            throw new common_1.NotFoundException('Session not found');
        }
        if (role !== 'ADMIN' && session.teacherId !== issuerId) {
            throw new common_1.ForbiddenException('You are not authorized to issue recovery codes for this session');
        }
        const student = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { id: dto.studentIdOrReg },
                    { regNumber: dto.studentIdOrReg.trim().toUpperCase() },
                    { rollNumber: dto.studentIdOrReg.trim().toUpperCase() },
                    { username: dto.studentIdOrReg.trim().toUpperCase() },
                ],
            },
        });
        if (!student) {
            throw new common_1.NotFoundException(`Student record not found for "${dto.studentIdOrReg}"`);
        }
        const rawCode = (0, crypto_1.randomUUID)().replace(/-/g, '').substring(0, 8).toUpperCase();
        const recoveryCode = `REC-${rawCode}`;
        const issuedAt = Date.now();
        const expiresAt = issuedAt + 30 * 60 * 1000;
        const record = {
            code: recoveryCode,
            sessionId: session.id,
            sessionCode: session.sessionCode,
            studentId: student.id,
            studentName: student.name || student.username,
            regNumber: student.regNumber || student.rollNumber || student.username,
            hostname: dto.hostname,
            issuerId,
            issuedAt,
            expiresAt,
            used: false,
        };
        this.recoveryCodes.set(recoveryCode, record);
        await this.prisma.auditLog.create({
            data: {
                actorId: issuerId,
                action: 'RECOVERY_CODE_ISSUED',
                targetPc: dto.hostname || 'UNKNOWN',
                metadata: JSON.stringify({
                    recoveryCode,
                    sessionId: session.id,
                    sessionCode: session.sessionCode,
                    studentId: student.id,
                    studentName: student.name || student.username,
                    expiresAt: new Date(expiresAt).toISOString(),
                    reason: dto.reason || 'Crash recovery / power loss reconnection authorized',
                }),
            },
        });
        return {
            success: true,
            recoveryCode,
            sessionId: session.id,
            sessionCode: session.sessionCode,
            studentId: student.id,
            studentName: student.name || student.username,
            regNumber: student.regNumber || student.rollNumber || student.username,
            expiresAt: new Date(expiresAt).toISOString(),
            expiresInMinutes: 30,
        };
    }
    async validateRecoveryCode(dto) {
        const code = (dto.recoveryCode || '').trim().toUpperCase();
        if (!code) {
            throw new common_1.BadRequestException('Recovery code is required');
        }
        const record = this.recoveryCodes.get(code);
        if (!record) {
            throw new common_1.NotFoundException('Invalid or expired recovery code. Please contact your instructor.');
        }
        if (record.used) {
            throw new common_1.BadRequestException('This recovery code has already been used.');
        }
        if (Date.now() > record.expiresAt) {
            this.recoveryCodes.delete(code);
            throw new common_1.BadRequestException('Recovery code has expired. Please request a new code.');
        }
        const session = await this.prisma.classSession.findUnique({
            where: { id: record.sessionId },
        });
        if (!session || session.status === 'ENDED' || session.status === 'CANCELLED') {
            throw new common_1.BadRequestException('The associated session has already ended.');
        }
        const student = await this.prisma.user.findUnique({
            where: { id: record.studentId },
        });
        if (!student) {
            throw new common_1.NotFoundException('Student account not found.');
        }
        record.used = true;
        const token = this.jwt.sign({
            sub: student.id,
            username: student.username,
            role: 'STUDENT',
            regNumber: student.regNumber || student.rollNumber,
            sessionId: session.id,
        });
        if (dto.pcHostname) {
            try {
                await this.pcsService.markOnline(dto.pcHostname, undefined, session.id, student.id);
            }
            catch {
            }
        }
        const policy = await this.getSessionPolicy(session.id);
        await this.prisma.auditLog.create({
            data: {
                actorId: student.id,
                action: 'RECOVERY_LOGIN_SUCCESS',
                targetPc: dto.pcHostname || record.hostname || 'UNKNOWN',
                metadata: JSON.stringify({
                    recoveryCode: code,
                    sessionId: session.id,
                    sessionCode: session.sessionCode,
                    hostname: dto.pcHostname || record.hostname,
                }),
            },
        });
        return {
            token,
            user: {
                id: student.id,
                name: student.name || student.username,
                username: student.username,
                role: 'STUDENT',
                regNumber: student.regNumber || student.rollNumber,
            },
            session: {
                id: session.id,
                sessionCode: session.sessionCode,
                classTitle: session.classTitle,
                durationMinutes: session.durationMinutes,
                status: session.status,
            },
            policy,
            isRecoveredSession: true,
        };
    }
};
exports.SessionsService = SessionsService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SessionsService.prototype, "handleExpiredSessions", null);
exports.SessionsService = SessionsService = SessionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        session_realtime_service_1.SessionRealtimeService,
        rate_limiter_service_1.RateLimiterService,
        pcs_service_1.PcsService])
], SessionsService);
//# sourceMappingURL=sessions.service.js.map