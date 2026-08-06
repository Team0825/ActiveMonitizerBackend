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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionsController = exports.StudentSessionController = void 0;
const common_1 = require("@nestjs/common");
const roles_guard_1 = require("../auth/roles.guard");
const sessions_service_1 = require("./sessions.service");
const session_dto_1 = require("./dto/session.dto");
const session_policy_dto_1 = require("./dto/session-policy.dto");
let StudentSessionController = class StudentSessionController {
    constructor(sessionsService) {
        this.sessionsService = sessionsService;
    }
    studentLogin(dto) {
        return this.sessionsService
            .studentLogin(dto);
    }
};
exports.StudentSessionController = StudentSessionController;
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [session_dto_1.JoinSessionDto]),
    __metadata("design:returntype", void 0)
], StudentSessionController.prototype, "studentLogin", null);
exports.StudentSessionController = StudentSessionController = __decorate([
    (0, common_1.Controller)('sessions/student'),
    __metadata("design:paramtypes", [sessions_service_1.SessionsService])
], StudentSessionController);
let SessionsController = class SessionsController {
    constructor(sessionsService) {
        this.sessionsService = sessionsService;
    }
    getSessions(req) {
        return this.sessionsService
            .getSessions(req.user.sub, req.user.role);
    }
    create(req, dto) {
        return this.sessionsService
            .createSession(req.user.sub, dto);
    }
    join(req, dto) {
        return this.sessionsService
            .joinSession(req.user.sub, dto);
    }
    requestAccess(req, dto) {
        return this.sessionsService
            .requestSpecialAccess(req.user.sub, dto);
    }
    handleAccess(req, dto) {
        return this.sessionsService
            .handleAccessRequest(req.user.sub, req.user.role, dto);
    }
    participants(id) {
        return this.sessionsService
            .getOnlineParticipants(id);
    }
    end(req, id) {
        return this.sessionsService
            .endSession(req.user.sub, req.user.role, id);
    }
    getSessionPolicy(id) {
        return this.sessionsService.getSessionPolicy(id);
    }
    updateSessionPolicy(id, dto) {
        return this.sessionsService.updateSessionPolicy(id, dto);
    }
};
exports.SessionsController = SessionsController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_guard_1.Roles)('TEACHER', 'ADMIN'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SessionsController.prototype, "getSessions", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_guard_1.Roles)('TEACHER', 'ADMIN'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, session_dto_1.CreateSessionDto]),
    __metadata("design:returntype", void 0)
], SessionsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('join'),
    (0, roles_guard_1.Roles)('STUDENT'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, session_dto_1.JoinSessionDto]),
    __metadata("design:returntype", void 0)
], SessionsController.prototype, "join", null);
__decorate([
    (0, common_1.Post)('request-access'),
    (0, roles_guard_1.Roles)('STUDENT'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, session_dto_1.RequestSpecialAccessDto]),
    __metadata("design:returntype", void 0)
], SessionsController.prototype, "requestAccess", null);
__decorate([
    (0, common_1.Post)('handle-access-request'),
    (0, roles_guard_1.Roles)('TEACHER', 'ADMIN'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, session_dto_1.HandleAccessRequestDto]),
    __metadata("design:returntype", void 0)
], SessionsController.prototype, "handleAccess", null);
__decorate([
    (0, common_1.Get)(':id/participants'),
    (0, roles_guard_1.Roles)('TEACHER', 'ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SessionsController.prototype, "participants", null);
__decorate([
    (0, common_1.Post)(':id/end'),
    (0, roles_guard_1.Roles)('TEACHER', 'ADMIN'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SessionsController.prototype, "end", null);
__decorate([
    (0, common_1.Get)(':id/policy'),
    (0, roles_guard_1.Roles)('TEACHER', 'ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SessionsController.prototype, "getSessionPolicy", null);
__decorate([
    (0, common_1.Put)(':id/policy'),
    (0, roles_guard_1.Roles)('TEACHER', 'ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, session_policy_dto_1.UpdateSessionPolicyDto]),
    __metadata("design:returntype", void 0)
], SessionsController.prototype, "updateSessionPolicy", null);
exports.SessionsController = SessionsController = __decorate([
    (0, common_1.Controller)('sessions'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [sessions_service_1.SessionsService])
], SessionsController);
//# sourceMappingURL=sessions.controller.js.map