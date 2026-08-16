"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const throttler_1 = require("@nestjs/throttler");
const core_1 = require("@nestjs/core");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const sessions_module_1 = require("./sessions/sessions.module");
const pcs_module_1 = require("./pcs/pcs.module");
const admin_module_1 = require("./admin/admin.module");
const chatbot_module_1 = require("./chatbot/chatbot.module");
const teachers_module_1 = require("./teachers/teachers.module");
const notification_module_1 = require("./notifications/notification.module");
const realtime_module_1 = require("./realtime/realtime.module");
const cbt_module_1 = require("./cbt/cbt.module");
const agent_theme_module_1 = require("./agent-theme/agent-theme.module");
const common_module_1 = require("./common/common.module");
const app_controller_1 = require("./app.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        controllers: [app_controller_1.AppController],
        imports: [
            common_module_1.CommonModule,
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            schedule_1.ScheduleModule.forRoot(),
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: 60_000,
                    limit: 100,
                },
            ]),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            sessions_module_1.SessionsModule,
            pcs_module_1.PcsModule,
            admin_module_1.AdminModule,
            chatbot_module_1.ChatbotModule,
            teachers_module_1.TeachersModule,
            notification_module_1.NotificationsModule,
            cbt_module_1.CbtModule,
            agent_theme_module_1.AgentThemeModule,
            realtime_module_1.RealtimeModule,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map