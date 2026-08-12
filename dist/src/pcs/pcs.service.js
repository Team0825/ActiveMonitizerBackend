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
    async logViolation(hostname, sessionId, type, details, occurredAt) {
        const session = await this.prisma.classSession.findFirst({
            where: {
                OR: [
                    { id: sessionId.trim() },
                    { sessionCode: sessionId.trim().toUpperCase() },
                ],
            },
            select: { id: true, sessionCode: true, classTitle: true },
        });
        const pc = await this.prisma.pc.findUnique({
            where: { hostname: hostname.trim() },
            select: { currentStudentId: true, displayName: true, labName: true },
        });
        let student = null;
        if (pc?.currentStudentId) {
            const studentRecord = await this.prisma.user.findUnique({
                where: { id: pc.currentStudentId },
                select: { id: true, name: true, username: true, regNumber: true, rollNumber: true },
            });
            if (studentRecord) {
                student = {
                    id: studentRecord.id,
                    name: studentRecord.name || studentRecord.username,
                    regNumber: studentRecord.regNumber || studentRecord.rollNumber,
                };
            }
        }
        const payload = {
            id: (0, crypto_1.randomUUID)(),
            hostname: hostname.trim(),
            sessionId: session?.id ?? sessionId,
            sessionCode: session?.sessionCode ?? sessionId,
            classTitle: session?.classTitle ?? 'Session',
            type: type || 'AGENT_TAMPER',
            details: details || 'Violation detected',
            student,
            occurredAt: occurredAt || new Date().toISOString(),
            status: 'UNRESOLVED',
            severity: (type === 'AGENT_STOPPED' || type === 'AGENT_TAMPER' || type === 'RESTRICTION_BYPASS') ? 'CRITICAL' : 'WARNING',
        };
        await this.prisma.auditLog.create({
            data: {
                actorId: pc?.currentStudentId || 'AGENT',
                action: 'VIOLATION',
                targetPc: hostname.trim(),
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
};
exports.PcsService = PcsService;
exports.PcsService = PcsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PcsService);
//# sourceMappingURL=pcs.service.js.map