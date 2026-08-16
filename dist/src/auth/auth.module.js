"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const config_1 = require("@nestjs/config");
const auth_controller_1 = require("./auth.controller");
const auth_service_1 = require("./auth.service");
const jwt_strategy_1 = require("./jwt.strategy");
const roles_guard_1 = require("./roles.guard");
const pcs_module_1 = require("../pcs/pcs.module");
const realtime_module_1 = require("../realtime/realtime.module");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            passport_1.PassportModule.register({
                defaultStrategy: 'jwt',
                session: false,
            }),
            jwt_1.JwtModule.registerAsync({
                imports: [
                    config_1.ConfigModule,
                ],
                inject: [
                    config_1.ConfigService,
                ],
                useFactory: (configService) => {
                    const secret = configService.get('JWT_SECRET');
                    if (!secret) {
                        throw new Error('JWT_SECRET is not configured in .env');
                    }
                    return {
                        secret,
                        signOptions: {
                            expiresIn: configService.get('JWT_EXPIRES_IN') || '8h',
                        },
                    };
                },
            }),
            pcs_module_1.PcsModule,
            realtime_module_1.RealtimeModule,
        ],
        controllers: [
            auth_controller_1.AuthController,
        ],
        providers: [
            auth_service_1.AuthService,
            jwt_strategy_1.JwtStrategy,
            roles_guard_1.RolesGuard,
        ],
        exports: [
            jwt_1.JwtModule,
            passport_1.PassportModule,
            jwt_strategy_1.JwtStrategy,
            roles_guard_1.RolesGuard,
        ],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map