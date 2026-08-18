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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcrypt");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const rate_limiter_service_1 = require("../common/rate-limiter.service");
const pcs_service_1 = require("../pcs/pcs.service");
const session_realtime_service_1 = require("../realtime/session-realtime.service");
let AuthService = AuthService_1 = class AuthService {
    constructor(prisma, jwt, rateLimiter, pcsService, realtimeService) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.rateLimiter = rateLimiter;
        this.pcsService = pcsService;
        this.realtimeService = realtimeService;
        this.logger = new common_1.Logger(AuthService_1.name);
        this.activeStaffSessions = new Map();
        this.pendingChallenges = new Map();
    }
    async login(dto) {
        const cleanUsername = (dto.username || '').trim();
        const rateLimitKey = `auth-login:${cleanUsername.toLowerCase()}`;
        const limitStatus = this.rateLimiter.checkLimit(rateLimitKey);
        if (!limitStatus.allowed) {
            throw new common_1.HttpException('Too many attempts. Please try again later.', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const user = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { username: { equals: cleanUsername, mode: 'insensitive' } },
                    { id: cleanUsername },
                    { email: { equals: cleanUsername, mode: 'insensitive' } },
                ],
            },
        });
        const passwordHash = user?.passwordHash ?? '$2b$10$invalidsaltinvalidsaltinvalidsa';
        const passwordOk = await bcrypt.compare(dto.password, passwordHash);
        if (!user || !passwordOk || !user.isActive) {
            const attemptResult = this.rateLimiter.recordAttempt(rateLimitKey);
            await this.audit('LOGIN_FAILED', null, dto);
            try {
                const violationType = attemptResult.isNewlyBlocked
                    ? 'RATE_LIMIT_TRIGGERED'
                    : dto.expectedRole === 'ADMIN'
                        ? 'FAILED_ADMIN_LOGIN'
                        : 'FAILED_LOGIN';
                const severity = attemptResult.isNewlyBlocked ? 'HIGH' : 'MEDIUM';
                const violationDetails = attemptResult.isNewlyBlocked
                    ? `Rate limit triggered: Maximum 5 failed login attempts reached for ${cleanUsername}. Account blocked for 2 hours.`
                    : `Failed login attempt for ${cleanUsername} (${dto.expectedRole}) on ${dto.pcHostname || 'Management Portal'}. (Attempt ${attemptResult.attempts}/5)`;
                const violation = await this.pcsService.logViolation(dto.pcHostname || 'Management Portal', null, violationType, violationDetails, new Date().toISOString(), severity);
                const socketServer = this.realtimeService.getServer();
                if (socketServer) {
                    socketServer.emit('pc:violation', violation);
                }
            }
            catch (err) {
                this.logger.error('Failed to record login failure violation:', err);
            }
            if (!attemptResult.allowed) {
                throw new common_1.HttpException('Too many attempts. Please try again later.', common_1.HttpStatus.TOO_MANY_REQUESTS);
            }
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (user.role !== dto.expectedRole) {
            await this.audit('LOGIN_FAILED_ROLE_MISMATCH', user.id, dto);
            throw new common_1.ForbiddenException(`This account is not a ${dto.expectedRole.toLowerCase()} account`);
        }
        if ((user.role === 'ADMIN' || user.role === 'TEACHER') && !dto.forceLogin) {
            const existingSession = this.activeStaffSessions.get(user.id);
            const isSessionActive = existingSession &&
                Date.now() - existingSession.lastActive.getTime() < 4 * 60 * 60 * 1000;
            if (isSessionActive) {
                if (dto.challengeId) {
                    const challenge = this.pendingChallenges.get(dto.challengeId);
                    if (challenge) {
                        if (challenge.status === 'KEPT') {
                            throw new common_1.ForbiddenException('The active administrator elected to maintain their current session. Login request denied.');
                        }
                        if (challenge.status === 'ALLOWED' || challenge.expiresAt <= new Date()) {
                            this.pendingChallenges.delete(dto.challengeId);
                        }
                        else {
                            const remainingSec = Math.max(0, Math.round((challenge.expiresAt.getTime() - Date.now()) / 1000));
                            return {
                                duplicateDetected: true,
                                challengeId: challenge.id,
                                remainingSeconds: remainingSec,
                                expiresAt: challenge.expiresAt.toISOString(),
                                message: 'A session is currently active. A security verification alert has been sent to the active dashboard. You have 5 minutes.',
                            };
                        }
                    }
                }
                else {
                    const challengeId = (0, crypto_1.randomUUID)();
                    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
                    const challenge = {
                        id: challengeId,
                        userId: user.id,
                        username: user.username,
                        expectedRole: user.role,
                        pcHostname: dto.pcHostname,
                        requestedAt: new Date(),
                        expiresAt,
                        status: 'PENDING',
                    };
                    this.pendingChallenges.set(challengeId, challenge);
                    try {
                        const violation = await this.pcsService.logViolation(dto.pcHostname || 'Remote Device', null, 'DUPLICATE_ADMIN_LOGIN', `Security Alert: New login attempt detected for active account "${user.username}" (${user.role}) from ${dto.pcHostname || 'Remote Device'}. 5-minute session response window active.`, new Date().toISOString(), 'HIGH', { id: user.id, username: user.username, name: user.name });
                        const socketServer = this.realtimeService.getServer();
                        if (socketServer) {
                            socketServer.emit('pc:violation', violation);
                            socketServer.emit('auth:duplicate-login-alert', {
                                challengeId,
                                userId: user.id,
                                username: user.username,
                                role: user.role,
                                pcHostname: dto.pcHostname || 'Remote Workstation',
                                requestedAt: challenge.requestedAt.toISOString(),
                                expiresAt: expiresAt.toISOString(),
                            });
                        }
                    }
                    catch (err) {
                        this.logger.error('Failed to log duplicate admin login violation:', err);
                    }
                    return {
                        duplicateDetected: true,
                        challengeId,
                        remainingSeconds: 300,
                        expiresAt: expiresAt.toISOString(),
                        message: 'SECURITY ALERT: A session is already active for this administrative account. An authorization challenge has been dispatched to the active workstation (5 min window).',
                    };
                }
            }
        }
        this.rateLimiter.reset(rateLimitKey);
        await this.audit('LOGIN', user.id, dto);
        const payload = {
            sub: user.id,
            role: user.role,
            username: user.username,
        };
        const accessToken = await this.jwt.signAsync(payload);
        if (user.role === 'ADMIN' || user.role === 'TEACHER') {
            this.activeStaffSessions.set(user.id, {
                token: accessToken,
                userId: user.id,
                username: user.username,
                role: user.role,
                pcHostname: dto.pcHostname,
                lastActive: new Date(),
            });
        }
        return {
            accessToken,
            user: {
                id: user.id,
                role: user.role,
                username: user.username,
                name: user.name,
                regNumber: user.regNumber,
                classId: user.classId,
            },
        };
    }
    async keepSession(userId, challengeId) {
        if (challengeId) {
            const challenge = this.pendingChallenges.get(challengeId);
            if (challenge && challenge.userId === userId) {
                challenge.status = 'KEPT';
                const socketServer = this.realtimeService.getServer();
                if (socketServer) {
                    socketServer.emit('auth:challenge-resolved', {
                        challengeId,
                        status: 'KEPT',
                        message: 'The active user chose to keep their session.',
                    });
                }
            }
        }
        else {
            for (const [id, ch] of this.pendingChallenges.entries()) {
                if (ch.userId === userId && ch.status === 'PENDING') {
                    ch.status = 'KEPT';
                    const socketServer = this.realtimeService.getServer();
                    if (socketServer) {
                        socketServer.emit('auth:challenge-resolved', {
                            challengeId: id,
                            status: 'KEPT',
                            message: 'The active user chose to keep their session.',
                        });
                    }
                }
            }
        }
        const session = this.activeStaffSessions.get(userId);
        if (session) {
            session.lastActive = new Date();
        }
        return { success: true, message: 'Active session maintained. Concurrent login attempt denied.' };
    }
    async checkChallengeStatus(challengeId) {
        const challenge = this.pendingChallenges.get(challengeId);
        if (!challenge) {
            return { status: 'EXPIRED_OR_NOT_FOUND', allowed: false };
        }
        const now = new Date();
        if (challenge.status === 'KEPT') {
            return {
                status: 'KEPT',
                allowed: false,
                message: 'The active administrator elected to maintain their current session.',
            };
        }
        if (challenge.status === 'ALLOWED' || challenge.expiresAt <= now) {
            return {
                status: 'ALLOWED',
                allowed: true,
                message: 'Challenge response period expired without objection. New session authorized.',
            };
        }
        const remainingSeconds = Math.max(0, Math.round((challenge.expiresAt.getTime() - now.getTime()) / 1000));
        return {
            status: 'PENDING',
            allowed: false,
            remainingSeconds,
            expiresAt: challenge.expiresAt.toISOString(),
        };
    }
    async changePassword(userId, currentPass, newPass, confirmPass) {
        if (newPass !== confirmPass) {
            throw new common_1.UnauthorizedException('New password and confirm password do not match.');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('User not found.');
        }
        const valid = await bcrypt.compare(currentPass, user.passwordHash);
        if (!valid) {
            throw new common_1.UnauthorizedException('Current password is incorrect.');
        }
        const passwordHash = await bcrypt.hash(newPass, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash },
        });
        await this.prisma.auditLog.create({
            data: {
                actorId: userId,
                action: 'PASSWORD_CHANGED',
                metadata: JSON.stringify({ userId, role: user.role, timestamp: new Date().toISOString() }),
            },
        });
        return { success: true, message: 'Password updated successfully.' };
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
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        rate_limiter_service_1.RateLimiterService,
        pcs_service_1.PcsService,
        session_realtime_service_1.SessionRealtimeService])
], AuthService);
//# sourceMappingURL=auth.service.js.map