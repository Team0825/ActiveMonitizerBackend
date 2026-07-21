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
