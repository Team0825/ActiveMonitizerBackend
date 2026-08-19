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
exports.ChatbotController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const chatbot_service_1 = require("./chatbot.service");
const ask_chatbot_dto_1 = require("./dto/ask-chatbot.dto");
let ChatbotController = class ChatbotController {
    constructor(chatbotService) {
        this.chatbotService = chatbotService;
    }
    ask(req, dto) {
        const studentId = req.user?.sub || dto.sessionId || 'AGENT_STUDENT';
        return this.chatbotService.ask(studentId, dto);
    }
    guide(req, dto) {
        const studentId = req.user?.sub || dto.sessionId || 'AGENT_STUDENT';
        return this.chatbotService.getGuidance(studentId, dto.question, dto.instruction);
    }
};
exports.ChatbotController = ChatbotController;
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    (0, common_1.Post)('ask'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ask_chatbot_dto_1.AskChatbotDto]),
    __metadata("design:returntype", void 0)
], ChatbotController.prototype, "ask", null);
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    (0, common_1.Post)('guide'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatbotController.prototype, "guide", null);
exports.ChatbotController = ChatbotController = __decorate([
    (0, common_1.Controller)('chatbot'),
    __metadata("design:paramtypes", [chatbot_service_1.ChatbotService])
], ChatbotController);
//# sourceMappingURL=chatbot.controller.js.map