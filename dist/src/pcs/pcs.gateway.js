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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PcsGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PcsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const crypto_1 = require("crypto");
const socket_io_1 = require("socket.io");
const prisma_service_1 = require("../prisma/prisma.service");
const session_realtime_service_1 = require("../realtime/session-realtime.service");
const pcs_service_1 = require("./pcs.service");
const pcs_dto_1 = require("./dto/pcs.dto");
let PcsGateway = PcsGateway_1 = class PcsGateway {
    constructor(jwt, prisma, pcsService, sessionRealtimeService) {
        this.jwt = jwt;
        this.prisma = prisma;
        this.pcsService = pcsService;
        this.sessionRealtimeService = sessionRealtimeService;
        this.logger = new common_1.Logger(PcsGateway_1.name);
        this.pendingCommands = new Map();
    }
    afterInit(server) {
        this.sessionRealtimeService
            .setServer(server);
        this.logger.log('Realtime gateway initialized.');
    }
    async handleConnection(client) {
        const auth = client.handshake.auth ?? {};
        const presenceMode = auth.mode === 'pc-presence';
        const presenceHostname = typeof auth.hostname === 'string'
            ? auth.hostname.trim()
            : '';
        if (presenceMode) {
            if (!presenceHostname) {
                this.logger.warn(`Rejected PC presence socket ${client.id}: hostname missing`);
                client.disconnect(true);
                return;
            }
            client.data.hostname =
                presenceHostname;
            client.data.pcPresence =
                true;
            await this.pcsService.markOnline(presenceHostname);
            this.logger.log(`PC presence connected: ${client.id} | ${presenceHostname}`);
            return;
        }
        const token = client.handshake.auth
            ?.token ||
            client.handshake.query
                ?.token;
        if (!token) {
            this.logger.warn(`Rejected socket ${client.id}: no token`);
            client.disconnect(true);
            return;
        }
        try {
            const payload = await this.jwt.verifyAsync(token);
            client.data.user =
                payload;
            this.logger.log(`Socket connected: ${client.id} | ${payload.username} | ${payload.role}`);
        }
        catch (error) {
            this.logger.error(error);
            this.logger.warn(`Rejected socket ${client.id}: invalid token`);
            client.disconnect(true);
        }
    }
    async handleDisconnect(client) {
        const hostname = client.data?.hostname;
        if (!hostname) {
            return;
        }
        if (client.data.pcPresence) {
            await this.pcsService
                .markPresenceOffline(hostname);
            return;
        }
        const pc = await this.prisma.pc
            .findUnique({
            where: {
                hostname,
            },
        });
        await this.pcsService
            .markOffline(hostname);
        if (pc?.currentSessionId) {
            this.server
                .to(`session:${pc.currentSessionId}`)
                .emit('pc:status-update', {
                hostname,
                status: 'OFFLINE',
            });
        }
    }
    async onRegisterPc(client, payload) {
        try {
            (0, pcs_dto_1.assertRegisterPcPayload)(payload);
        }
        catch (error) {
            client.emit('error', {
                message: error
                    instanceof Error
                    ? error.message
                    : 'Invalid PC registration payload',
            });
            return;
        }
        const user = client.data.user;
        const isAgent = !user;
        const isStudent = user?.role === 'STUDENT';
        if (!isAgent && !isStudent) {
            client.emit('error', {
                message: 'Only ActivityMonAgent or Student clients can register a PC',
            });
            return;
        }
        const hostname = payload.hostname
            .trim();
        client.data.hostname =
            hostname;
        const registrationSessionId = typeof payload.sessionId ===
            'string' &&
            payload.sessionId.trim()
            ? payload.sessionId.trim()
            : user?.sessionId;
        await this.pcsService.markOnline(hostname, payload.labName, registrationSessionId, client.data.user?.sub);
        this.logger.log(`[PC-CONTROL] Agent registered hostname/session ${hostname} ${registrationSessionId ?? 'NO_SESSION'}`);
        await client.join(`pc:${hostname}`);
        if (!registrationSessionId) {
            client.emit('pc:registered', {
                ok: true,
                hostname,
                status: 'ONLINE',
                sessionActive: false,
            });
            return;
        }
        const sessionIdentifier = registrationSessionId
            .trim();
        const session = await this.prisma
            .classSession
            .findFirst({
            where: {
                OR: [
                    {
                        id: sessionIdentifier,
                    },
                    {
                        sessionCode: sessionIdentifier
                            .toUpperCase(),
                    },
                ],
            },
        });
        if (!session) {
            client.emit('error', {
                message: 'Session not found for PC registration',
            });
            return;
        }
        if (session.status !==
            'ACTIVE') {
            client.emit('error', {
                message: 'Session is not active',
            });
            return;
        }
        const sessionRoom = `session:${session.id}`;
        await client.join(sessionRoom);
        this.server
            .to(sessionRoom)
            .emit('pc:status-update', {
            hostname,
            status: 'ONLINE',
            labName: payload.labName ?? null,
            studentId: client.data.user?.sub ?? null,
            sessionId: session.id,
            sessionCode: session.sessionCode,
            lastSeen: new Date().toISOString(),
        });
        this.sessionRealtimeService.emitPolicyUpdated(session.id, {
            sessionId: session.id,
            sessionCode: session.sessionCode,
            allowInternet: session.allowInternet,
            allowClipboard: session.allowClipboard,
            allowUsb: session.allowUsb,
            allowTaskManager: session.allowTaskManager,
            allowAltTab: session.allowAltTab,
            allowWindowsKey: session.allowWindowsKey,
            allowPrintScreen: session.allowPrintScreen,
            allowOffline: session.allowOffline,
            freezeOnEnd: session.freezeOnEnd,
            warningMinutes: session.warningMinutes,
            screenshotInterval: session.screenshotInterval,
            instructions: session.instructions,
            sessionMode: session.sessionMode,
            questionMode: session.questionMode,
            startupUrl: session.startupUrl,
        });
        const sessionWithPolicy = await this.prisma.classSession.findUnique({
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
        if (!sessionWithPolicy) {
            client.emit('error', {
                message: 'Unable to load session policy.',
            });
            return;
        }
        const allowedWebsites = sessionWithPolicy.allowedWebsites.map(site => site.domain);
        const blockedWebsites = sessionWithPolicy.blockedWebsites.map(site => site.domain);
        const allowedApplications = sessionWithPolicy.allowedApplications.map(app => app.processName);
        const blockedApplications = sessionWithPolicy.blockedApplications.map(app => app.processName);
        const policy = {
            allowInternet: sessionWithPolicy.allowInternet,
            allowClipboard: sessionWithPolicy.allowClipboard,
            allowUsb: sessionWithPolicy.allowUsb,
            allowTaskManager: sessionWithPolicy.allowTaskManager,
            allowAltTab: sessionWithPolicy.allowAltTab,
            allowWindowsKey: sessionWithPolicy.allowWindowsKey,
            allowPrintScreen: sessionWithPolicy.allowPrintScreen,
            allowOffline: sessionWithPolicy.allowOffline,
            restrictExistingFiles: sessionWithPolicy.restrictExistingFiles,
            restrictUnauthorizedApps: sessionWithPolicy.restrictUnauthorizedApps,
            freezeOnEnd: sessionWithPolicy.freezeOnEnd,
            warningMinutes: sessionWithPolicy.warningMinutes,
            screenshotInterval: sessionWithPolicy.screenshotInterval,
            sessionMode: sessionWithPolicy.sessionMode,
            questionMode: sessionWithPolicy.questionMode,
            instructions: sessionWithPolicy.instructions,
            startupUrl: sessionWithPolicy.startupUrl,
            allowedWebsites,
            blockedWebsites,
            allowedApplications,
            blockedApplications,
        };
        client.emit('pc:registered', {
            ok: true,
            hostname,
            status: 'ONLINE',
            sessionActive: true,
            sessionId: session.id,
            sessionCode: session.sessionCode,
            ...policy,
        });
        client.emit('session:policy', {
            sessionId: session.id,
            sessionCode: session.sessionCode,
            classTitle: session.classTitle,
            status: session.status,
            durationMinutes: session.durationMinutes,
            joinWindowMinutes: session.joinWindowMinutes,
            createdAt: session.createdAt,
            endsAt: session.endsAt,
            ...policy,
            localPersistence: session.allowOffline,
            syncedAt: new Date()
                .toISOString(),
        });
        this.logger.log(`PC ${hostname} registered for session ${session.sessionCode}`);
    }
    async onHeartbeat(payload) {
        if (payload?.hostname) {
            await this.pcsService
                .touchHeartbeat(payload.hostname);
        }
    }
    async onPcActivity(client, payload) {
        const user = client.data.user;
        if (!user ||
            user.role !==
                'STUDENT') {
            client.emit('error', {
                message: 'Only Student PC clients can report activity.',
            });
            return;
        }
        try {
            (0, pcs_dto_1.assertPcActivityPayload)(payload);
        }
        catch (error) {
            client.emit('error', {
                message: error
                    instanceof Error
                    ? error.message
                    : 'Invalid PC activity payload.',
            });
            return;
        }
        const hostname = payload.hostname
            .trim();
        if (!client.data.hostname) {
            client.emit('error', {
                message: 'PC must be registered before reporting activity.',
            });
            return;
        }
        if (client.data.hostname !==
            hostname) {
            client.emit('error', {
                message: 'Activity hostname does not match registered PC.',
            });
            return;
        }
        try {
            const activity = await this.pcsService
                .recordActivity(hostname, payload.sessionId, user.sub, payload.active, payload.sampleSeconds);
            client.emit('pc:activity-update', activity);
            this.server
                .to(`session:${activity.sessionId}`)
                .emit('pc:activity-update', activity);
            this.logger.debug(`Activity update from ${hostname}: ${activity.activityPercentage}%`);
        }
        catch (error) {
            this.logger.warn(`Activity report rejected from ${hostname}: ${error instanceof Error
                ? error.message
                : 'Unknown error'}`);
            client.emit('error', {
                message: error
                    instanceof Error
                    ? error.message
                    : 'Unable to process PC activity.',
            });
        }
    }
    async onTeacherSubscribe(client, payload) {
        const user = client.data.user;
        if (!user ||
            (user.role !==
                'TEACHER' &&
                user.role !==
                    'ADMIN')) {
            client.emit('error', {
                message: 'Only Teacher or Admin clients can subscribe to PC sessions.',
            });
            return;
        }
        if (!payload ||
            typeof payload.sessionId !==
                'string' ||
            !payload.sessionId.trim()) {
            client.emit('error', {
                message: 'sessionId is required',
            });
            return;
        }
        const session = await this.prisma
            .classSession
            .findFirst({
            where: {
                OR: [
                    {
                        id: payload.sessionId
                            .trim(),
                    },
                    {
                        sessionCode: payload.sessionId
                            .trim()
                            .toUpperCase(),
                    },
                ],
            },
        });
        if (!session) {
            client.emit('error', {
                message: 'Session not found',
            });
            return;
        }
        const sessionRoom = `session:${session.id}`;
        await client.join(sessionRoom);
        this.logger.log(`[PC-CONTROL] Teacher subscribed session ${session.id}`);
        const pcs = await this.pcsService
            .listPcsForSession(session.id);
        this.logger.log(`[PC-CONTROL] PCs found for session ${session.id}: ${pcs.length}`);
        client.emit('teacher:subscribed', {
            sessionId: session.id,
            sessionCode: session.sessionCode,
        });
        client.emit('pc:list', pcs);
        this.logger.log(`[PC-CONTROL] pc:list emitted count ${pcs.length}`);
    }
    async onTeacherCommand(client, payload) {
        const user = client.data.user;
        if (!user ||
            (user.role !==
                'TEACHER' &&
                user.role !==
                    'ADMIN')) {
            client.emit('error', {
                message: 'Only Teacher or Admin clients can send PC commands.',
            });
            return;
        }
        try {
            (0, pcs_dto_1.assertTeacherCommandPayload)(payload);
        }
        catch (error) {
            client.emit('error', {
                message: error
                    instanceof Error
                    ? error.message
                    : 'Invalid PC command payload.',
            });
            return;
        }
        const sessionIdentifier = payload.sessionId
            .trim();
        const session = await this.prisma
            .classSession
            .findFirst({
            where: {
                OR: [
                    {
                        id: sessionIdentifier,
                    },
                    {
                        sessionCode: sessionIdentifier
                            .toUpperCase(),
                    },
                ],
            },
        });
        if (!session) {
            client.emit('error', {
                message: 'Session not found',
            });
            return;
        }
        if (session.status !==
            'ACTIVE') {
            client.emit('error', {
                message: 'Session is not active',
            });
            return;
        }
        const pcs = await this.pcsService
            .listPcsForSession(session.id);
        const targetHostname = payload.targetHostname
            ?.trim() ||
            'ALL';
        const targetPcs = targetHostname ===
            'ALL'
            ? pcs
            : pcs.filter(pc => pc.hostname ===
                targetHostname);
        if (targetPcs.length ===
            0) {
            client.emit('error', {
                message: targetHostname ===
                    'ALL'
                    ? 'No connected PCs found for this session'
                    : 'Target PC is not connected to this session',
            });
            return;
        }
        const issuedAt = new Date();
        for (const pc of targetPcs) {
            const commandId = (0, crypto_1.randomUUID)();
            const command = {
                commandId,
                sessionId: session.id,
                action: payload.action,
                ...(payload.action ===
                    'MESSAGE'
                    ? {
                        message: payload.message
                            ?.trim(),
                    }
                    : {}),
                issuedBy: user.sub,
                issuedAt: issuedAt
                    .toISOString(),
            };
            this.pendingCommands
                .set(commandId, {
                commandId,
                sessionId: session.id,
                issuedBy: user.sub,
                issuedAt: issuedAt
                    .getTime(),
                targetHostname: pc.hostname,
            });
            this.server
                .to(`pc:${pc.hostname}`)
                .emit('command:execute', command);
            this.server
                .to(`session:${session.id}`)
                .emit('command:sent', {
                commandId,
                sessionId: session.id,
                sessionCode: session.sessionCode,
                targetHostname: pc.hostname,
                requestedTargetHostname: targetHostname,
                action: payload.action,
                issuedBy: user.sub,
                issuedAt: command.issuedAt,
            });
            await this.pcsService
                .logCommand(user.sub, payload.action, pc.hostname, {
                commandId,
                sessionId: session.id,
                targetHostname: pc.hostname,
                requestedTargetHostname: targetHostname,
            });
        }
    }
    async onCommandAck(client, payload) {
        try {
            (0, pcs_dto_1.assertPcCommandAckPayload)(payload);
        }
        catch (error) {
            client.emit('error', {
                message: error
                    instanceof Error
                    ? error.message
                    : 'Invalid command acknowledgement payload.',
            });
            return;
        }
        const pending = this.pendingCommands
            .get(payload.commandId);
        if (!pending) {
            return;
        }
        if (pending.targetHostname !==
            'ALL' &&
            pending.targetHostname !==
                payload.hostname) {
            client.emit('error', {
                message: 'Command acknowledgement hostname does not match the pending command.',
            });
            return;
        }
        const latencyMs = Date.now() -
            pending.issuedAt;
        const result = {
            ...payload,
            latencyMs,
        };
        this.server
            .to(`session:${pending.sessionId}`)
            .emit('command:result', result);
        if (payload.success) {
            const nextStatus = payload.action ===
                'LOCK'
                ? 'LOCKED'
                : payload.action ===
                    'FREEZE'
                    ? 'FROZEN'
                    : (payload.action ===
                        'UNLOCK' ||
                        payload.action ===
                            'UNFREEZE')
                        ? 'ONLINE'
                        : null;
            if (nextStatus) {
                await this.pcsService
                    .setStatus(payload.hostname, nextStatus);
                this.server
                    .to(`session:${pending.sessionId}`)
                    .emit('pc:status-update', {
                    hostname: payload.hostname,
                    status: nextStatus,
                });
            }
        }
        this.pendingCommands
            .delete(payload.commandId);
    }
    async handleSystemInfo(client, payload) {
        await this.pcsService.updateSystemInfo(payload.hostname, payload);
        this.server.emit("pc:system-info", payload);
    }
    async onPcViolation(_client, payload) {
        if (!payload || !payload.hostname || !payload.sessionId) {
            return;
        }
        const recorded = await this.pcsService.logViolation(payload.hostname, payload.sessionId, payload.type, payload.details, payload.occurredAt);
        this.server
            .to(`session:${recorded.sessionId}`)
            .emit('pc:violation', recorded);
        this.server.emit('pc:violation', recorded);
        this.logger.warn(`[VIOLATION] ${payload.type} on PC ${payload.hostname} in Session ${payload.sessionId}: ${payload.details}`);
    }
};
exports.PcsGateway = PcsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], PcsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('pc:register'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PcsGateway.prototype, "onRegisterPc", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('pc:heartbeat'),
    __param(0, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PcsGateway.prototype, "onHeartbeat", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('pc:activity'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PcsGateway.prototype, "onPcActivity", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('teacher:subscribe'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PcsGateway.prototype, "onTeacherSubscribe", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('teacher:command'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PcsGateway.prototype, "onTeacherCommand", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('command:ack'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PcsGateway.prototype, "onCommandAck", null);
__decorate([
    (0, websockets_1.SubscribeMessage)("pc:system-info"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], PcsGateway.prototype, "handleSystemInfo", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('pc:violation'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], PcsGateway.prototype, "onPcViolation", null);
exports.PcsGateway = PcsGateway = PcsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: '/realtime',
        cors: {
            origin: '*',
        },
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        prisma_service_1.PrismaService,
        pcs_service_1.PcsService,
        session_realtime_service_1.SessionRealtimeService])
], PcsGateway);
//# sourceMappingURL=pcs.gateway.js.map