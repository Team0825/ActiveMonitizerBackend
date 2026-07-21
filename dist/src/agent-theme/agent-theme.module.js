"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentThemeModule = void 0;
const common_1 = require("@nestjs/common");
const agent_theme_service_1 = require("./agent-theme.service");
const agent_theme_controller_1 = require("./agent-theme.controller");
const prisma_module_1 = require("../prisma/prisma.module");
let AgentThemeModule = class AgentThemeModule {
};
exports.AgentThemeModule = AgentThemeModule;
exports.AgentThemeModule = AgentThemeModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [agent_theme_controller_1.AgentThemeController],
        providers: [agent_theme_service_1.AgentThemeService],
    })
], AgentThemeModule);
//# sourceMappingURL=agent-theme.module.js.map