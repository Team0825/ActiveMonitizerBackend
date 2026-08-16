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
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RateLimiterService } from '../common/rate-limiter.service';
import { PcsService } from '../pcs/pcs.service';
import { SessionRealtimeService } from '../realtime/session-realtime.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly rateLimiter: RateLimiterService,
    private readonly pcsService: PcsService,
    private readonly realtimeService: SessionRealtimeService,
  ) {}

  async login(dto: LoginDto) {
    const cleanUsername = (dto.username || '').trim();
    const rateLimitKey = `auth-login:${cleanUsername.toLowerCase()}`;

    // 1. Check Rate Limit: 5 attempts per 2 hours
    const limitStatus = this.rateLimiter.checkLimit(rateLimitKey);
    if (!limitStatus.allowed) {
      throw new HttpException(
        'Too many attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { username: cleanUsername },
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

    if (user.role !== dto.expectedRole) {
      await this.audit('LOGIN_FAILED_ROLE_MISMATCH', user.id, dto);
      throw new ForbiddenException(
        `This account is not a ${dto.expectedRole.toLowerCase()} account`,
      );
    }

    // Reset rate limit on successful authentication
    this.rateLimiter.reset(rateLimitKey);

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
    await this.prisma.auditLog.create({
      data: {
        actorId: actorId ?? 'UNKNOWN',
        action,
        targetPc: dto.pcHostname ?? null,
        metadata: JSON.stringify({ username: dto.username, expectedRole: dto.expectedRole }),
      },
    });
  }
}
