import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    // Always compare against *some* hash even on a miss, to avoid
    // leaking valid-username-vs-not via response timing.
    const passwordHash = user?.passwordHash ?? '$2b$10$invalidsaltinvalidsaltinvalidsa';
    const passwordOk = await bcrypt.compare(dto.password, passwordHash);

    if (!user || !passwordOk || !user.isActive) {
      await this.audit('LOGIN_FAILED', null, dto);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role !== dto.expectedRole) {
      await this.audit('LOGIN_FAILED_ROLE_MISMATCH', user.id, dto);
      throw new ForbiddenException(
        `This account is not a ${dto.expectedRole.toLowerCase()} account`,
      );
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
