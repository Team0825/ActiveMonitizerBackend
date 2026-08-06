"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var SessionRealtimeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionRealtimeService = void 0;
const common_1 = require("@nestjs/common");
let SessionRealtimeService = SessionRealtimeService_1 = class SessionRealtimeService {
    constructor() {
        this.logger = new common_1.Logger(SessionRealtimeService_1.name);
    }
    setServer(server) {
        this.server = server;
        this.logger.log('Realtime Socket.IO server registered.');
    }
    getServer() {
        return this.server;
    }
    emitSessionEnded(sessionId, payload) {
        if (!this.server) {
            this.logger.warn(`Unable to emit session:ended for ${sessionId}.`);
            return;
        }
        const room = `session:${sessionId}`;
        this.server
            .to(room)
            .emit('session:ended', payload);
        this.logger.log(`session:ended -> ${room}`);
    }
    emitPolicyUpdated(sessionId, policy) {
        if (!this.server) {
            this.logger.warn(`Unable to emit policy:update for ${sessionId}.`);
            return;
        }
        const room = `session:${sessionId}`;
        this.server
            .to(room)
            .emit('policy:update', policy);
        this.logger.log(`policy:update -> ${room}`);
    }
    emitPolicyAcknowledged(sessionId, hostname, payload) {
        if (!this.server) {
            return;
        }
        this.server
            .to(`session:${sessionId}`)
            .emit('policy:ack', {
            hostname,
            ...(payload ??
                {}),
        });
    }
    emitScreenshotReady(sessionId, payload) {
        if (!this.server) {
            return;
        }
        this.server
            .to(`session:${sessionId}`)
            .emit('screenshot:ready', payload);
    }
    emitRemoteCommand(hostname, payload) {
        if (!this.server) {
            return;
        }
        this.server
            .to(`pc:${hostname}`)
            .emit('remote:command', payload);
    }
    emitAnnouncement(sessionId, payload) {
        if (!this.server) {
            return;
        }
        this.server
            .to(`session:${sessionId}`)
            .emit('announcement', payload);
    }
    emitToSession(sessionId, eventName, payload) {
        if (!this.server) {
            return;
        }
        this.server
            .to(`session:${sessionId}`)
            .emit(eventName, payload);
    }
    emitToPc(hostname, eventName, payload) {
        if (!this.server) {
            this.logger.warn(`Unable to emit ${eventName} to ${hostname}.`);
            return;
        }
        const room = `pc:${hostname.trim()}`;
        this.server
            .to(room)
            .emit(eventName, payload);
        this.logger.log(`${eventName} -> ${room}`);
    }
};
exports.SessionRealtimeService = SessionRealtimeService;
exports.SessionRealtimeService = SessionRealtimeService = SessionRealtimeService_1 = __decorate([
    (0, common_1.Injectable)()
], SessionRealtimeService);
//# sourceMappingURL=session-realtime.service.js.map