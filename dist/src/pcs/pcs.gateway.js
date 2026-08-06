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
    }
    async handleSystemInfo(client, payload) {
        await this.pcsService.updateSystemInfo(payload.hostname, payload);
        this.server.emit("pc:system-info", payload);
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
    (0, websockets_1.SubscribeMessage)("pc:system-info"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], PcsGateway.prototype, "handleSystemInfo", null);
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