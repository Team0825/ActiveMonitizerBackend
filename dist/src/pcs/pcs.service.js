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
exports.PcsService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
let PcsService = class PcsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async markOnline(hostname, labName, sessionId, studentId) {
        const normalizedHostname = hostname.trim();
        let internalSessionId = null;
        const hasSession = typeof sessionId === 'string' &&
            !!sessionId.trim();
        if (hasSession) {
            const sessionIdentifier = sessionId.trim();
            const session = await this.prisma.classSession.findFirst({
                where: {
                    OR: [
                        {
                            id: sessionIdentifier,
                        },
                        {
                            sessionCode: sessionIdentifier.toUpperCase(),
                        },
                    ],
                },
                select: {
                    id: true,
                },
            });
            if (session) {
                internalSessionId = session.id;
            }
        }
        return this.prisma.pc.upsert({
            where: {
                hostname: normalizedHostname,
            },
            create: {
                hostname: normalizedHostname,
                labName,
                status: 'ONLINE',
                currentSessionId: internalSessionId,
                currentStudentId: studentId,
                lastSeen: new Date(),
            },
            update: {
                status: 'ONLINE',
                labName: labName ?? undefined,
                currentSessionId: hasSession
                    ? internalSessionId
                    : undefined,
                currentStudentId: hasSession
                    ? studentId ?? null
                    : undefined,
                lastSeen: new Date(),
            },
        });
    }
    async markOffline(hostname) {
        const normalizedHostname = hostname.trim();
        return this.prisma.pc
            .update({
            where: {
                hostname: normalizedHostname,
            },
            data: {
                status: 'OFFLINE',
                currentSessionId: null,
                currentStudentId: null,
            },
        })
            .catch(() => null);
    }
    async markPresenceOffline(hostname) {
        const normalizedHostname = hostname.trim();
        return this.prisma.pc
            .updateMany({
            where: {
                hostname: normalizedHostname,
                currentSessionId: null,
            },
            data: {
                status: 'OFFLINE',
            },
        })
            .catch(() => null);
    }
    async touchHeartbeat(hostname) {
        const normalizedHostname = hostname.trim();
        return this.prisma.pc
            .update({
            where: {
                hostname: normalizedHostname,
            },
            data: {
                lastSeen: new Date(),
                status: 'ONLINE',
            },
        })
            .catch(() => null);
    }
    async setStatus(hostname, status) {
        const normalizedHostname = hostname.trim();
        return this.prisma.pc
            .update({
            where: {
                hostname: normalizedHostname,
            },
            data: {
                status,
            },
        })
            .catch(() => null);
    }
    async listPcsForSession(sessionId) {
        const sessionIdentifier = sessionId.trim();
        const session = await this.prisma.classSession.findFirst({
            where: {
                OR: [
                    {
                        id: sessionIdentifier,
                    },
                    {
                        sessionCode: sessionIdentifier.toUpperCase(),
                    },
                ],
            },
            select: {
                id: true,
            },
        });
        if (!session) {
            return [];
        }
        const participants = await this.prisma
            .sessionParticipant
            .findMany({
            where: {
                sessionId: session.id,
                pcHostname: {
                    not: null,
                },
            },
            select: {
                pcHostname: true,
            },
        });
        const participantHostnames = participants
            .map(participant => participant.pcHostname
            ?.trim())
            .filter((hostname) => !!hostname);
        return this.prisma.pc.findMany({
            where: {
                status: 'ONLINE',
                OR: [
                    {
                        currentSessionId: session.id,
                    },
                    {
                        hostname: {
                            in: participantHostnames,
                        },
                    },
                ],
            },
            orderBy: {
                hostname: 'asc',
            },
        });
    }
    async logCommand(actorId, action, targetPc, metadata) {
        return this.prisma.auditLog.create({
            data: {
                actorId,
                action,
                targetPc,
                metadata: metadata
                    ? JSON.stringify(metadata)
                    : null,
            },
        });
    }
    async recordActivity(hostname, sessionId, studentId, active, sampleSeconds, reportedPercentage, activeApp, idleSeconds) {
        const normalizedHostname = hostname.trim();
        const session = await this.prisma.classSession.findFirst({
            where: {
                OR: [
                    {
                        id: sessionId.trim(),
                    },
                    {
                        sessionCode: sessionId
                            .trim()
                            .toUpperCase(),
                    },
                ],
            },
        });
        if (!session) {
            throw new Error('Session not found.');
        }
        if (session.status !==
            'ACTIVE') {
            throw new Error('Session is not active.');
        }
        const pc = await this.prisma.pc.findUnique({
            where: {
                hostname: normalizedHostname,
            },
        });
        if (!pc) {
            throw new Error('PC is not registered.');
        }
        if (pc.currentSessionId !==
            session.id) {
            throw new Error('PC is not registered to this session.');
        }
        if (pc.currentStudentId !==
            studentId) {
            throw new Error('PC is not registered to this student.');
        }
        const participant = await this.prisma.sessionParticipant.findUnique({
            where: {
                sessionId_studentId: {
                    sessionId: session.id,
                    studentId,
                },
            },
        });
        if (!participant) {
            throw new Error('Student is not a participant of this session.');
        }
        const now = new Date();
        const elapsedSeconds = Math.max(1, Math.floor((now.getTime() -
            participant.joinedAt.getTime()) / 1000));
        const attendance = await this.prisma.attendance.findUnique({
            where: {
                sessionId_studentId: {
                    sessionId: session.id,
                    studentId,
                },
            },
        });
        if (!attendance) {
            throw new Error('Attendance record not found.');
        }
        const currentActiveSeconds = attendance.presentSeconds ??
            0;
        const additionalActiveSeconds = active
            ? Math.floor(sampleSeconds)
            : 0;
        const updatedActiveSeconds = Math.min(elapsedSeconds, currentActiveSeconds +
            additionalActiveSeconds);
        const cumulativePercentage = Math.min(100, Math.max(0, Math.round((updatedActiveSeconds /
            elapsedSeconds) *
            100)));
        const liveActivityPercentage = typeof reportedPercentage === 'number' && !isNaN(reportedPercentage)
            ? Math.min(100, Math.max(0, Math.round(reportedPercentage)))
            : cumulativePercentage;
        await this.prisma.attendance.update({
            where: {
                sessionId_studentId: {
                    sessionId: session.id,
                    studentId,
                },
            },
            data: {
                presentSeconds: updatedActiveSeconds,
                activityPercent: cumulativePercentage,
            },
        });
        await this.touchHeartbeat(normalizedHostname);
        return {
            hostname: normalizedHostname,
            sessionId: session.id,
            sessionCode: session.sessionCode,
            studentId,
            active,
            sampleSeconds,
            activeSeconds: updatedActiveSeconds,
            elapsedSeconds,
            activityPercentage: liveActivityPercentage,
            activeApp: activeApp || 'Active',
            idleSeconds: idleSeconds ?? 0,
            updatedAt: now.toISOString(),
        };
    }
    async updateSystemInfo(hostname, info) {
        const healthStatus = (info.cpuUsage > 90 ||
            info.ramUsagePercent > 90 ||
            info.diskUsagePercent > 95)
            ? "CRITICAL"
            : (info.cpuUsage >= 80 ||
                info.ramUsagePercent >= 80 ||
                info.diskUsagePercent >= 90)
                ? "WARNING"
                : "GOOD";
        const internetStatus = info.internetConnected
            ? "ONLINE"
            : "OFFLINE";
        const pc = await this.prisma.pc.upsert({
            where: {
                hostname
            },
            create: {
                hostname,
                agentVersion: info.agentVersion,
                cpuName: info.processorName,
                osName: info.osName,
                osVersion: info.osVersion,
                osArchitecture: info.osArchitecture,
                totalMemoryMb: info.totalMemoryMb,
                availableMemoryMb: info.freeMemoryMb,
                totalDiskMb: info.totalDiskGb * 1024,
                availableDiskMb: info.freeDiskGb * 1024,
                healthStatus,
                internetStatus,
                status: 'ONLINE',
                lastSeen: new Date(),
                lastHealthCheck: new Date(),
                lastSyncAt: new Date()
            },
            update: {
                agentVersion: info.agentVersion,
                cpuName: info.processorName,
                osName: info.osName,
                osVersion: info.osVersion,
                osArchitecture: info.osArchitecture,
                totalMemoryMb: info.totalMemoryMb,
                availableMemoryMb: info.freeMemoryMb,
                totalDiskMb: info.totalDiskGb * 1024,
                availableDiskMb: info.freeDiskGb * 1024,
                healthStatus,
                internetStatus,
                lastHealthCheck: new Date(),
                lastSyncAt: new Date()
            }
        });
        await this.prisma.pcHealthReport.create({
            data: {
                gpuName: info.gpuName,
                gpuDriverVersion: info.gpuDriverVersion,
                uptimeSeconds: info.uptimeSeconds,
                restartRequired: info.restartRequired,
                firewallEnabled: info.firewallEnabled,
                antivirusEnabled: info.antivirusEnabled,
                pcId: pc.id,
                agentVersion: info.agentVersion,
                osName: info.osName,
                osVersion: info.osVersion,
                osArchitecture: info.osArchitecture,
                processArchitecture: info.processArchitecture,
                processorCount: info.processorCount,
                dotNetVersion: info.dotNetVersion,
                ramUsage: info.ramUsage,
                totalMemoryMb: info.totalMemoryMb,
                freeMemoryMb: info.freeMemoryMb,
                diskUsage: info.diskUsage,
                totalDiskGb: info.totalDiskGb,
                freeDiskGb: info.freeDiskGb,
                internetConnected: info.internetConnected,
                cpuUsagePercent: info.cpuUsage,
                memoryUsagePercent: info.ramUsagePercent,
                diskUsagePercent: info.diskUsagePercent,
                availableMemoryMb: info.freeMemoryMb,
                availableDiskMb: info.freeDiskGb * 1024,
                healthStatus,
                internetStatus,
                lastSystemReport: new Date()
            }
        });
        return pc;
    }
    async getHealth() {
        const LIVE_HEARTBEAT_SECONDS = 15;
        const now = Date.now();
        const pcs = await this.prisma.pc.findMany({
            orderBy: {
                hostname: 'asc',
            },
            include: {
                healthReports: {
                    orderBy: {
                        reportedAt: 'desc',
                    },
                    take: 1,
                },
            },
        });
        return pcs.map(pc => {
            const health = pc.healthReports[0] ?? null;
            const isLive = pc.status === 'ONLINE' &&
                pc.lastSeen != null &&
                now - pc.lastSeen.getTime() <= LIVE_HEARTBEAT_SECONDS * 1000;
            const effectiveStatus = isLive ? pc.status : 'OFFLINE';
            return {
                hostname: pc.hostname,
                displayName: pc.displayName,
                labName: pc.labName,
                status: effectiveStatus,
                online: isLive,
                lastSeen: pc.lastSeen,
                heartbeatAgeSeconds: pc.lastSeen
                    ? Math.floor((now - pc.lastSeen.getTime()) / 1000)
                    : null,
                sessionId: pc.currentSessionId,
                studentId: pc.currentStudentId,
                os: {
                    name: health?.osName ?? pc.osName,
                    version: health?.osVersion ?? pc.osVersion,
                    architecture: health?.osArchitecture ?? pc.osArchitecture,
                },
                cpu: {
                    name: pc.cpuName,
                    usagePercent: health?.cpuUsagePercent ?? null,
                    processorCount: health?.processorCount ?? null,
                },
                gpu: {
                    name: health?.gpuName ??
                        pc.gpuName ??
                        null,
                    driverVersion: health?.gpuDriverVersion ??
                        pc.gpuDriverVersion ??
                        null,
                },
                memory: {
                    totalMb: health?.totalMemoryMb ??
                        pc.totalMemoryMb,
                    availableMb: health?.availableMemoryMb ??
                        pc.availableMemoryMb,
                    usedMb: health?.totalMemoryMb != null &&
                        health?.availableMemoryMb != null
                        ? health.totalMemoryMb -
                            health.availableMemoryMb
                        : pc.totalMemoryMb != null &&
                            pc.availableMemoryMb != null
                            ? pc.totalMemoryMb -
                                pc.availableMemoryMb
                            : null,
                    usagePercent: health?.memoryUsagePercent ?? null,
                },
                disk: {
                    totalMb: health?.totalDiskGb != null
                        ? health.totalDiskGb * 1024
                        : pc.totalDiskMb,
                    availableMb: health?.freeDiskGb != null
                        ? health.freeDiskGb * 1024
                        : pc.availableDiskMb,
                    usedMb: health?.totalDiskGb != null &&
                        health?.freeDiskGb != null
                        ? (health.totalDiskGb * 1024) -
                            (health.freeDiskGb * 1024)
                        : pc.totalDiskMb != null &&
                            pc.availableDiskMb != null
                            ? pc.totalDiskMb -
                                pc.availableDiskMb
                            : null,
                    usagePercent: health?.diskUsagePercent ?? null,
                },
                agent: {
                    version: health?.agentVersion ??
                        pc.agentVersion,
                    clientVersion: pc.clientVersion,
                    dotNetVersion: health?.dotNetVersion ?? null,
                    processArchitecture: health?.processArchitecture ?? null,
                },
                system: {
                    uptimeSeconds: health?.uptimeSeconds ??
                        pc.uptimeSeconds ??
                        null,
                    restartRequired: health?.restartRequired ??
                        pc.restartRequired ??
                        null,
                },
                security: {
                    firewallEnabled: health?.firewallEnabled ??
                        pc.firewallEnabled ??
                        null,
                    antivirusEnabled: health?.antivirusEnabled ??
                        pc.antivirusEnabled ??
                        null,
                },
                healthStatus: health?.healthStatus ??
                    pc.healthStatus,
                updateStatus: pc.updateStatus,
                internetStatus: health?.internetStatus ??
                    pc.internetStatus,
                internetConnected: health?.internetConnected ?? null,
                latencyMs: health?.latencyMs ??
                    pc.latencyMs,
                lastHealthCheck: pc.lastHealthCheck,
                lastSystemReport: health?.reportedAt ??
                    health?.lastSystemReport ??
                    pc.lastHealthCheck ??
                    null,
                lastSyncAt: pc.lastSyncAt,
                registeredAt: pc.registeredAt,
                updatedAt: pc.updatedAt,
            };
        });
    }
    async logViolation(hostname, sessionId, type, details, occurredAt, explicitSeverity, explicitStudent) {
        const trimmedHost = (hostname || 'Unknown PC').trim();
        let session = null;
        if (sessionId && sessionId.trim()) {
            session = await this.prisma.classSession.findFirst({
                where: {
                    OR: [
                        { id: sessionId.trim() },
                        { sessionCode: sessionId.trim().toUpperCase() },
                    ],
                },
                select: { id: true, sessionCode: true, classTitle: true },
            });
        }
        const pc = await this.prisma.pc.findUnique({
            where: { hostname: trimmedHost },
            select: { currentStudentId: true, currentSessionId: true, displayName: true, labName: true },
        });
        if (!session && pc?.currentSessionId) {
            session = await this.prisma.classSession.findUnique({
                where: { id: pc.currentSessionId },
                select: { id: true, sessionCode: true, classTitle: true },
            });
        }
        let student = explicitStudent || null;
        const targetStudentId = pc?.currentStudentId || student?.id;
        if (!student && targetStudentId) {
            const studentRecord = await this.prisma.user.findUnique({
                where: { id: targetStudentId },
                select: { id: true, name: true, username: true, regNumber: true, rollNumber: true },
            });
            if (studentRecord) {
                student = {
                    id: studentRecord.id,
                    name: studentRecord.name || studentRecord.username,
                    username: studentRecord.username,
                    regNumber: studentRecord.regNumber || studentRecord.rollNumber,
                };
            }
        }
        if (!session || !student) {
            const recentParticipant = await this.prisma.sessionParticipant.findFirst({
                where: { pcHostname: trimmedHost },
                orderBy: { joinedAt: 'desc' },
                include: {
                    session: { select: { id: true, sessionCode: true, classTitle: true } },
                    student: { select: { id: true, name: true, username: true, regNumber: true, rollNumber: true } },
                },
            });
            if (!session && recentParticipant?.session) {
                session = recentParticipant.session;
            }
            if (!student && recentParticipant?.student) {
                student = {
                    id: recentParticipant.student.id,
                    name: recentParticipant.student.name || recentParticipant.student.username,
                    username: recentParticipant.student.username,
                    regNumber: recentParticipant.student.regNumber || recentParticipant.student.rollNumber,
                };
            }
        }
        const normType = (type || 'AGENT_TAMPER').toUpperCase();
        let computedSeverity = explicitSeverity || 'MEDIUM';
        if (!explicitSeverity) {
            if (normType === 'AGENT_STOPPED' || normType === 'AGENT_TAMPER' || normType === 'RESTRICTION_BYPASS') {
                computedSeverity = 'CRITICAL';
            }
            else if (normType === 'AGENT_DISCONNECTED' ||
                normType === 'UNAUTHORIZED_AUTHORITY_ACCESS' ||
                normType === 'FAILED_AUTHORITY_LOGIN' ||
                normType === 'RATE_LIMIT_TRIGGERED' ||
                normType === 'UNAUTHORIZED_APPLICATION' ||
                normType === 'NETWORK_BYPASS' ||
                normType === 'BROWSER_EXIT') {
                computedSeverity = 'HIGH';
            }
            else if (normType === 'FAILED_LOGIN' ||
                normType === 'FAILED_ADMIN_LOGIN' ||
                normType === 'TASK_MANAGER_BLOCKED' ||
                normType === 'ALT_TAB_BLOCKED' ||
                normType === 'WINDOWS_KEY_BLOCKED' ||
                normType === 'PRINT_SCREEN_BLOCKED' ||
                normType === 'SHORTCUT_BYPASS' ||
                normType === 'OTHER') {
                computedSeverity = 'MEDIUM';
            }
            else if (normType === 'SPECIAL_ACCESS' || normType === 'LATE_ENTRY' || normType === 'FAILED_STUDENT_LOGIN') {
                computedSeverity = 'LOW';
            }
        }
        const payload = {
            id: (0, crypto_1.randomUUID)(),
            hostname: trimmedHost,
            sessionId: session?.id ?? sessionId ?? null,
            sessionCode: session?.sessionCode ?? sessionId ?? null,
            classTitle: session?.classTitle ?? 'General Activity',
            type: normType,
            details: details || 'Security violation detected',
            student,
            occurredAt: occurredAt || new Date().toISOString(),
            status: 'UNRESOLVED',
            severity: computedSeverity,
        };
        await this.prisma.auditLog.create({
            data: {
                actorId: targetStudentId || student?.username || 'AGENT',
                action: 'VIOLATION',
                targetPc: trimmedHost,
                metadata: JSON.stringify(payload),
            },
        });
        return payload;
    }
    async getViolations(sessionId) {
        const logs = await this.prisma.auditLog.findMany({
            where: {
                action: 'VIOLATION',
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 100,
        });
        const violations = logs.map((log) => {
            try {
                if (log.metadata) {
                    const parsed = JSON.parse(log.metadata);
                    return {
                        id: log.id,
                        ...parsed,
                        createdAt: log.createdAt,
                    };
                }
            }
            catch {
            }
            return {
                id: log.id,
                hostname: log.targetPc || 'Unknown PC',
                type: 'AGENT_TAMPER',
                details: log.metadata || 'Violation detected',
                occurredAt: log.createdAt.toISOString(),
                status: 'UNRESOLVED',
                severity: 'WARNING',
            };
        });
        if (sessionId) {
            return violations.filter((v) => v.sessionId === sessionId || v.sessionCode === sessionId);
        }
        return violations;
    }
    async recordHeartbeat(dto) {
        const hostname = (dto.hostname || '').trim().toUpperCase();
        if (!hostname)
            return { success: false, message: 'Hostname required' };
        const now = new Date();
        const pc = await this.prisma.pc.upsert({
            where: { hostname },
            create: {
                hostname,
                displayName: hostname,
                labName: dto.labName || 'Main Lab',
                status: 'ONLINE',
                healthStatus: dto.healthStatus || 'HEALTHY',
                internetStatus: 'ONLINE',
                agentVersion: dto.agentVersion || '1.0.0',
                currentSessionId: dto.sessionId || null,
                currentStudentId: dto.studentId || null,
                lastSeen: now,
            },
            update: {
                status: 'ONLINE',
                healthStatus: dto.healthStatus || undefined,
                agentVersion: dto.agentVersion || undefined,
                currentSessionId: dto.sessionId || undefined,
                currentStudentId: dto.studentId || undefined,
                lastSeen: now,
            },
        });
        return {
            success: true,
            hostname,
            status: 'ONLINE',
            lastSeen: now.toISOString(),
            cbtStatus: pc.cbtStatus || 'IDLE',
        };
    }
    async getAllPcs() {
        const pcs = await this.prisma.pc.findMany({
            orderBy: { hostname: 'asc' },
        });
        const now = Date.now();
        return pcs.map((pc) => {
            const lastSeenMs = pc.lastSeen ? new Date(pc.lastSeen).getTime() : 0;
            const isLive = pc.status === 'ONLINE' && now - lastSeenMs < 45 * 1000;
            return {
                id: pc.id,
                hostname: pc.hostname,
                displayName: pc.displayName || pc.hostname,
                labName: pc.labName || 'Main Lab',
                status: isLive ? 'CONNECTED' : 'OFFLINE',
                connectionStatus: isLive ? 'CONNECTED' : 'OFFLINE',
                healthStatus: isLive ? pc.healthStatus || 'HEALTHY' : 'OFFLINE',
                internetStatus: isLive ? pc.internetStatus || 'ONLINE' : 'OFFLINE',
                cbtStatus: pc.cbtStatus || 'IDLE',
                assignedStudentId: pc.assignedStudentId || null,
                assignedInvigilatorId: pc.assignedInvigilatorId || null,
                currentSessionId: pc.currentSessionId || null,
                lastSeen: pc.lastSeen || null,
                registeredAt: pc.registeredAt,
            };
        });
    }
    async deleteHealthRecord(hostname) {
        const upperHost = (hostname || '').trim().toUpperCase();
        const pc = await this.prisma.pc.findFirst({
            where: {
                hostname: {
                    equals: upperHost,
                    mode: 'insensitive',
                },
            },
        });
        if (!pc) {
            throw new common_1.NotFoundException(`Workstation (${hostname}) not found.`);
        }
        const now = Date.now();
        const lastSeenMs = pc.lastSeen ? new Date(pc.lastSeen).getTime() : 0;
        const isLive = pc.status === 'ONLINE' && now - lastSeenMs <= 15 * 1000;
        if (isLive) {
            throw new common_1.BadRequestException(`Workstation "${pc.hostname}" is currently ONLINE. Active/Online health records cannot be deleted.`);
        }
        await this.prisma.pcHealthReport.deleteMany({
            where: { pcId: pc.id },
        });
        await this.prisma.pc.update({
            where: { id: pc.id },
            data: {
                healthStatus: 'UNKNOWN',
                lastHealthCheck: null,
            },
        });
        return {
            success: true,
            message: `Offline health record for "${pc.hostname}" successfully deleted.`,
            hostname: pc.hostname,
        };
    }
};
exports.PcsService = PcsService;
exports.PcsService = PcsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PcsService);
//# sourceMappingURL=pcs.service.js.map