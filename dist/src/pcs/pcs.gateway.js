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
            const payload = await this.jwt
                .verifyAsync(token);
            client.data.user =
                payload;
        }
        catch {
            this.logger.warn(`Rejected socket ${client.id}: invalid token`);
            client.disconnect(true);
        }
    }
    async handleDisconnect(client) {
        const hostname = client.data?.hostname;
        if (!hostname) {
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
        if (client.data.user
            ?.role !==
            'STUDENT') {
            client.emit('error', {
                message: 'Only student clients can register a PC',
            });
            return;
        }
        const hostname = payload.hostname
            .trim();
        client.data.hostname =
            hostname;
        await this.pcsService
            .markOnline(hostname, payload.labName, payload.sessionId, client.data.user.sub);
        await client.join(`pc:${hostname}`);
        if (!payload.sessionId) {
            client.emit('pc:registered', {
                ok: true,
                hostname,
                status: 'ONLINE',
                sessionActive: false,
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
            studentId: client.data.user
                .sub,
            sessionId: session.id,
            sessionCode: session.sessionCode,
        });
        let allowedSites = [];
        let blockedSites = [];
        try {
            allowedSites =
                JSON.parse(session.allowedSites ||
                    '[]');
        }
        catch {
            allowedSites = [];
        }
        try {
            blockedSites =
                JSON.parse(session.blockedSites ||
                    '[]');
        }
        catch {
            blockedSites = [];
        }
        client.emit('pc:registered', {
            ok: true,
            hostname,
            status: 'ONLINE',
            sessionActive: true,
            sessionId: session.id,
            sessionCode: session.sessionCode,
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
            allowedSites,
            blockedSites,
            sessionMode: session.sessionMode,
            allowOffline: session.allowOffline,
            restrictExistingFiles: session
                .restrictExistingFiles,
            restrictUnauthorizedApps: session
                .restrictUnauthorizedApps,
            freezeOnEnd: session.freezeOnEnd,
            warningMinutes: session.warningMinutes,
            instructions: session.instructions,
            questionMode: session.questionMode,
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
                message: 'Only teachers/admins can subscribe to a session',
            });
            return;
        }
        if (!payload
            ?.sessionId ||
            typeof payload
                .sessionId !==
                'string' ||
            !payload
                .sessionId
                .trim()) {
            client.emit('error', {
                message: 'sessionId is required',
            });
            return;
        }
        const requestedSession = payload.sessionId
            .trim();
        const session = await this.prisma
            .classSession
            .findFirst({
            where: {
                OR: [
                    {
                        id: requestedSession,
                    },
                    {
                        sessionCode: requestedSession
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
        if (user.role ===
            'TEACHER' &&
            session.teacherId !==
                user.sub) {
            client.emit('error', {
                message: 'Not authorized for this session',
            });
            return;
        }
        const internalSessionId = session.id;
        const roomName = `session:${internalSessionId}`;
        await client.join(roomName);
        const pcs = await this.pcsService
            .listPcsForSession(internalSessionId);
        client.emit('pc:list', pcs);
        client.emit('teacher:subscribed', {
            success: true,
            sessionId: internalSessionId,
            sessionCode: session.sessionCode,
            room: roomName,
            pcCount: pcs.length,
        });
        this.logger.debug(`${user.role} ${user.sub} subscribed to ${roomName}`);
    }
    async onTeacherCommand(client, payload) {
        try {
            (0, pcs_dto_1.assertTeacherCommandPayload)(payload);
        }
        catch (error) {
            client.emit('error', {
                message: error
                    instanceof Error
                    ? error.message
                    : 'Invalid command',
            });
            return;
        }
        const user = client.data.user;
        if (!user ||
            (user.role !==
                'TEACHER' &&
                user.role !==
                    'ADMIN')) {
            client.emit('error', {
                message: 'Only teachers/admins can send commands',
            });
            return;
        }
        const requestedSession = payload.sessionId
            .trim();
        const session = await this.prisma
            .classSession
            .findFirst({
            where: {
                OR: [
                    {
                        id: requestedSession,
                    },
                    {
                        sessionCode: requestedSession
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
        const internalSessionId = session.id;
        if (user.role ===
            'TEACHER' &&
            session.teacherId !==
                user.sub) {
            client.emit('error', {
                message: 'Not authorized for this session',
            });
            return;
        }
        const commandId = (0, crypto_1.randomUUID)();
        const issuedAt = Date.now();
        const targetHostname = payload
            .targetHostname ||
            'ALL';
        this.pendingCommands
            .set(commandId, {
            commandId,
            sessionId: internalSessionId,
            issuedBy: user.sub,
            issuedAt,
            targetHostname,
        });
        const targetRoom = targetHostname !==
            'ALL'
            ? `pc:${targetHostname}`
            : `session:${internalSessionId}`;
        this.server
            .to(targetRoom)
            .emit('command:execute', {
            commandId,
            sessionId: internalSessionId,
            sessionCode: session.sessionCode,
            action: payload.action,
            message: payload.message,
            issuedBy: user.sub,
            issuedAt: new Date(issuedAt).toISOString(),
        });
        client.emit('command:sent', {
            commandId,
            targetHostname,
            action: payload.action,
            issuedAt: new Date(issuedAt).toISOString(),
        });
        if (targetHostname !==
            'ALL') {
            if (payload.action ===
                'LOCK') {
                await this.pcsService
                    .setStatus(targetHostname, 'LOCKED');
            }
            if (payload.action ===
                'FREEZE') {
                await this.pcsService
                    .setStatus(targetHostname, 'FROZEN');
            }
            if (payload.action ===
                'SHUTDOWN') {
                await this.pcsService
                    .setStatus(targetHostname, 'OFFLINE');
            }
            if (payload.action ===
                'UNLOCK' ||
                payload.action ===
                    'UNFREEZE') {
                await this.pcsService
                    .setStatus(targetHostname, 'ONLINE');
            }
        }
        await this.pcsService
            .logCommand(user.sub, payload.action, targetHostname, {
            commandId,
            sessionId: internalSessionId,
            sessionCode: session.sessionCode,
            message: payload.message,
        });
    }
    async onCommandAck(client, payload) {
        if (client.data.user
            ?.role !==
            'STUDENT') {
            client.emit('error', {
                message: 'Only PC clients can acknowledge commands',
            });
            return;
        }
        try {
            (0, pcs_dto_1.assertPcCommandAckPayload)(payload);
        }
        catch (error) {
            client.emit('error', {
                message: error
                    instanceof Error
                    ? error.message
                    : 'Invalid command acknowledgement',
            });
            return;
        }
        if (client.data
            .hostname &&
            client.data
                .hostname !==
                payload.hostname) {
            client.emit('error', {
                message: 'PC hostname does not match registered client',
            });
            return;
        }
        const pending = this.pendingCommands
            .get(payload.commandId);
        if (!pending) {
            return;
        }
        const latencyMs = Date.now() -
            pending.issuedAt;
        this.server
            .to(`session:${pending.sessionId}`)
            .emit('command:result', {
            ...payload,
            latencyMs,
        });
        if (pending
            .targetHostname !==
            'ALL') {
            this.pendingCommands
                .delete(payload.commandId);
        }
        else {
            setTimeout(() => {
                this.pendingCommands
                    .delete(payload.commandId);
            }, 10_000);
        }
        this.logger.debug(`Command ${payload.commandId} acknowledged by ${payload.hostname} in ${latencyMs}ms`);
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