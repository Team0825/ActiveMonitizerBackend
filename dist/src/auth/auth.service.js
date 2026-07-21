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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcrypt");
const prisma_service_1 = require("../prisma/prisma.service");
let AuthService = class AuthService {
    constructor(prisma, jwt) {
        this.prisma = prisma;
        this.jwt = jwt;
    }
    async login(dto) {
        const user = await this.prisma.user.findUnique({
            where: { username: dto.username },
        });
        const passwordHash = user?.passwordHash ?? '$2b$10$invalidsaltinvalidsaltinvalidsa';
        const passwordOk = await bcrypt.compare(dto.password, passwordHash);
        if (!user || !passwordOk || !user.isActive) {
            await this.audit('LOGIN_FAILED', null, dto);
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (user.role !== dto.expectedRole) {
            await this.audit('LOGIN_FAILED_ROLE_MISMATCH', user.id, dto);
            throw new common_1.ForbiddenException(`This account is not a ${dto.expectedRole.toLowerCase()} account`);
        }
        await this.audit('LOGIN', user.id, dto);
        const payload = {
            sub: user.id,
            role: user.role,
            username: user.username,
        };
        return {
            accessToken: await this.jwt.signAsync(payload),
            user: {
                id: user.id,
                role: user.role,
                username: user.username,
                regNumber: user.regNumber,
                classId: user.classId,
            },
        };
    }
    async audit(action, actorId, dto) {
        await this.prisma.auditLog.create({
            data: {
                actorId: actorId ?? 'UNKNOWN',
                action,
                targetPc: dto.pcHostname ?? null,
                metadata: JSON.stringify({ username: dto.username, expectedRole: dto.expectedRole }),
            },
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map