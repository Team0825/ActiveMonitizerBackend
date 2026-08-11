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
exports.AgentThemeController = void 0;
const common_1 = require("@nestjs/common");
const roles_guard_1 = require("../auth/roles.guard");
const agent_theme_service_1 = require("./agent-theme.service");
let AgentThemeController = class AgentThemeController {
    constructor(agentThemeService) {
        this.agentThemeService = agentThemeService;
    }
    getActiveTheme() {
        return this.agentThemeService.getActiveTheme();
    }
    updateActiveTheme(updateData) {
        return this.agentThemeService.updateActiveTheme(updateData);
    }
};
exports.AgentThemeController = AgentThemeController;
__decorate([
    (0, common_1.Get)('active'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AgentThemeController.prototype, "getActiveTheme", null);
__decorate([
    (0, common_1.Patch)('active'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)('ADMIN'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AgentThemeController.prototype, "updateActiveTheme", null);
exports.AgentThemeController = AgentThemeController = __decorate([
    (0, common_1.Controller)('agent-theme'),
    __metadata("design:paramtypes", [agent_theme_service_1.AgentThemeService])
], AgentThemeController);
//# sourceMappingURL=agent-theme.controller.js.map