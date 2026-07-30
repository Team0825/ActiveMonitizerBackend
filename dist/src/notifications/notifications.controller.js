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
exports.NotificationsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const roles_guard_1 = require("../auth/roles.guard");
const messages_dto_1 = require("./dto/messages.dto");
const notifications_service_1 = require("./notifications.service");
let NotificationsController = class NotificationsController {
    constructor(notificationsService) {
        this.notificationsService = notificationsService;
    }
    getRecipients(req) {
        return this.notificationsService.getRecipients(req.user);
    }
    getClasses() {
        return this.notificationsService.getClasses();
    }
    getInbox(req, filter) {
        return this.notificationsService.getInbox(req.user, filter);
    }
    getSent(req) {
        return this.notificationsService.getSent(req.user);
    }
    createMessage(req, dto) {
        return this.notificationsService.createMessage(req.user, dto);
    }
    reply(req, id, dto) {
        return this.notificationsService.reply(req.user, id, dto);
    }
    uploadAttachment(req, id, file) {
        if (!file) {
            throw new common_1.BadRequestException('Attachment file is required');
        }
        return this.notificationsService
            .uploadAttachment(req.user, id, file);
    }
    getAttachmentDownloadUrl(req, messageId, attachmentId) {
        return this.notificationsService
            .getAttachmentDownloadUrl(req.user, messageId, attachmentId);
    }
    getMessage(req, id) {
        return this.notificationsService.getMessage(req.user, id);
    }
};
exports.NotificationsController = NotificationsController;
__decorate([
    (0, roles_guard_1.Roles)('ADMIN', 'TEACHER'),
    (0, common_1.Get)('recipients'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "getRecipients", null);
__decorate([
    (0, roles_guard_1.Roles)('ADMIN', 'TEACHER'),
    (0, common_1.Get)('classes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "getClasses", null);
__decorate([
    (0, roles_guard_1.Roles)('ADMIN', 'TEACHER'),
    (0, common_1.Get)('inbox'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, messages_dto_1.MessageFilterDto]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "getInbox", null);
__decorate([
    (0, roles_guard_1.Roles)('ADMIN', 'TEACHER'),
    (0, common_1.Get)('sent'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "getSent", null);
__decorate([
    (0, roles_guard_1.Roles)('ADMIN', 'TEACHER'),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, messages_dto_1.CreateMessageDto]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "createMessage", null);
__decorate([
    (0, common_1.Post)(':id/reply'),
    (0, roles_guard_1.Roles)('ADMIN', 'TEACHER', 'STUDENT'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, messages_dto_1.ReplyMessageDto]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "reply", null);
__decorate([
    (0, common_1.Post)(':id/attachments'),
    (0, roles_guard_1.Roles)('ADMIN', 'TEACHER'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        limits: {
            fileSize: 10 * 1024 * 1024,
        },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "uploadAttachment", null);
__decorate([
    (0, common_1.Get)(':messageId/attachments/:attachmentId/download'),
    (0, roles_guard_1.Roles)('ADMIN', 'TEACHER', 'STUDENT'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('messageId')),
    __param(2, (0, common_1.Param)('attachmentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "getAttachmentDownloadUrl", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_guard_1.Roles)('ADMIN', 'TEACHER', 'STUDENT'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "getMessage", null);
exports.NotificationsController = NotificationsController = __decorate([
    (0, common_1.Controller)('notifications'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [notifications_service_1.NotificationsService])
], NotificationsController);
//# sourceMappingURL=notifications.controller.js.map