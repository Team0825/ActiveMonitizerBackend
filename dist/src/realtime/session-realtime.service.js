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
        this.server =
            server;
        this.logger.log('Realtime Socket.IO server registered.');
    }
    emitSessionEnded(sessionId, payload) {
        if (!this.server) {
            this.logger.warn(`Unable to emit session:ended for ${sessionId}: Socket.IO server is not ready.`);
            return;
        }
        const room = `session:${sessionId}`;
        this.server
            .to(room)
            .emit('session:ended', payload);
        this.logger.log(`session:ended emitted to ${room}. Reason: ${payload.reason}`);
    }
    emitToPc(hostname, eventName, payload) {
        if (!this.server) {
            this.logger.warn(`Unable to emit ${eventName} to PC ${hostname}: Socket.IO server is not ready.`);
            return;
        }
        const normalizedHostname = hostname.trim();
        if (!normalizedHostname) {
            this.logger.warn(`Unable to emit ${eventName}: PC hostname is empty.`);
            return;
        }
        const room = `pc:${normalizedHostname}`;
        this.server
            .to(room)
            .emit(eventName, payload);
        this.logger.log(`${eventName} emitted to ${room}.`);
    }
};
exports.SessionRealtimeService = SessionRealtimeService;
exports.SessionRealtimeService = SessionRealtimeService = SessionRealtimeService_1 = __decorate([
    (0, common_1.Injectable)()
], SessionRealtimeService);
//# sourceMappingURL=session-realtime.service.js.map