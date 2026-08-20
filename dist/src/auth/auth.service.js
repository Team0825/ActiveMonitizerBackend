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
        this.logger.log(`LOGIN_REQUEST: username=${cleanUsername}, expectedRole=${dto.expectedRole}`);
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
        if (dto.expectedRole) {
            if (user.role !== dto.expectedRole) {
                await this.audit('LOGIN_FAILED_ROLE_MISMATCH', user.id, dto);
                throw new common_1.ForbiddenException(`This account is not a ${dto.expectedRole.toLowerCase()} account`);
            }
        }
        else {
            const isStaffOrAuthority = user.role === 'ADMIN' ||
                user.role === 'TEACHER' ||
                user.role === 'SUPER_ADMIN';
            if (!isStaffOrAuthority) {
                await this.audit('LOGIN_FAILED_ROLE_MISMATCH', user.id, dto);
                throw new common_1.ForbiddenException('Your account is authenticated but does not have administrator or teacher access.');
            }
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
        this.logger.log(`LOGIN_USER_FOUND: Authenticated userId=${user.id}, role=${user.role}, isSuperAdmin=${user.isSuperAdmin}`);
        this.logger.log(`PASSWORD_VALIDATED: Validation successful for user ${user.username}`);
        await this.audit('LOGIN', user.id, dto);
        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        const userWithDetails = await this.prisma.user.findUnique({
            where: { id: user.id },
            include: {
                institution: true,
                department: true,
            },
        });
        const payload = {
            sub: user.id,
            role: user.role,
            username: user.username,
            isSuperAdmin: userWithDetails?.isSuperAdmin || false,
            institutionId: userWithDetails?.institutionId || null,
        };
        const accessToken = await this.jwt.signAsync(payload);
        this.logger.log(`TOKEN_GENERATED: Issued auth token for userId=${user.id}`);
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
        const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
        this.logger.log(`LOGIN_RESPONSE_SENT: Successfully returned token for ${user.username}`);
        return {
            success: true,
            accessToken,
            token: accessToken,
            access_token: accessToken,
            expiresAt,
            user: {
                id: user.id,
                role: user.role,
                isSuperAdmin: userWithDetails?.isSuperAdmin || false,
                username: user.username,
                name: user.name,
                email: user.email,
                mobile: user.mobile,
                regNumber: user.regNumber,
                classId: user.classId,
                institutionId: userWithDetails?.institutionId || null,
                institutionName: userWithDetails?.institution?.name || null,
                institution: userWithDetails?.institution ? {
                    id: userWithDetails.institution.id,
                    name: userWithDetails.institution.name,
                    code: userWithDetails.institution.code,
                    board: userWithDetails.institution.board,
                    location: userWithDetails.institution.location,
                } : null,
                departmentId: userWithDetails?.departmentId || null,
                department: userWithDetails?.department ? {
                    id: userWithDetails.department.id,
                    name: userWithDetails.department.name,
                    code: userWithDetails.department.code,
                } : null,
                createdAt: user.createdAt.toISOString(),
                lastLoginAt: new Date().toISOString(),
            },
        };
    }
    async logout(userId) {
        this.activeStaffSessions.delete(userId);
        this.logger.log(`LOGOUT: Cleared active session for userId=${userId}`);
        return { success: true, message: 'Logged out successfully' };
    }
    async getProfile(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                institution: true,
                department: true,
            },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('User not found.');
        }
        let license = null;
        if (user.institutionId) {
            license = await this.prisma.license.findFirst({
                where: { institutionId: user.institutionId, status: 'ACTIVE' },
            });
        }
        return {
            id: user.id,
            name: user.name || 'Not provided',
            username: user.username,
            email: user.email || 'Not provided',
            mobile: user.mobile || 'Not provided',
            role: user.role,
            isSuperAdmin: user.isSuperAdmin,
            institution: user.institution ? {
                id: user.institution.id,
                name: user.institution.name,
                code: user.institution.code,
                board: user.institution.board,
                location: user.institution.location,
            } : { name: 'National Institute of Science & Technology' },
            department: user.department ? {
                id: user.department.id,
                name: user.department.name,
                code: user.department.code,
            } : null,
            licenseNumber: license?.licenseNumber || 'AMPRO-2026-8841-9920',
            activationStatus: license?.isActivated ? 'ACTIVATED' : 'NOT ACTIVATED',
            createdAt: user.createdAt.toISOString(),
            lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : user.createdAt.toISOString(),
        };
    }
    async updateProfile(userId, data) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.UnauthorizedException('User not found.');
        if (data.email && data.email.trim() !== user.email) {
            const emailExists = await this.prisma.user.findFirst({
                where: { email: data.email.trim(), id: { not: userId } },
            });
            if (emailExists)
                throw new common_1.ForbiddenException('Email is already registered by another account.');
        }
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                name: data.name !== undefined ? data.name.trim() : undefined,
                email: data.email !== undefined ? data.email.trim() : undefined,
                mobile: data.mobile !== undefined ? data.mobile.trim() : undefined,
            },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                mobile: true,
                role: true,
                isSuperAdmin: true,
                updatedAt: true,
            },
        });
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