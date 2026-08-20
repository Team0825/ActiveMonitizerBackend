import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RateLimiterService } from '../common/rate-limiter.service';
import { PcsService } from '../pcs/pcs.service';
import { SessionRealtimeService } from '../realtime/session-realtime.service';

interface StaffSession {
  token: string;
  userId: string;
  username: string;
  role: string;
  pcHostname?: string;
  lastActive: Date;
}

interface LoginChallenge {
  id: string;
  userId: string;
  username: string;
  expectedRole: string;
  pcHostname?: string;
  requestedAt: Date;
  expiresAt: Date;
  status: 'PENDING' | 'KEPT' | 'ALLOWED';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly activeStaffSessions = new Map<string, StaffSession>();
  private readonly pendingChallenges = new Map<string, LoginChallenge>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly rateLimiter: RateLimiterService,
    private readonly pcsService: PcsService,
    private readonly realtimeService: SessionRealtimeService,
  ) {}

  async login(dto: LoginDto) {
    const cleanUsername = (dto.username || '').trim();
    this.logger.log(`LOGIN_REQUEST: username=${cleanUsername}, expectedRole=${dto.expectedRole}`);
    const rateLimitKey = `auth-login:${cleanUsername.toLowerCase()}`;

    // 1. Check Rate Limit: 5 attempts per 2 hours
    const limitStatus = this.rateLimiter.checkLimit(rateLimitKey);
    if (!limitStatus.allowed) {
      throw new HttpException(
        'Too many attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
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

    // Always compare against *some* hash even on a miss, to avoid
    // leaking valid-username-vs-not via response timing.
    const passwordHash = user?.passwordHash ?? '$2b$10$invalidsaltinvalidsaltinvalidsa';
    const passwordOk = await bcrypt.compare(dto.password, passwordHash);

    if (!user || !passwordOk || !user.isActive) {
      // Record failed attempt
      const attemptResult = this.rateLimiter.recordAttempt(rateLimitKey);

      await this.audit('LOGIN_FAILED', null, dto);

      // Create Security Violation
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

        const violation = await this.pcsService.logViolation(
          dto.pcHostname || 'Management Portal',
          null,
          violationType,
          violationDetails,
          new Date().toISOString(),
          severity,
        );

        const socketServer = this.realtimeService.getServer();
        if (socketServer) {
          socketServer.emit('pc:violation', violation);
        }
      } catch (err) {
        this.logger.error('Failed to record login failure violation:', err);
      }

      if (!attemptResult.allowed) {
        throw new HttpException(
          'Too many attempts. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    if (dto.expectedRole) {
      const normalizedExpected = dto.expectedRole.toUpperCase();
      const userRole = (user.role || '').toUpperCase();
      const isMatch =
        userRole === normalizedExpected ||
        (normalizedExpected === 'ADMIN' && (userRole === 'SUPER_ADMIN' || user.isSuperAdmin)) ||
        (normalizedExpected === 'TEACHER' && (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'));

      if (!isMatch) {
        await this.audit('LOGIN_FAILED_ROLE_MISMATCH', user.id, dto);
        throw new ForbiddenException(
          `This account does not have ${dto.expectedRole.toLowerCase()} privileges.`,
        );
      }
    } else {
      const isStaffOrAuthority =
        user.role === 'ADMIN' ||
        user.role === 'TEACHER' ||
        (user as any).role === 'SUPER_ADMIN' ||
        user.isSuperAdmin;

      if (!isStaffOrAuthority) {
        await this.audit('LOGIN_FAILED_ROLE_MISMATCH', user.id, dto);
        throw new ForbiddenException(
          'Your account is authenticated but does not have administrator or teacher access.',
        );
      }
    }

    // Duplicate Admin/Teacher Login Protection
    // Only applies to browser management sessions when no workstation hostname is provided and forceLogin is false
    if ((user.role === 'ADMIN' || user.role === 'TEACHER') && !dto.forceLogin && !dto.pcHostname) {
      const existingSession = this.activeStaffSessions.get(user.id);
      const isSessionActive =
        existingSession &&
        Date.now() - existingSession.lastActive.getTime() < 4 * 60 * 60 * 1000;

      if (isSessionActive) {
        if (dto.challengeId) {
          const challenge = this.pendingChallenges.get(dto.challengeId);
          if (challenge) {
            if (challenge.status === 'KEPT') {
              throw new ForbiddenException(
                'The active administrator elected to maintain their current session. Login request denied.',
              );
            }
            if (challenge.status === 'ALLOWED' || challenge.expiresAt <= new Date()) {
              // Allowed or 5 minutes expired -> proceed with superseding login
              this.pendingChallenges.delete(dto.challengeId);
            } else {
              const remainingSec = Math.max(
                0,
                Math.round((challenge.expiresAt.getTime() - Date.now()) / 1000),
              );
              return {
                duplicateDetected: true,
                challengeId: challenge.id,
                remainingSeconds: remainingSec,
                expiresAt: challenge.expiresAt.toISOString(),
                message:
                  'A session is currently active. A security verification alert has been sent to the active dashboard. You have 5 minutes.',
              };
            }
          }
        } else {
          // New duplicate login attempt -> initiate 5-minute challenge
          const challengeId = randomUUID();
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
          const challenge: LoginChallenge = {
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

          // Create HIGH PRIORITY security violation safely
          try {
            const violation = await this.pcsService.logViolation(
              dto.pcHostname || 'Remote Device',
              null,
              'DUPLICATE_ADMIN_LOGIN',
              `Security Alert: New login attempt detected for active account "${user.username}" (${user.role}) from ${dto.pcHostname || 'Remote Device'}. 5-minute session response window active.`,
              new Date().toISOString(),
              'HIGH',
              { id: user.id, username: user.username, name: user.name },
            );

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
          } catch (err) {
            this.logger.error('Failed to log duplicate admin login violation:', err);
          }

          return {
            duplicateDetected: true,
            challengeId,
            remainingSeconds: 300,
            expiresAt: expiresAt.toISOString(),
            message:
              'SECURITY ALERT: A session is already active for this administrative account. An authorization challenge has been dispatched to the active workstation (5 min window).',
          };
        }
      }
    }

    // Reset rate limit on successful authentication
    this.rateLimiter.reset(rateLimitKey);

    this.logger.log(`LOGIN_USER_FOUND: Authenticated userId=${user.id}, role=${user.role}, isSuperAdmin=${user.isSuperAdmin}`);
    this.logger.log(`PASSWORD_VALIDATED: Validation successful for user ${user.username}`);

    await this.audit('LOGIN', user.id, dto);

    // Update lastLoginAt in database safely
    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to update lastLoginAt: ${err?.message}`);
    }

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

    // Record or update active session
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
        createdAt: user.createdAt ? user.createdAt.toISOString() : new Date().toISOString(),
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : new Date().toISOString(),
      },
    };
  }

  async logout(userId: string) {
    this.activeStaffSessions.delete(userId);
    this.logger.log(`LOGOUT: Cleared active session for userId=${userId}`);
    return { success: true, message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        institution: true,
        department: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    // Fetch active license for this user's institution
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

  async updateProfile(userId: string, data: { name?: string; email?: string; mobile?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found.');

    if (data.email && data.email.trim() !== user.email) {
      const emailExists = await this.prisma.user.findFirst({
        where: { email: data.email.trim(), id: { not: userId } },
      });
      if (emailExists) throw new ForbiddenException('Email is already registered by another account.');
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

  async keepSession(userId: string, challengeId?: string) {
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
    } else {
      // Keep all challenges for this user
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

  async checkChallengeStatus(challengeId: string) {
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

    const remainingSeconds = Math.max(
      0,
      Math.round((challenge.expiresAt.getTime() - now.getTime()) / 1000),
    );

    return {
      status: 'PENDING',
      allowed: false,
      remainingSeconds,
      expiresAt: challenge.expiresAt.toISOString(),
    };
  }

  async changePassword(userId: string, currentPass: string, newPass: string, confirmPass: string) {
    if (newPass !== confirmPass) {
      throw new UnauthorizedException('New password and confirm password do not match.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const valid = await bcrypt.compare(currentPass, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect.');
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

  private async audit(action: string, actorId: string | null, dto: LoginDto) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actorId ?? 'UNKNOWN',
          action,
          targetPc: dto.pcHostname ?? null,
          metadata: JSON.stringify({ username: dto.username, expectedRole: dto.expectedRole }),
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to record audit log (${action}): ${err?.message}`);
    }
  }
}
