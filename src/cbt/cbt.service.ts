import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SessionRealtimeService } from '../realtime/session-realtime.service';
import { RateLimiterService } from '../common/rate-limiter.service';
import { PcsService } from '../pcs/pcs.service';
import {
  AuthorityLoginDto,
  AllocateStudentDto,
  AutoAllocateStudentDto,
  CorrectResultDto,
  CreateExamDto,
  CreateQuestionDto,
  CreateQuestionPaperDto,
  DeallocateStudentDto,
  EmergencyTerminationToggleDto,
  GenerateResultsDto,
  RegisterPcDto,
  SaveAnswerDto,
  StartExamDto,
  StudentSaveAnswerDto,
  StudentSubmitExamDto,
  SubmitExamDto,
  TerminatePcDto,
  UpdateExamDto,
  UpdateQuestionPaperDto,
  ValidateUniqueCodeDto,
  VerifyDobDto,
} from './dto/cbt.dto';

@Injectable()
export class CbtService {
  private readonly logger = new Logger(CbtService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: SessionRealtimeService,
    private readonly rateLimiter: RateLimiterService,
    private readonly pcsService: PcsService,
  ) {}

  /*
   * ==========================================================
   * 0. CBT CODE GENERATOR & LOOKUP
   * ==========================================================
   */

  private generateCbtCodeString(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'CBT-';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async generateUniqueCbtCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = this.generateCbtCodeString();
      const existingExam = await this.prisma.exam.findFirst({
        where: { cbtCode: code },
        select: { id: true },
      });
      const existingSession = await this.prisma.classSession.findFirst({
        where: { cbtCode: code },
        select: { id: true },
      });

      if (!existingExam && !existingSession) {
        return code;
      }
    }
    throw new BadRequestException('Failed to generate a unique CBT code. Please try again.');
  }

  private deterministicShuffle<T>(items: T[], seedStr: string): T[] {
    if (!items || items.length <= 1) return items ? [...items] : [];
    const copy = [...items];
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) {
      seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
    const random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  async generateOneTimeCbtCode(adminId: string): Promise<{ cbtCode: string; code: string; expiresAt: Date }> {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const genChunk = (len: number) => {
      let chunk = '';
      for (let i = 0; i < len; i++) {
        chunk += chars[Math.floor(Math.random() * chars.length)];
      }
      return chunk;
    };
    const code = `${genChunk(4)}-${genChunk(4)}-${genChunk(4)}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minute expiry

    await this.prisma.cbtRegistrationCode.create({
      data: {
        code,
        createdById: adminId,
        expiresAt,
      },
    });

    return { cbtCode: code, code, expiresAt };
  }

  /*
   * ==========================================================
   * 1. AGENT CBT AUTHORITY LOGIN (2-STEP FLOW)
   * ==========================================================
   */

  async authorityLogin(dto: AuthorityLoginDto) {
    const username = (dto.username || '').trim();
    const pcHostname = (dto.pcHostname || 'Workstation').trim().toUpperCase();
    const rateLimitKey = `authority-login:${username.toLowerCase()}`;

    // 1. Check Rate Limit (5 attempts per 2 hours)
    const limitStatus = this.rateLimiter.checkLimit(rateLimitKey);
    if (!limitStatus.allowed) {
      throw new HttpException(
        'Too many attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Find user by exact match, case-insensitive match, or ID
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { username: username },
          { email: username },
          { id: username },
        ],
      },
    });

    // Case-insensitive fallback if exact match not found
    let user = users.find(
      (u) =>
        u.username.toLowerCase() === username.toLowerCase() ||
        (u.email && u.email.toLowerCase() === username.toLowerCase()) ||
        u.id === username,
    );

    if (!user) {
      const allUsers = await this.prisma.user.findMany({
        where: {
          role: { in: ['ADMIN', 'SUPER_ADMIN', 'TEACHER'] },
        },
      });
      user = allUsers.find(
        (u) =>
          u.username.toLowerCase() === username.toLowerCase() ||
          (u.email && u.email.toLowerCase() === username.toLowerCase()) ||
          u.id === username,
      );
    }

    const passwordHash = user?.passwordHash ?? '$2b$10$invalidsaltinvalidsaltinvalidsa';
    const passwordOk = await bcrypt.compare(dto.password, passwordHash);

    const isAuthority =
      user &&
      (user.role === 'ADMIN' || (user as any).role === 'SUPER_ADMIN' || user.role === 'TEACHER');

    if (!user || !passwordOk) {
      const attemptResult = this.rateLimiter.recordAttempt(rateLimitKey);

      // Log Security Violation
      try {
        const violationType = attemptResult.isNewlyBlocked
          ? 'RATE_LIMIT_TRIGGERED'
          : 'FAILED_AUTHORITY_LOGIN';

        const severity = attemptResult.isNewlyBlocked ? 'CRITICAL' : 'HIGH';
        const details = attemptResult.isNewlyBlocked
          ? `Rate limit triggered: 5 failed Authority login attempts for ${username} on ${pcHostname}. Lockout active for 2 hours.`
          : `Failed Authority CBT login attempt for username "${username}" on ${pcHostname}. (Attempt ${attemptResult.attempts}/5)`;

        const violation = await this.pcsService.logViolation(
          pcHostname,
          null,
          violationType,
          details,
          new Date().toISOString(),
          severity,
          user ? { id: user.id, name: user.name, username: user.username } : null,
        );

        const socketServer = this.realtimeService.getServer();
        if (socketServer) {
          socketServer.emit('pc:violation', violation);
        }
      } catch (err) {
        this.logger.error('Failed to log authority login violation:', err);
      }

      if (!attemptResult.allowed) {
        throw new HttpException(
          'Too many attempts. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new UnauthorizedException('Invalid administrative username or password.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This administrative account is deactivated. Contact system administrator.');
    }

    if (!isAuthority) {
      throw new UnauthorizedException('Insufficient permissions. Administrator or Teacher credentials required.');
    }

    // Reset rate limiter on success
    this.rateLimiter.reset(rateLimitKey);

    const authorityToken = randomUUID();

    return {
      success: true,
      verified: true,
      authorityToken,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    };
  }

  /*
   * ==========================================================
   * 2. UNIQUE CBT REGISTRATION CODE VALIDATION
   * ==========================================================
   */

  async validateUniqueCodeAndRegister(dto: ValidateUniqueCodeDto) {
    const code = (dto.code || '').trim().toUpperCase();
    const pcHostname = (dto.pcHostname || 'Workstation').trim().toUpperCase();

    if (!code) {
      throw new BadRequestException('Unique CBT Registration Code is required.');
    }

    // 1. Check CbtRegistrationCode table (one-time codes generated by admin)
    const regCode = await this.prisma.cbtRegistrationCode.findUnique({
      where: { code },
    });

    const now = new Date();
    let isOneTimeValid = false;

    if (regCode && !regCode.isUsed && regCode.expiresAt > now) {
      isOneTimeValid = true;
      // Mark code as used
      await this.prisma.cbtRegistrationCode.update({
        where: { id: regCode.id },
        data: {
          isUsed: true,
          usedByPc: pcHostname,
          usedAt: now,
        },
      });
    }

    // 2. Also check active Exam or ClassSession cbtCode
    const exam = await this.prisma.exam.findFirst({
      where: { cbtCode: code },
      include: { session: { select: { id: true, sessionCode: true, classTitle: true, status: true } } },
    });

    const session = exam?.session || (await this.prisma.classSession.findFirst({
      where: { cbtCode: code },
      select: { id: true, sessionCode: true, classTitle: true, status: true },
    }));

    if (!isOneTimeValid && !exam && !session) {
      // Record violation for invalid code attempt
      try {
        const violation = await this.pcsService.logViolation(
          pcHostname,
          code,
          'INVALID_CBT_CODE',
          `Invalid or expired Unique CBT Registration Code "${code}" entered on ${pcHostname}.`,
          now.toISOString(),
          'MEDIUM',
        );
        const socketServer = this.realtimeService.getServer();
        if (socketServer) {
          socketServer.emit('pc:violation', violation);
        }
      } catch (err) {
        this.logger.error('Failed to log invalid CBT code violation:', err);
      }

      throw new BadRequestException('Invalid or expired Unique CBT Registration Code.');
    }

    // 3. Ensure PC record exists in Pc table
    const existingPc = await this.prisma.pc.findUnique({
      where: { hostname: pcHostname },
    });

    if (!existingPc) {
      await this.prisma.pc.create({
        data: {
          hostname: pcHostname,
          displayName: pcHostname,
          status: 'ONLINE',
          healthStatus: 'HEALTHY',
          internetStatus: 'ONLINE',
          cbtStatus: 'REGISTERED',
          lastSeen: now,
          currentSessionId: session?.id || exam?.sessionId || null,
        },
      });
    } else {
      await this.prisma.pc.update({
        where: { hostname: pcHostname },
        data: {
          status: 'ONLINE',
          healthStatus: 'HEALTHY',
          internetStatus: 'ONLINE',
          cbtStatus: 'REGISTERED',
          lastSeen: now,
          currentSessionId: session?.id || exam?.sessionId || existingPc.currentSessionId,
        },
      });
    }

    // 4. Upsert PC registration in CbtPcRegistration
    const registration = await this.prisma.cbtPcRegistration.upsert({
      where: {
        cbtCode_pcHostname: {
          cbtCode: code,
          pcHostname,
        },
      },
      create: {
        cbtCode: code,
        pcHostname,
        pcId: existingPc?.id || null,
        examId: exam?.id || null,
        sessionId: session?.id || null,
        status: 'REGISTERED',
      },
      update: {
        examId: exam?.id || null,
        sessionId: session?.id || null,
        status: 'REGISTERED',
        updatedAt: now,
      },
    });

    this.logger.log(`[CBT_REGISTER] PC=${pcHostname} REGISTRATION_ID=${registration.id} SESSION_CODE=${code} STATUS=${registration.status}`);

    // 5. Broadcast real-time Socket.IO event to Admin & Teacher dashboards
    const socketServer = this.realtimeService.getServer();
    if (socketServer) {
      socketServer.emit('cbt:pc-registered', {
        cbtCode: code,
        examId: exam?.id,
        sessionId: session?.id,
        pcHostname,
        status: 'REGISTERED',
        registeredAt: registration.registeredAt,
      });

      socketServer.emit('cbt:pc-list-updated', {
        cbtCode: code,
        examId: exam?.id,
        pcHostname,
      });
    }

    return {
      success: true,
      message: `PC ${pcHostname} successfully registered for CBT examination.`,
      cbtCode: code,
      pcHostname,
      status: 'REGISTERED',
      exam: exam
        ? {
            id: exam.id,
            title: exam.title,
            subject: exam.subject,
            durationMinutes: exam.durationMinutes,
            status: exam.status,
          }
        : null,
      session: session
        ? {
            id: session.id,
            sessionCode: session.sessionCode,
            classTitle: session.classTitle,
          }
        : null,
    };
  }

  async checkCbtPcStatus(pcHostname: string) {
    const upperHost = pcHostname.trim().toUpperCase();
    const registration = await this.prisma.cbtPcRegistration.findFirst({
      where: { pcHostname: upperHost, status: 'REGISTERED' },
      orderBy: { registeredAt: 'desc' },
    });

    return {
      isCbtRegistered: Boolean(registration),
      cbtCode: registration?.cbtCode || null,
      registration: registration || null,
    };
  }

  async verifyAdminCredentials(adminId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'TEACHER')) {
      throw new ForbiddenException('Unauthorized. Admin/Teacher credentials required.');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      const authorityCheck = await this.verifyAuthorityPassword(password);
      if (!authorityCheck.valid) {
        throw new ForbiddenException('Invalid administrative credentials.');
      }
    }

    return { success: true, verified: true };
  }


  /*
   * ==========================================================
   * 1. AUTHORITY PASSWORD MANAGEMENT
   * ==========================================================
   */

  async getAuthorityPasswordStatus() {
    const setting = await this.prisma.authoritySetting.findUnique({
      where: { key: 'AUTHORITY_PASSWORD' },
    });
    return {
      isConfigured: Boolean(setting),
      updatedAt: setting?.updatedAt || null,
    };
  }

  async setAuthorityPassword(password: string, adminId?: string) {
    if (!password || password.length < 4) {
      throw new BadRequestException('Authority password must be at least 4 characters long.');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    return this.prisma.authoritySetting.upsert({
      where: { key: 'AUTHORITY_PASSWORD' },
      create: {
        key: 'AUTHORITY_PASSWORD',
        passwordHash,
        updatedById: adminId || null,
      },
      update: {
        passwordHash,
        updatedById: adminId || null,
      },
    });
  }

  private readonly failedAuthorityAttempts = new Map<
    string,
    { count: number; lastAttempt: number; blockedUntil: number }
  >();

  async verifyAuthorityPassword(password: string, pcHostname?: string): Promise<{ valid: boolean }> {
    if (!password) return { valid: false };

    const setting = await this.prisma.authoritySetting.findUnique({
      where: { key: 'AUTHORITY_PASSWORD' },
    });

    if (!setting) {
      // Default fallback authority password if not yet configured
      const isDefault = password === 'admin123' || password === 'Authority@123';
      return { valid: isDefault };
    }

    const isValid = await bcrypt.compare(password, setting.passwordHash);
    return { valid: isValid };
  }

  async recordRecoveryAudit(dto: { pcHostname: string; sessionId?: string; examId?: string; reason?: string }) {
    return this.prisma.auditLog.create({
      data: {
        actorId: 'ADMIN_EMERGENCY_RECOVERY',
        action: 'ADMIN_EMERGENCY_RECOVERY',
        targetPc: dto.pcHostname,
        metadata: JSON.stringify({
          sessionId: dto.sessionId || null,
          examId: dto.examId || null,
          reason: dto.reason || 'Win+Alt+C Emergency Recovery executed',
          occurredAt: new Date().toISOString(),
        }),
      },
    });
  }

  /*
   * ==========================================================
   * 2. PC REGISTRATION & REAL-TIME STATUS FOR CBT
   * ==========================================================
   */

  async registerPcForCbt(dto: RegisterPcDto) {
    const cbtCode = dto.cbtCode.trim().toUpperCase();
    const pcHostname = dto.pcHostname.trim().toUpperCase();
    const nowMs = Date.now();

    // Check rate-limit block for this PC
    const rateLimit = this.failedAuthorityAttempts.get(pcHostname);
    if (rateLimit && rateLimit.blockedUntil > nowMs) {
      const waitSeconds = Math.ceil((rateLimit.blockedUntil - nowMs) / 1000);
      throw new ForbiddenException(
        `Too many failed authority password attempts. PC "${pcHostname}" is locked out. Try again in ${waitSeconds} seconds.`,
      );
    }

    // Verify authority password
    const auth = await this.verifyAuthorityPassword(dto.authorityPassword || '', pcHostname);
    if (!auth.valid) {
      const currentAttempts = (rateLimit?.count || 0) + 1;
      const isLockout = currentAttempts >= 3;
      const blockedUntil = isLockout ? nowMs + 10 * 60 * 1000 : 0; // 10 min block

      this.failedAuthorityAttempts.set(pcHostname, {
        count: currentAttempts,
        lastAttempt: nowMs,
        blockedUntil,
      });

      const severity = isLockout ? 'CRITICAL' : currentAttempts >= 2 ? 'HIGH' : 'MEDIUM';
      const violationDetail = `Unauthorized CBT PC registration attempt on ${pcHostname} with invalid authority password (Attempt ${currentAttempts}/3).${
        isLockout ? ' PC temporarily locked out for 10 minutes.' : ''
      }`;

      // Create security violation
      try {
        const violationRecord = {
          id: `v-auth-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          hostname: pcHostname,
          sessionId: dto.cbtCode,
          type: 'UNAUTHORIZED_AUTHORITY_ACCESS',
          details: violationDetail,
          severity,
          status: 'UNRESOLVED',
          attempts: currentAttempts,
          occurredAt: new Date().toISOString(),
        };

        const socketServer = this.realtimeService.getServer();
        if (socketServer) {
          socketServer.emit('pc:violation', violationRecord);
        }

        await this.prisma.auditLog.create({
          data: {
            actorId: 'UNAUTHORIZED_AGENT',
            action: 'AUTHORITY_PASSWORD_FAILED',
            targetPc: pcHostname,
            metadata: JSON.stringify({
              cbtCode,
              attempts: currentAttempts,
              severity,
              blockedUntil: blockedUntil ? new Date(blockedUntil).toISOString() : null,
            }),
          },
        });
      } catch (err) {
        // preserve error throwing
      }

      throw new ForbiddenException(
        `Invalid Authority Password. CBT PC registration rejected.${
          isLockout ? ' Maximum attempts exceeded — PC locked out for 10 minutes.' : ''
        }`,
      );
    }

    // Password is valid -> clear failed attempts
    this.failedAuthorityAttempts.delete(pcHostname);

    // Find Exam or Session matching CBT Code
    const exam = await this.prisma.exam.findFirst({
      where: { cbtCode },
      include: {
        session: { select: { id: true, sessionCode: true, classTitle: true, status: true } },
      },
    });

    const session =
      exam?.session ||
      (await this.prisma.classSession.findFirst({
        where: { cbtCode },
        select: { id: true, sessionCode: true, classTitle: true, status: true },
      }));

    if (!exam && !session) {
      throw new NotFoundException(`Invalid or unknown CBT Code: ${cbtCode}`);
    }

    const nowDate = new Date();

    // Ensure PC record exists in Pc table
    const existingPc = await this.prisma.pc.findUnique({
      where: { hostname: pcHostname },
    });

    if (!existingPc) {
      await this.prisma.pc.create({
        data: {
          hostname: pcHostname,
          displayName: pcHostname,
          status: 'ONLINE',
          healthStatus: 'HEALTHY',
          internetStatus: 'ONLINE',
          cbtStatus: 'REGISTERED',
          lastSeen: nowDate,
          currentSessionId: session?.id || exam?.sessionId || null,
        },
      });
    } else {
      await this.prisma.pc.update({
        where: { hostname: pcHostname },
        data: {
          status: 'ONLINE',
          healthStatus: 'HEALTHY',
          internetStatus: 'ONLINE',
          cbtStatus: 'REGISTERED',
          lastSeen: nowDate,
          currentSessionId: session?.id || exam?.sessionId || existingPc.currentSessionId,
        },
      });
    }

    // Upsert PC registration in CbtPcRegistration
    const registration = await this.prisma.cbtPcRegistration.upsert({
      where: {
        cbtCode_pcHostname: {
          cbtCode,
          pcHostname,
        },
      },
      create: {
        cbtCode,
        pcHostname,
        pcId: existingPc?.id || dto.pcId || null,
        examId: exam?.id || null,
        sessionId: session?.id || null,
        status: 'REGISTERED',
      },
      update: {
        examId: exam?.id || null,
        sessionId: session?.id || null,
        status: 'REGISTERED',
        updatedAt: nowDate,
      },
    });

    this.logger.log(`[CBT_REGISTER] PC=${pcHostname} REGISTRATION_ID=${registration.id} SESSION_CODE=${cbtCode} STATUS=${registration.status}`);

    // Broadcast real-time Socket.IO event to Admin & Teacher dashboards
    const socketServer = this.realtimeService.getServer();
    if (socketServer) {
      socketServer.emit('cbt:pc-registered', {
        cbtCode,
        examId: exam?.id,
        sessionId: session?.id,
        pcHostname,
        status: 'REGISTERED',
        registeredAt: registration.registeredAt,
      });

      socketServer.emit('cbt:pc-list-updated', {
        cbtCode,
        examId: exam?.id,
        pcHostname,
      });
    }

    return {
      success: true,
      message: `PC ${pcHostname} successfully registered for CBT examination.`,
      cbtCode,
      exam: exam
        ? {
            id: exam.id,
            title: exam.title,
            subject: exam.subject,
            durationMinutes: exam.durationMinutes,
            status: exam.status,
          }
        : null,
      session: session
        ? {
            id: session.id,
            sessionCode: session.sessionCode,
            classTitle: session.classTitle,
          }
        : null,
      pcHostname,
      status: 'REGISTERED',
    };
  }

  async listRegisteredPcs(cbtCodeOrExamId?: string) {
    const isAll = !cbtCodeOrExamId || cbtCodeOrExamId === 'ALL' || cbtCodeOrExamId === 'undefined' || cbtCodeOrExamId === 'null' || cbtCodeOrExamId.trim() === '';
    
    let exam = null;
    if (!isAll) {
      exam = await this.prisma.exam.findFirst({
        where: {
          OR: [{ id: cbtCodeOrExamId }, { cbtCode: cbtCodeOrExamId.toUpperCase() }],
        },
      });
    }

    const cbtCode = exam?.cbtCode || (!isAll ? cbtCodeOrExamId?.toUpperCase() : undefined);

    let whereClause: any = {};
    if (!isAll && (cbtCode || exam?.id)) {
      whereClause = {
        OR: [
          ...(cbtCode ? [{ cbtCode }] : []),
          ...(exam?.id ? [{ examId: exam.id }] : []),
          { examId: null }, // Include unassigned registered lab PCs so admin can allocate them
        ],
      };
    }

    const registrations = await this.prisma.cbtPcRegistration.findMany({
      where: whereClause,
      include: {
        exam: { select: { id: true, title: true, subject: true, durationMinutes: true } },
      },
      orderBy: { registeredAt: 'desc' },
    });

    // Join with live PC status from Pc model
    const hostnames = registrations.map((r) => r.pcHostname);
    const pcs = await this.prisma.pc.findMany({
      where: { hostname: { in: hostnames } },
      select: {
        id: true,
        hostname: true,
        displayName: true,
        labName: true,
        status: true,
        healthStatus: true,
        internetStatus: true,
        currentSessionId: true,
        assignedStudentId: true,
        assignedInvigilatorId: true,
        cbtStatus: true,
        lastSeen: true,
      },
    });

    const pcMap = new Map(pcs.map((p) => [p.hostname.toUpperCase(), p]));

    // Fetch assigned students for detailed display
    const studentIds = registrations
      .map((r) => r.assignedStudentId)
      .filter((id): id is string => !!id);

    const students = await this.prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true,
        name: true,
        username: true,
        regNumber: true,
        rollNumber: true,
        semester: true,
        departmentName: true,
        department: { select: { name: true } },
      },
    });

    const studentMap = new Map(students.map((s) => [s.id, s]));

    const now = Date.now();

    const result = registrations.map((reg, index) => {
      const pcInfo = pcMap.get(reg.pcHostname.toUpperCase());
      const lastSeenMs = pcInfo?.lastSeen
        ? new Date(pcInfo.lastSeen).getTime()
        : (reg.registeredAt ? new Date(reg.registeredAt).getTime() : 0);
      const isRecent = (now - lastSeenMs < 120 * 1000) || (now - new Date(reg.registeredAt).getTime() < 120 * 1000);
      const isLiveConnected = (pcInfo?.status === 'ONLINE' || reg.status === 'REGISTERED' || reg.status === 'ALLOCATED' || reg.status === 'UNLOCKED') && (isRecent || pcInfo?.status === 'ONLINE');
      const student = reg.assignedStudentId ? studentMap.get(reg.assignedStudentId) : null;

      let cbtStatus = reg.status;
      if (!isLiveConnected && reg.status !== 'TERMINATED') {
        cbtStatus = 'OFFLINE';
      } else if (reg.isDobVerified) {
        cbtStatus = 'EXAM RUNNING';
      } else if (reg.assignedStudentId) {
        cbtStatus = 'EXAM READY';
      } else if (reg.status === 'REGISTERED') {
        cbtStatus = 'REGISTERED';
      }

      return {
        serialNumber: index + 1,
        id: reg.id,
        cbtCode: reg.cbtCode,
        pcHostname: reg.pcHostname,
        displayName: pcInfo?.displayName || reg.pcHostname,
        labName: pcInfo?.labName || 'Main Lab',
        regStatus: reg.status,
        status: isLiveConnected ? 'CONNECTED' : 'OFFLINE',
        connectionStatus: isLiveConnected ? 'CONNECTED' : 'OFFLINE',
        isOnline: isLiveConnected,
        healthStatus: pcInfo?.healthStatus || (isLiveConnected ? 'HEALTHY' : 'OFFLINE'),
        internetStatus: pcInfo?.internetStatus || (isLiveConnected ? 'ONLINE' : 'OFFLINE'),
        lastSeen: pcInfo?.lastSeen || reg.registeredAt || null,
        registeredAt: reg.registeredAt,
        cbtStatus,
        isDobVerified: reg.isDobVerified,
        pc: {
          id: pcInfo?.id || reg.id,
          hostname: reg.pcHostname,
          displayName: pcInfo?.displayName || reg.pcHostname,
          labName: pcInfo?.labName || 'Main Lab',
          isOnline: isLiveConnected,
          status: isLiveConnected ? 'ONLINE' : 'OFFLINE',
          healthStatus: pcInfo?.healthStatus || 'HEALTHY',
          internetStatus: pcInfo?.internetStatus || 'ONLINE',
          lastSeen: pcInfo?.lastSeen || reg.registeredAt,
        },
        assignedStudent: student
          ? {
              id: student.id,
              name: student.name || student.username,
              regNumber: student.regNumber || student.rollNumber || student.username,
              semester: student.semester || 'Semester 1',
              department: student.department?.name || student.departmentName || 'General',
            }
          : reg.assignedStudentName
          ? {
              id: reg.assignedStudentId,
              name: reg.assignedStudentName,
              regNumber: reg.assignedStudentRegNo,
              semester: 'Semester 1',
              department: 'General',
            }
          : null,
        assignedInvigilator: reg.assignedInvigilatorName
          ? {
              id: reg.assignedInvigilatorId,
              name: reg.assignedInvigilatorName,
            }
          : null,
        exam: reg.exam
          ? {
              id: reg.exam.id,
              title: reg.exam.title,
              subject: reg.exam.subject,
            }
          : null,
      };
    });

    const onlineCount = result.filter((p) => p.isOnline).length;
    const offlineCount = result.length - onlineCount;

    this.logger.log(`[CBT_REGISTRY_FETCH] target=${cbtCodeOrExamId || 'ALL'} COUNT=${result.length} ONLINE=${onlineCount}`);

    return {
      cbtCode: cbtCode || '',
      examId: exam?.id || null,
      isPcConfigLocked: exam?.isPcConfigLocked || false,
      totalRegistered: result.length,
      onlineCount,
      offlineCount,
      pcs: result,
    };
  }

  /*
   * ==========================================================
   * 2.1 STUDENT TO PC ALLOCATION & INVIGILATOR ASSIGNMENT
   * ==========================================================
   */

  async allocateStudent(adminId: string, dto: AllocateStudentDto) {
    let pcHostname = (dto.pcHostname || '').trim().toUpperCase();
    const studentId = (dto.studentId || '').trim();
    const targetExamId = (dto.examId || dto.examinationId || '').trim() || undefined;

    // If pcHostname not provided, attempt lookup by pcId
    if (!pcHostname && dto.pcId) {
      const pcById = await this.prisma.pc.findUnique({
        where: { id: dto.pcId.trim() },
      });
      if (pcById) {
        pcHostname = pcById.hostname.trim().toUpperCase();
      }
    }

    if (!pcHostname || !studentId) {
      throw new BadRequestException('Both PC Workstation and Candidate Student are required for allocation.');
    }

    // 1. Find Student Record
    const student = await this.prisma.user.findFirst({
      where: {
        id: studentId,
        role: 'STUDENT',
      },
      include: { department: true },
    });

    if (!student) {
      throw new NotFoundException(`Student record not found for ID: ${studentId}`);
    }

    // 2. Validate Examination & Question Paper if provided
    let exam = null;
    if (targetExamId) {
      exam = await this.prisma.exam.findUnique({
        where: { id: targetExamId },
        include: { questionPaper: true, session: true },
      });
      if (!exam) {
        throw new NotFoundException(`Examination not found for ID: ${targetExamId}`);
      }
    }

    let questionPaper = exam?.questionPaper || null;
    if (dto.questionPaperId && (!questionPaper || questionPaper.id !== dto.questionPaperId)) {
      const qp = await this.prisma.questionPaper.findUnique({
        where: { id: dto.questionPaperId.trim() },
      });
      if (qp) {
        questionPaper = qp;
      }
    }

    // 3. Prevent duplicate examination attempts for this candidate
    if (targetExamId) {
      const priorAttempt = await this.prisma.examAttempt.findFirst({
        where: {
          examId: targetExamId,
          studentId: student.id,
          status: { in: ['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'] },
        },
      });

      if (priorAttempt) {
        throw new ConflictException(
          `Candidate "${student.name || student.username}" has already submitted this examination. Re-taking is not permitted for completed exams.`,
        );
      }
    }

    // 4. Prevent candidate from being actively assigned to another PC
    const existingAssignment = await this.prisma.cbtPcRegistration.findFirst({
      where: {
        assignedStudentId: student.id,
        pcHostname: { not: pcHostname },
        status: { in: ['ALLOCATED', 'EXAM_READY', 'EXAM_RUNNING', 'UNLOCKED'] },
      },
    });

    if (existingAssignment) {
      throw new ConflictException(
        `Candidate "${student.name || student.username}" (${student.regNumber || student.username}) is already assigned to workstation ${existingAssignment.pcHostname}. Please deallocate that workstation first.`,
      );
    }

    // 5. Find Invigilator (if provided)
    let invigilator = null;
    if (dto.invigilatorId) {
      invigilator = await this.prisma.user.findFirst({
        where: {
          id: dto.invigilatorId,
          role: { in: ['TEACHER', 'ADMIN', 'SUPER_ADMIN'] },
        },
      });
    }

    // 6. Find or Create CbtPcRegistration for this Workstation
    let reg = null;
    if (dto.pcRegistrationId) {
      reg = await this.prisma.cbtPcRegistration.findUnique({
        where: { id: dto.pcRegistrationId },
      });
    }
    if (!reg) {
      reg = await this.prisma.cbtPcRegistration.findFirst({
        where: {
          pcHostname,
          ...(dto.cbtCode ? { cbtCode: dto.cbtCode } : exam?.cbtCode ? { cbtCode: exam.cbtCode } : {}),
        },
        orderBy: { registeredAt: 'desc' },
      });
    }
    if (!reg) {
      reg = await this.prisma.cbtPcRegistration.findFirst({
        where: { pcHostname },
        orderBy: { registeredAt: 'desc' },
      });
    }

    const now = new Date();
    const invigilatorName = invigilator?.name || invigilator?.username || dto.invigilatorName || null;
    const effectiveCbtCode = dto.cbtCode || exam?.cbtCode || reg?.cbtCode || 'CBT-GEN';

    if (reg) {
      reg = await this.prisma.cbtPcRegistration.update({
        where: { id: reg.id },
        data: {
          assignedStudentId: student.id,
          assignedStudentName: student.name || student.username,
          assignedStudentRegNo: student.regNumber || student.rollNumber || student.username,
          assignedInvigilatorId: invigilator?.id || null,
          assignedInvigilatorName: invigilatorName,
          examId: targetExamId || reg.examId,
          sessionId: dto.sessionId || exam?.sessionId || reg.sessionId,
          cbtCode: effectiveCbtCode,
          isDobVerified: false,
          status: 'ALLOCATED',
          updatedAt: now,
        },
      });
    } else {
      // Auto-register PC for CBT if not yet in registration table
      reg = await this.prisma.cbtPcRegistration.create({
        data: {
          pcHostname,
          cbtCode: effectiveCbtCode,
          assignedStudentId: student.id,
          assignedStudentName: student.name || student.username,
          assignedStudentRegNo: student.regNumber || student.rollNumber || student.username,
          assignedInvigilatorId: invigilator?.id || null,
          assignedInvigilatorName: invigilatorName,
          examId: targetExamId || null,
          sessionId: dto.sessionId || exam?.sessionId || null,
          isDobVerified: false,
          status: 'ALLOCATED',
        },
      });
    }

    // 7. Update PC record
    await this.prisma.pc.updateMany({
      where: { hostname: pcHostname },
      data: {
        assignedStudentId: student.id,
        assignedInvigilatorId: invigilator?.id || null,
        currentStudentId: student.id,
        cbtStatus: 'ALLOCATED',
        lastSeen: now,
      },
    });

    // 8. Emit Socket.IO event to Agent, CBT Web Portal & Admin Dashboards
    const socketServer = this.realtimeService.getServer();
    if (socketServer) {
      socketServer.emit('cbt:student-allocated', {
        pcHostname,
        pcRegistrationId: reg?.id,
        cbtCode: reg?.cbtCode,
        studentId: student.id,
        studentName: student.name || student.username,
        regNumber: student.regNumber || student.rollNumber || student.username,
        semester: student.semester || 'Semester 1',
        department: student.department?.name || student.departmentName || 'General',
        questionPaperTitle: questionPaper?.title || exam?.title || 'General CBT Assessment',
        invigilatorName: invigilatorName || 'Assigned Invigilator',
        cbtStatus: 'ALLOCATED',
        allocatedAt: now.toISOString(),
      });

      socketServer.emit('cbt:pc-list-updated', {
        pcHostname,
        cbtCode: reg?.cbtCode,
      });
    }

    this.logger.log(
      `[CBT] Student allocated: Candidate ${student.username} (${student.name}) -> PC ${pcHostname}`,
    );

    return {
      success: true,
      message: `Candidate ${student.name || student.username} successfully allocated to PC ${pcHostname}.`,
      allocation: {
        pcHostname,
        pcRegistrationId: reg?.id,
        cbtCode: reg?.cbtCode,
        studentId: student.id,
        studentName: student.name || student.username,
        regNumber: student.regNumber || student.rollNumber || student.username,
        semester: student.semester || 'Semester 1',
        department: student.department?.name || student.departmentName || 'General',
        questionPaperTitle: questionPaper?.title || exam?.title || 'General CBT Assessment',
        examTitle: exam?.title || 'CBT Examination',
        invigilatorId: invigilator?.id || null,
        invigilatorName: invigilatorName,
        cbtStatus: 'ALLOCATED',
        status: 'ASSIGNED',
        isDobVerified: false,
      },
    };
  }

  async autoAllocateStudent(adminId: string, dto: AutoAllocateStudentDto) {
    const studentId = (dto.studentId || '').trim();
    if (!studentId) {
      throw new BadRequestException('studentId is required for automatic allocation.');
    }

    const student = await this.prisma.user.findFirst({
      where: { id: studentId, role: 'STUDENT' },
      include: { department: true },
    });

    if (!student) {
      throw new NotFoundException(`Student record not found for ID: ${studentId}`);
    }

    // Prevent duplicate examination attempts for this candidate
    if (dto.examId) {
      const priorAttempt = await this.prisma.examAttempt.findFirst({
        where: {
          examId: dto.examId,
          studentId: student.id,
          status: { in: ['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'] },
        },
      });

      if (priorAttempt) {
        throw new ConflictException(
          'Examination already attempted. You cannot take this examination again during this scheduled session.',
        );
      }
    }

    // Check if student already assigned to an active workstation
    const existing = await this.prisma.cbtPcRegistration.findFirst({
      where: {
        assignedStudentId: student.id,
        status: { in: ['ALLOCATED', 'EXAM_READY', 'EXAM_RUNNING', 'UNLOCKED'] },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Candidate "${student.name || student.username}" (${student.regNumber || student.username}) is already assigned to workstation ${existing.pcHostname}.`,
      );
    }

    // Find available registered workstations with no assigned student
    const availablePcs = await this.prisma.cbtPcRegistration.findMany({
      where: {
        assignedStudentId: null,
        ...(dto.cbtCode ? { cbtCode: dto.cbtCode.trim().toUpperCase() } : {}),
        ...(dto.examId ? { OR: [{ examId: dto.examId }, { examId: null }] } : {}),
      },
      orderBy: { registeredAt: 'asc' },
    });

    if (!availablePcs || availablePcs.length === 0) {
      throw new BadRequestException(
        'No available physical workstations found waiting for candidate allocation. Please ensure physical PCs are registered with the examination server.',
      );
    }

    // Prioritize online workstations if available, then pick randomly among available workstations
    const onlinePcs: typeof availablePcs = [];
    for (const p of availablePcs) {
      const pcRecord = await this.prisma.pc.findUnique({ where: { hostname: p.pcHostname } });
      if (pcRecord?.status === 'ONLINE') {
        onlinePcs.push(p);
      }
    }
    const pool = onlinePcs.length > 0 ? onlinePcs : availablePcs;
    const targetPc = pool[Math.floor(Math.random() * pool.length)];

    return this.allocateStudent(adminId, {
      pcHostname: targetPc.pcHostname,
      pcRegistrationId: targetPc.id,
      studentId: student.id,
      examId: dto.examId || targetPc.examId || undefined,
      sessionId: dto.sessionId || targetPc.sessionId || undefined,
      cbtCode: targetPc.cbtCode,
      invigilatorId: dto.invigilatorId,
      invigilatorName: dto.invigilatorName,
    });
  }

  async deallocateStudent(adminId: string, dto: DeallocateStudentDto) {
    const pcHostname = (dto.pcHostname || '').trim().toUpperCase();

    if (!pcHostname) {
      throw new BadRequestException('pcHostname is required.');
    }

    const now = new Date();

    if (dto.pcRegistrationId) {
      await this.prisma.cbtPcRegistration.updateMany({
        where: { id: dto.pcRegistrationId },
        data: {
          assignedStudentId: null,
          assignedStudentName: null,
          assignedStudentRegNo: null,
          assignedInvigilatorId: null,
          assignedInvigilatorName: null,
          isDobVerified: false,
          status: 'REGISTERED',
          updatedAt: now,
        },
      });
    }

    await this.prisma.cbtPcRegistration.updateMany({
      where: { pcHostname },
      data: {
        assignedStudentId: null,
        assignedStudentName: null,
        assignedStudentRegNo: null,
        assignedInvigilatorId: null,
        assignedInvigilatorName: null,
        isDobVerified: false,
        status: 'REGISTERED',
        updatedAt: now,
      },
    });

    await this.prisma.pc.updateMany({
      where: { hostname: pcHostname },
      data: {
        assignedStudentId: null,
        assignedInvigilatorId: null,
        currentStudentId: null,
        cbtStatus: 'REGISTERED',
        lastSeen: now,
      },
    });

    const socketServer = this.realtimeService.getServer();
    if (socketServer) {
      socketServer.emit('cbt:student-deallocated', {
        pcHostname,
        cbtStatus: 'REGISTERED',
      });
      socketServer.emit('cbt:pc-list-updated', { pcHostname });
    }

    this.logger.log(`[CBT] Student deallocated from PC ${pcHostname}. Status reset to REGISTERED.`);

    return {
      success: true,
      message: `Workstation ${pcHostname} released and returned to Waiting for Allocation.`,
      pcHostname,
      cbtStatus: 'REGISTERED',
    };
  }

  /*
   * ==========================================================
   * 2.2 DATE OF BIRTH (DOB) VERIFICATION & EXAM UNLOCK
   * ==========================================================
   */

  async verifyDob(dto: VerifyDobDto) {
    const pcHostname = (dto.pcHostname || '').trim().toUpperCase();
    const rawDob = (dto.dateOfBirth || '').trim();

    if (!pcHostname || !rawDob) {
      throw new BadRequestException('pcHostname and dateOfBirth are required.');
    }

    // 1. Find registration for this PC
    const reg = await this.prisma.cbtPcRegistration.findFirst({
      where: { pcHostname },
      include: {
        exam: {
          include: {
            questionPaper: {
              include: {
                questions: {
                  orderBy: { orderIndex: 'asc' },
                  select: {
                    id: true,
                    questionText: true,
                    questionType: true,
                    section: true,
                    orderIndex: true,
                    options: true,
                    marks: true,
                    negativeMarks: true,
                    imageUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!reg || !reg.assignedStudentId) {
      throw new BadRequestException('No candidate is currently assigned to this workstation. Please wait for invigilator allocation.');
    }

    // 2. Find Student Record
    const student = await this.prisma.user.findUnique({
      where: { id: reg.assignedStudentId },
      include: { department: true, institution: true },
    });

    if (!student) {
      throw new NotFoundException('Assigned student record not found.');
    }

    // Check if candidate has already completed this examination
    if (reg.examId) {
      const priorAttempt = await this.prisma.examAttempt.findFirst({
        where: {
          examId: reg.examId,
          studentId: student.id,
          status: { in: ['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'] },
        },
      });

      if (priorAttempt) {
        return {
          success: false,
          verified: false,
          message: 'Examination already attempted. You cannot take this examination again during this scheduled session.',
        };
      }
    }

    // 3. Candidate ID / Reg Number Match (if candidate supplied regNumber)
    if (dto.regNumber && dto.regNumber.trim()) {
      const inputReg = dto.regNumber.trim().toUpperCase();
      const validIds = [
        (student.regNumber || '').toUpperCase(),
        (student.username || '').toUpperCase(),
        (student.rollNumber || '').toUpperCase(),
        student.id.toUpperCase(),
      ];

      if (!validIds.includes(inputReg)) {
        return {
          success: false,
          verified: false,
          message: 'Candidate Registration Number does not match the student allocated to this workstation.',
        };
      }
    }

    // 4. Verify Date of Birth
    const normalizeDob = (val: string) => {
      if (!val) return '';
      return val.replace(/[\/\-\.\s]/g, '').trim();
    };

    const inputNormalized = normalizeDob(rawDob);
    const storedNormalized = normalizeDob(student.dateOfBirth || '');

    let isMatch = false;
    if (storedNormalized) {
      if (inputNormalized === storedNormalized) {
        isMatch = true;
      } else if (rawDob === student.dateOfBirth) {
        isMatch = true;
      } else {
        try {
          const inputDate = new Date(rawDob).toISOString().slice(0, 10);
          const storedDate = new Date(student.dateOfBirth || '').toISOString().slice(0, 10);
          if (inputDate === storedDate) isMatch = true;
        } catch {}
      }
    } else {
      // Legacy student record without DOB: record entered DOB and approve
      isMatch = true;
      await this.prisma.user.update({
        where: { id: student.id },
        data: { dateOfBirth: rawDob },
      });
    }

    if (!isMatch) {
      return {
        success: false,
        verified: false,
        message: 'Invalid Date of Birth entered. Please verify with your invigilator.',
      };
    }

    // 5. Mark Registration & PC as EXAM_READY / UNLOCKED
    const now = new Date();
    await this.prisma.cbtPcRegistration.update({
      where: { id: reg.id },
      data: {
        isDobVerified: true,
        status: 'EXAM_READY',
        updatedAt: now,
      },
    });

    await this.prisma.pc.updateMany({
      where: { hostname: pcHostname },
      data: {
        cbtStatus: 'EXAM_READY',
        lastSeen: now,
      },
    });

    // 6. Emit Socket.IO verification event
    const socketServer = this.realtimeService.getServer();
    if (socketServer) {
      socketServer.emit('cbt:dob-verified', {
        pcHostname,
        studentId: student.id,
        studentName: student.name || student.username,
        regNumber: student.regNumber || student.rollNumber || student.username,
        cbtStatus: 'EXAM_READY',
        unlockedAt: now.toISOString(),
      });
      socketServer.emit('cbt:pc-list-updated', { pcHostname });
    }

    this.logger.log(`[CBT] Candidate verified: ${student.username} on ${pcHostname}. Exam unlocked.`);

    return {
      success: true,
      verified: true,
      message: 'Candidate identity verified. Examination paper unlocked.',
      student: {
        id: student.id,
        name: student.name || student.username,
        regNumber: student.regNumber || student.rollNumber || student.username,
        dateOfBirth: student.dateOfBirth,
        semester: student.semester || 'Semester 1',
        department: student.department?.name || student.departmentName || 'General',
      },
      exam: reg.exam
        ? {
            id: reg.exam.id,
            title: reg.exam.title,
            subject: reg.exam.subject,
            instructions: reg.exam.instructions,
            durationMinutes: reg.exam.durationMinutes,
            totalMarks: reg.exam.totalMarks,
            passingMarks: reg.exam.passingMarks,
            totalQuestions: reg.exam.questionPaper?.questions?.length || 0,
            questions: reg.exam.questionPaper?.questions || [],
          }
        : null,
    };
  }

  /*
   * ==========================================================
   * 2.3 PC ALLOCATION & STATUS LOOKUP (AGENT & CBT CLIENTS)
   * ==========================================================
   */

  async getPcAllocation(pcHostname?: string, cbtCode?: string) {
    return this.getStudentCbtExamination({
      pcHostname: pcHostname || '',
      cbtCode: cbtCode || '',
    });
  }

  /**
   * ==========================================================
   * GET /student/cbt & GET /cbt/pc-allocation
   *
   * Unified authoritative endpoint for physical CBT agent,
   * student browser client, and admin polling.
   *
   * Returns:
   *  - WAITING_FOR_ALLOCATION (200 OK) when PC registered but unallocated
   *  - READY / EXAM_IN_PROGRESS with full examination payload when allocated
   *  - PC_NOT_REGISTERED / INVALID_CBT_CODE when PC not found
   *  - Server-authoritative countdown timer
   * ==========================================================
   */
  async getStudentCbtExamination(params: { pcHostname?: string; cbtCode?: string }) {
    const upperHost = (params.pcHostname || '').trim().toUpperCase();
    const cleanCbtCode = (params.cbtCode || '').trim().toUpperCase();
    const now = new Date();

    // 1. Fetch institution branding
    const branding = await this.prisma.institution.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    const institutionPayload = branding
      ? {
          name: branding.name,
          code: branding.code,
          board: branding.board || 'Central Board of Secondary & Higher Education',
          location: branding.location || 'Main Examination Center',
          logoUrl: branding.logoUrl || null,
        }
      : {
          name: 'Central Examination Authority',
          code: 'CEA',
          board: 'Central Board of Secondary & Higher Education',
          location: 'Main Examination Center',
          logoUrl: null,
        };

    // 2. Locate CBT PC Registration
    let reg: any = null;
    if (upperHost && cleanCbtCode) {
      reg = await this.prisma.cbtPcRegistration.findFirst({
        where: {
          pcHostname: upperHost,
          cbtCode: cleanCbtCode,
        },
        include: {
          exam: {
            include: {
              session: true,
              questionPaper: {
                include: {
                  questions: {
                    orderBy: { orderIndex: 'asc' },
                  },
                },
              },
            },
          },
        },
      });
    }

    if (!reg && upperHost) {
      reg = await this.prisma.cbtPcRegistration.findFirst({
        where: { pcHostname: upperHost },
        orderBy: { registeredAt: 'desc' },
        include: {
          exam: {
            include: {
              session: true,
              questionPaper: {
                include: {
                  questions: {
                    orderBy: { orderIndex: 'asc' },
                  },
                },
              },
            },
          },
        },
      });
    }

    if (!reg && cleanCbtCode) {
      reg = await this.prisma.cbtPcRegistration.findFirst({
        where: { cbtCode: cleanCbtCode },
        orderBy: { registeredAt: 'desc' },
        include: {
          exam: {
            include: {
              session: true,
              questionPaper: {
                include: {
                  questions: {
                    orderBy: { orderIndex: 'asc' },
                  },
                },
              },
            },
          },
        },
      });
    }

    // Lookup PC record from Pc table
    const pc = upperHost
      ? await this.prisma.pc.findUnique({
          where: { hostname: upperHost },
        })
      : null;

    // 3. If workstation is NOT registered in database
    if (!reg && !pc) {
      return {
        status: 'PC_NOT_REGISTERED',
        assignmentStatus: 'PC_NOT_REGISTERED',
        registered: false,
        cbtStatus: 'IDLE',
        pcHostname: upperHost,
        cbtCode: cleanCbtCode || null,
        institution: institutionPayload,
        message: 'Workstation is not registered for CBT. Please register via the Windows Agent or Admin Console.',
        serverTime: now.toISOString(),
        serverCurrentTime: now.getTime(),
        remainingSeconds: 0,
      };
    }

    // 4. If registered but NO student is currently allocated
    const assignedStudentId = reg?.assignedStudentId || pc?.assignedStudentId;
    if (!assignedStudentId) {
      return {
        status: 'WAITING_FOR_ALLOCATION',
        assignmentStatus: 'WAITING_FOR_ALLOCATION',
        registered: true,
        cbtStatus: 'WAITING_FOR_ALLOCATION',
        assigned: false,
        isDobVerified: false,
        candidateVerificationRequired: false,
        pcHostname: upperHost || reg?.pcHostname || 'LOCAL_PC',
        cbtCode: reg?.cbtCode || cleanCbtCode || 'CBT_SESSION',
        pcRegistrationId: reg?.id || null,
        pc: {
          hostname: upperHost || reg?.pcHostname || 'LOCAL_PC',
          labName: pc?.labName || 'Main Lab',
          ipAddress: (pc as any)?.ipAddress || (pc as any)?.ip || null,
          isOnline: pc?.status === 'ONLINE',
          lastSeen: pc?.lastSeen || null,
        },
        institution: institutionPayload,
        session: reg?.exam?.session
          ? {
              id: reg.exam.session.id,
              sessionCode: reg.exam.session.sessionCode,
              classTitle: reg.exam.session.classTitle,
              durationMinutes: reg.exam.session.durationMinutes,
            }
          : null,
        exam: reg?.exam
          ? {
              id: reg.exam.id,
              title: reg.exam.title,
              subject: reg.exam.subject,
              durationMinutes: reg.exam.durationMinutes,
              totalMarks: reg.exam.totalMarks,
              passingMarks: reg.exam.passingMarks,
              questionCount: reg.exam.questionPaper?.questions?.length || 0,
            }
          : null,
        serverTime: now.toISOString(),
        serverCurrentTime: now.getTime(),
        remainingSeconds: 0,
        message: 'Workstation registered. Waiting for candidate allocation by administrator.',
      };
    }

    // 5. Lookup assigned student details
    const student = await this.prisma.user.findUnique({
      where: { id: assignedStudentId },
      include: { department: true, institution: true },
    });

    if (!student) {
      return {
        status: 'WAITING_FOR_ALLOCATION',
        assignmentStatus: 'WAITING_FOR_ALLOCATION',
        registered: true,
        cbtStatus: 'WAITING_FOR_ALLOCATION',
        assigned: false,
        isDobVerified: false,
        pcHostname: upperHost || reg?.pcHostname || 'LOCAL_PC',
        cbtCode: reg?.cbtCode || cleanCbtCode || null,
        institution: institutionPayload,
        serverTime: now.toISOString(),
        serverCurrentTime: now.getTime(),
        remainingSeconds: 0,
        message: 'Assigned student record could not be found. Please reallocate candidate.',
      };
    }

    // 6. Find Examination & Question Paper
    let exam = reg?.exam;
    if (!exam && reg?.examId) {
      exam = await this.prisma.exam.findUnique({
        where: { id: reg.examId },
        include: {
          session: true,
          questionPaper: {
            include: {
              questions: {
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
        },
      });
    }

    if (!exam && (reg?.cbtCode || cleanCbtCode)) {
      exam = await this.prisma.exam.findFirst({
        where: {
          OR: [
            { cbtCode: reg?.cbtCode || cleanCbtCode },
            { status: 'ACTIVE' },
          ],
        },
        include: {
          session: true,
          questionPaper: {
            include: {
              questions: {
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Fallback if no exam found
    if (!exam) {
      exam = await this.prisma.exam.findFirst({
        where: { status: { in: ['ACTIVE', 'SCHEDULED', 'DRAFT'] } },
        include: {
          session: true,
          questionPaper: {
            include: {
              questions: {
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // 7. Check Examination Scheduling & Synchronized Launch
    const startsAt = exam?.startsAt ? new Date(exam.startsAt) : null;
    const endsAt = exam?.endsAt ? new Date(exam.endsAt) : null;

    // Check prior attempt for candidate on this exam
    if (exam && student) {
      const priorAttempt = await this.prisma.examAttempt.findFirst({
        where: {
          examId: exam.id,
          studentId: student.id,
          status: { in: ['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'] },
        },
      });

      if (priorAttempt) {
        return {
          status: 'EXAM_ALREADY_ATTEMPTED',
          assignmentStatus: 'EXAM_ALREADY_ATTEMPTED',
          cbtStatus: 'COMPLETED',
          registered: true,
          assigned: true,
          isDobVerified: reg?.isDobVerified || false,
          candidateVerificationRequired: false,
          pcHostname: upperHost || reg?.pcHostname || 'LOCAL_PC',
          cbtCode: reg?.cbtCode || cleanCbtCode,
          pc: {
            hostname: upperHost || reg?.pcHostname || 'LOCAL_PC',
            labName: pc?.labName || 'Main Lab',
            ipAddress: (pc as any)?.ipAddress || (pc as any)?.ip || null,
            isOnline: pc?.status === 'ONLINE',
          },
          student: {
            id: student.id,
            name: student.name || student.username,
            username: student.username,
            regNumber: student.regNumber || student.rollNumber || student.username,
            registrationNumber: student.regNumber || student.rollNumber || student.username,
            semester: student.semester || 'Semester 1',
            department: student.department?.name || student.departmentName || 'General',
          },
          exam: {
            id: exam.id,
            title: exam.title,
            subject: exam.subject,
            durationMinutes: exam.durationMinutes,
            startsAt: startsAt?.toISOString() || null,
            startTime: startsAt?.toISOString() || null,
          },
          serverTime: now.toISOString(),
          serverCurrentTime: now.getTime(),
          remainingSeconds: 0,
          message: 'Examination already attempted. You cannot take this examination again during this scheduled session.',
        };
      }
    }

    if (startsAt && now < startsAt && (exam?.status === 'SCHEDULED' || exam?.status === 'DRAFT' || exam?.status === 'ACTIVE')) {
      const secondsToStart = Math.floor((startsAt.getTime() - now.getTime()) / 1000);
      if (secondsToStart > 300) {
        // More than 5 minutes before scheduled start time
        return {
          status: 'WAITING_FOR_SCHEDULED_TIME',
          assignmentStatus: 'WAITING_FOR_SCHEDULED_TIME',
          registered: true,
          cbtStatus: 'ALLOCATED',
          assigned: true,
          isDobVerified: reg?.isDobVerified || false,
          candidateVerificationRequired: !reg?.isDobVerified,
          pcHostname: upperHost || reg?.pcHostname,
          cbtCode: reg?.cbtCode || cleanCbtCode,
          scheduledStartTime: startsAt.toISOString(),
          secondsToStart,
          countdownSeconds: secondsToStart,
          pc: {
            hostname: upperHost || reg?.pcHostname,
            labName: pc?.labName || 'Main Lab',
            ipAddress: (pc as any)?.ipAddress || (pc as any)?.ip || null,
            isOnline: pc?.status === 'ONLINE',
          },
          student: {
            id: student.id,
            name: student.name || student.username,
            username: student.username,
            regNumber: student.regNumber || student.rollNumber || student.username,
            registrationNumber: student.regNumber || student.rollNumber || student.username,
            semester: student.semester || 'Semester 1',
            department: student.department?.name || student.departmentName || 'Computer Science',
          },
          exam: {
            id: exam.id,
            title: exam.title,
            subject: exam.subject,
            durationMinutes: exam.durationMinutes,
            startsAt: startsAt.toISOString(),
            startTime: startsAt.toISOString(),
          },
          serverTime: now.toISOString(),
          serverCurrentTime: now.getTime(),
          remainingSeconds: 0,
          message: `PC authorized. Examination has not started yet. Please wait. (Scheduled for ${startsAt.toLocaleTimeString()})`,
        };
      } else if (secondsToStart > 0) {
        // 5-Minute Countdown Window before exam start
        return {
          status: 'COUNTDOWN',
          assignmentStatus: 'COUNTDOWN',
          registered: true,
          cbtStatus: 'EXAM_READY',
          assigned: true,
          isDobVerified: reg?.isDobVerified || false,
          candidateVerificationRequired: !reg?.isDobVerified,
          pcHostname: upperHost || reg?.pcHostname,
          cbtCode: reg?.cbtCode || cleanCbtCode,
          scheduledStartTime: startsAt.toISOString(),
          countdownSeconds: secondsToStart,
          secondsToStart,
          pc: {
            hostname: upperHost || reg?.pcHostname,
            labName: pc?.labName || 'Main Lab',
            ipAddress: (pc as any)?.ipAddress || (pc as any)?.ip || null,
            isOnline: pc?.status === 'ONLINE',
          },
          student: {
            id: student.id,
            name: student.name || student.username,
            username: student.username,
            regNumber: student.regNumber || student.rollNumber || student.username,
            registrationNumber: student.regNumber || student.rollNumber || student.username,
            semester: student.semester || 'Semester 1',
            department: student.department?.name || student.departmentName || 'Computer Science',
          },
          exam: {
            id: exam.id,
            title: exam.title,
            subject: exam.subject,
            durationMinutes: exam.durationMinutes,
            startsAt: startsAt.toISOString(),
            startTime: startsAt.toISOString(),
          },
          serverTime: now.toISOString(),
          serverCurrentTime: now.getTime(),
          remainingSeconds: 0,
          message: 'EXAMINATION READY. Please wait for the examination to begin.',
        };
      }
    }

    if (endsAt && now > endsAt) {
      return {
        status: 'EXAM_ENDED',
        assignmentStatus: 'EXAM_ENDED',
        registered: true,
        cbtStatus: 'COMPLETED',
        assigned: true,
        isDobVerified: reg?.isDobVerified || false,
        pcHostname: upperHost || reg?.pcHostname,
        cbtCode: reg?.cbtCode || cleanCbtCode,
        pc: {
          hostname: upperHost || reg?.pcHostname,
          labName: pc?.labName || 'Main Lab',
          ipAddress: (pc as any)?.ipAddress || (pc as any)?.ip || null,
          isOnline: pc?.status === 'ONLINE',
        },
        student: {
          id: student.id,
          name: student.name || student.username,
          username: student.username,
          regNumber: student.regNumber || student.rollNumber || student.username,
          registrationNumber: student.regNumber || student.rollNumber || student.username,
        },
        exam: exam ? {
          id: exam.id,
          title: exam.title,
          subject: exam.subject,
          endsAt: endsAt.toISOString(),
          endTime: endsAt.toISOString(),
        } : null,
        serverTime: now.toISOString(),
        serverCurrentTime: now.getTime(),
        remainingSeconds: 0,
        message: 'The examination testing window has concluded.',
      };
    }

    // 8. Find or Create ExamAttempt for candidate
    let attempt: any = null;
    if (exam) {
      attempt = await this.prisma.examAttempt.findFirst({
        where: {
          examId: exam.id,
          studentId: student.id,
        },
        include: {
          answers: true,
        },
        orderBy: { startedAt: 'desc' },
      });

      if (!attempt) {
        const durationSec = (exam.durationMinutes || 60) * 60;
        attempt = await this.prisma.examAttempt.create({
          data: {
            examId: exam.id,
            studentId: student.id,
            sessionId: reg?.sessionId || exam.sessionId || null,
            pcHostname: upperHost || reg?.pcHostname || null,
            status: 'IN_PROGRESS',
            startedAt: now,
            timeRemainingSeconds: durationSec,
          },
          include: {
            answers: true,
          },
        });
      }
    }

    // 9. Compute Server-Authoritative Timer
    const durationMinutes = exam?.durationMinutes || 60;
    const durationSeconds = durationMinutes * 60;
    const attemptStartTime = attempt?.startedAt ? new Date(attempt.startedAt) : now;
    const elapsedSeconds = Math.floor((now.getTime() - attemptStartTime.getTime()) / 1000);
    let remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);

    if (attempt?.status === 'SUBMITTED' || attempt?.status === 'AUTO_SUBMITTED' || attempt?.status === 'EVALUATED') {
      remainingSeconds = 0;
    }

    const examStartTime = attemptStartTime.toISOString();
    const examEndTime = new Date(attemptStartTime.getTime() + durationSeconds * 1000).toISOString();

    // 10. Format and Sanitize Questions (Deterministic Candidate Shuffling)
    const savedAnswersMap = new Map();
    if (attempt?.answers) {
      for (const ans of attempt.answers) {
        savedAnswersMap.set(ans.questionId, ans);
      }
    }

    const rawQuestions = exam?.questionPaper?.questions || [];
    const seed = `${student.id}-${exam?.id || 'exam'}`;
    const shuffledPool = this.deterministicShuffle(rawQuestions, seed);

    const questions = shuffledPool.map((q: any, idx: number) => {
      let rawOpts = q.options;
      if (typeof rawOpts === 'string') {
        try {
          rawOpts = JSON.parse(rawOpts);
        } catch {
          rawOpts = [];
        }
      }

      let formattedOptions: Array<{ id: string; text: string }> = [];
      let optionList: string[] = [];

      if (Array.isArray(rawOpts)) {
        formattedOptions = rawOpts.map((opt: any, optIdx: number) => {
          const label = String.fromCharCode(65 + optIdx); // A, B, C, D
          if (typeof opt === 'string') {
            optionList.push(opt);
            return { id: label, text: opt };
          }
          if (opt && typeof opt === 'object') {
            const id = opt.id || label;
            const text = opt.text || opt.label || String(opt);
            optionList.push(text);
            return { id, text };
          }
          const textStr = String(opt);
          optionList.push(textStr);
          return { id: label, text: textStr };
        });
      }

      // Default fallback to 4 options if empty
      if (formattedOptions.length === 0) {
        formattedOptions = [
          { id: 'A', text: 'Option A' },
          { id: 'B', text: 'Option B' },
          { id: 'C', text: 'Option C' },
          { id: 'D', text: 'Option D' },
        ];
        optionList = ['Option A', 'Option B', 'Option C', 'Option D'];
      }

      const saved = savedAnswersMap.get(q.id);

      return {
        id: q.id,
        questionId: q.id,
        question: q.questionText,
        questionText: q.questionText,
        questionType: q.questionType || 'MCQ',
        section: q.section || 'General',
        orderIndex: q.orderIndex !== undefined ? q.orderIndex : idx + 1,
        marks: q.marks || 1.0,
        negativeMarks: q.negativeMarks || 0.0,
        imageUrl: q.imageUrl || null,
        options: formattedOptions,
        optionList,
        savedOption: saved?.selectedOption || null,
        savedAnswer: saved?.selectedOption || null,
        isMarkedForReview: saved?.isMarkedForReview || false,
      };
    });

    // 11. Final Status Resolution
    let finalStatus = 'READY';
    if (attempt?.status === 'SUBMITTED' || attempt?.status === 'AUTO_SUBMITTED' || attempt?.status === 'EVALUATED') {
      finalStatus = 'EXAM_ENDED';
    } else if (remainingSeconds <= 0) {
      finalStatus = 'TIME_UP';
    }

    return {
      status: finalStatus,
      assignmentStatus: finalStatus,
      cbtStatus: reg?.isDobVerified ? 'EXAM_READY' : 'ALLOCATED',
      registered: true,
      assigned: true,
      isDobVerified: reg?.isDobVerified || false,
      candidateVerificationRequired: !reg?.isDobVerified,
      pcHostname: upperHost || reg?.pcHostname || 'LOCAL_PC',
      cbtCode: reg?.cbtCode || cleanCbtCode || 'CBT_SESSION',
      pcRegistrationId: reg?.id || null,
      serverTime: now.toISOString(),
      serverCurrentTime: now.getTime(),
      remainingSeconds,

      pc: {
        hostname: upperHost || reg?.pcHostname || 'LOCAL_PC',
        labName: pc?.labName || 'Main Lab',
        ipAddress: (pc as any)?.ipAddress || (pc as any)?.ip || null,
        isOnline: pc?.status === 'ONLINE',
        lastSeen: pc?.lastSeen || null,
      },

      student: {
        id: student.id,
        name: student.name || student.username,
        username: student.username,
        regNumber: student.regNumber || student.rollNumber || student.username,
        registrationNumber: student.regNumber || student.rollNumber || student.username,
        dateOfBirth: student.dateOfBirth || null,
        classId: student.classId || 'Standard',
        semester: student.semester || 'Semester 1',
        department: student.department?.name || student.departmentName || 'Computer Science & Engineering',
        email: student.email || null,
      },

      exam: exam
        ? {
            id: exam.id,
            title: exam.title,
            subject: exam.subject,
            description: exam.description || null,
            instructions: exam.instructions || 'Answer all questions carefully. Timer is synced with the server.',
            durationMinutes: exam.durationMinutes,
            totalMarks: exam.totalMarks,
            passingMarks: exam.passingMarks,
            totalQuestions: questions.length,
            startTime: examStartTime,
            endTime: examEndTime,
            startsAt: exam.startsAt,
            endsAt: exam.endsAt,
            status: exam.status,
          }
        : null,

      questionPaper: exam?.questionPaper
        ? {
            id: exam.questionPaper.id,
            title: exam.questionPaper.title,
            subject: exam.questionPaper.subject,
            totalQuestions: questions.length,
            questions,
          }
        : {
            id: 'qp-default',
            title: exam?.title || 'Examination Paper',
            subject: exam?.subject || 'General Assessment',
            totalQuestions: questions.length,
            questions,
          },

      session: {
        id: attempt?.id || 'session-default',
        attemptId: attempt?.id || 'attempt-default',
        sessionId: reg?.sessionId || exam?.sessionId || null,
        cbtCode: reg?.cbtCode || cleanCbtCode,
        status: finalStatus,
        startedAt: examStartTime,
        startTime: examStartTime,
        endTime: examEndTime,
        durationMinutes,
        remainingSeconds,
        serverTime: now.toISOString(),
        serverCurrentTime: now.getTime(),
      },

      attempt: attempt
        ? {
            id: attempt.id,
            status: attempt.status,
            startedAt: attempt.startedAt,
            timeRemainingSeconds: remainingSeconds,
          }
        : null,

      institution: institutionPayload,
      invigilatorName: reg?.assignedInvigilatorName || 'Assigned Invigilator',
    };
  }

  /*
   * ==========================================================
   * 2.4 EMERGENCY PC TERMINATION (CTRL + ALT + C WITH AUTH)
   * ==========================================================
   */

  async terminatePc(dto: TerminatePcDto) {
    const pcHostname = (dto.pcHostname || '').trim().toUpperCase();
    const username = (dto.username || '').trim();
    const password = (dto.password || '');

    if (!pcHostname || !username || !password) {
      throw new BadRequestException('pcHostname, username, and password are required.');
    }

    // 1. Authenticate administrator
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username }, { email: username }],
        role: { in: ['ADMIN', 'SUPER_ADMIN', 'TEACHER'] },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid administrator credentials.');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid administrator credentials.');
    }

    // 2. Deregister CBT registration & terminate PC state
    const now = new Date();
    await this.prisma.cbtPcRegistration.updateMany({
      where: { pcHostname },
      data: {
        status: 'TERMINATED',
        assignedStudentId: null,
        assignedStudentName: null,
        assignedStudentRegNo: null,
        isDobVerified: false,
        updatedAt: now,
      },
    });

    await this.prisma.pc.updateMany({
      where: { hostname: pcHostname },
      data: {
        status: 'OFFLINE',
        cbtStatus: 'TERMINATED',
        assignedStudentId: null,
        assignedInvigilatorId: null,
        currentStudentId: null,
        currentSessionId: null,
        lastSeen: now,
      },
    });

    // 3. Audit log
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'PC_TERMINATED_EMERGENCY',
        targetPc: pcHostname,
        metadata: JSON.stringify({
          terminatedBy: user.username,
          role: user.role,
          reason: dto.reason || 'Emergency shortcut / administrator termination',
          timestamp: now.toISOString(),
        }),
      },
    });

    // 4. Emit Socket.IO termination event
    const socketServer = this.realtimeService.getServer();
    if (socketServer) {
      socketServer.emit('cbt:pc-terminated', {
        pcHostname,
        terminatedBy: user.username,
        reason: dto.reason || 'Emergency shortcut / administrator termination',
        cbtStatus: 'TERMINATED',
      });
      socketServer.emit('cbt:pc-list-updated', { pcHostname });
    }

    return {
      success: true,
      message: `PC ${pcHostname} has been securely terminated and returned to idle state.`,
      pcHostname,
      cbtStatus: 'TERMINATED',
    };
  }

  async toggleEmergencyTermination(adminId: string, dto: EmergencyTerminationToggleDto) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin user not found.');

    const isValidPassword = await bcrypt.compare(dto.adminPassword, admin.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException('Admin password verification failed.');
    }

    await this.prisma.authoritySetting.upsert({
      where: { key: 'EMERGENCY_TERMINATION_ENABLED' },
      create: {
        key: 'EMERGENCY_TERMINATION_ENABLED',
        passwordHash: dto.enabled ? 'true' : 'false',
        updatedById: adminId,
      },
      update: {
        passwordHash: dto.enabled ? 'true' : 'false',
        updatedById: adminId,
      },
    });

    const socketServer = this.realtimeService.getServer();
    if (socketServer) {
      socketServer.emit('cbt:emergency-termination-updated', { enabled: dto.enabled });
    }

    return {
      success: true,
      enabled: dto.enabled,
      message: `Emergency termination shortcut (Ctrl + Alt + C) ${dto.enabled ? 'ENABLED' : 'DISABLED'}.`,
    };
  }

  async getEmergencyTerminationStatus() {
    const setting = await this.prisma.authoritySetting.findUnique({
      where: { key: 'EMERGENCY_TERMINATION_ENABLED' },
    });
    return {
      enabled: setting?.passwordHash === 'true',
    };
  }

  async deleteRegisteredPc(examIdOrCode: string, pcHostname: string) {
    const upperHost = pcHostname.trim().toUpperCase();
    const upperCode = examIdOrCode ? examIdOrCode.trim().toUpperCase() : '';

    if (upperCode) {
      await this.prisma.cbtPcRegistration.deleteMany({
        where: {
          pcHostname: upperHost,
          OR: [{ cbtCode: upperCode }, { examId: examIdOrCode }],
        },
      });
    } else {
      await this.prisma.cbtPcRegistration.deleteMany({
        where: {
          pcHostname: upperHost,
        },
      });
    }

    const socketServer = this.realtimeService.getServer();
    if (socketServer) {
      socketServer.emit('cbt:pc-deregistered', { pcHostname: upperHost, cbtCode: upperCode });
      socketServer.emit('cbt:pc-list-updated', { cbtCode: upperCode, examId: examIdOrCode, pcHostname: upperHost });
    }

    return { success: true, pcHostname: upperHost };
  }

  async savePcConfig(examId: string, isLocked: boolean = true) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException(`Exam not found.`);

    const updated = await this.prisma.exam.update({
      where: { id: examId },
      data: { isPcConfigLocked: isLocked },
    });

    const socketServer = this.realtimeService.getServer();
    if (socketServer) {
      socketServer.emit('cbt:pc-list-updated', { examId, cbtCode: exam.cbtCode });
    }

    return { success: true, isPcConfigLocked: updated.isPcConfigLocked };
  }

  /*
   * ==========================================================
   * 3. QUESTION PAPERS & MANDATORY 4-OPTION VALIDATION
   * ==========================================================
   */

  async createQuestionPaper(userId: string, dto: CreateQuestionPaperDto) {
    const totalMarks =
      dto.totalMarks ??
      (dto.questions?.reduce((acc, q) => acc + (q.marks || 1), 0) || 100);

    // Validate each question if provided upfront
    if (dto.questions?.length) {
      for (let i = 0; i < dto.questions.length; i++) {
        const q = dto.questions[i];
        this.validateQuestionDto(q, i + 1);
      }
    }

    return this.prisma.questionPaper.create({
      data: {
        title: dto.title.trim(),
        subject: dto.subject.trim(),
        description: dto.description?.trim() || null,
        totalMarks: Number(totalMarks),
        passingMarks: Number(dto.passingMarks ?? totalMarks * 0.4),
        createdById: userId,
        questions: dto.questions?.length
          ? {
              create: dto.questions.map((q, idx) => ({
                questionText: q.questionText.trim(),
                questionType: q.questionType || 'MCQ',
                section: q.section || 'General',
                orderIndex: q.orderIndex ?? idx + 1,
                options: q.options as any,
                correctAnswer: q.correctAnswer.trim().toUpperCase(),
                marks: Number(q.marks || 1.0),
                negativeMarks: Number(q.negativeMarks || 0.0),
                explanation: q.explanation?.trim() || null,
                imageUrl: q.imageUrl?.trim() || null,
              })),
            }
          : undefined,
      },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }

  async listQuestionPapers(subject?: string) {
    return this.prisma.questionPaper.findMany({
      where: subject ? { subject: { contains: subject, mode: 'insensitive' } } : undefined,
      include: {
        _count: {
          select: { questions: true, exams: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQuestionPaper(id: string) {
    const qp = await this.prisma.questionPaper.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
        },
        createdBy: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    if (!qp) {
      throw new NotFoundException(`Question paper with ID ${id} not found.`);
    }

    return qp;
  }

  async updateQuestionPaper(id: string, dto: UpdateQuestionPaperDto) {
    await this.getQuestionPaper(id);

    return this.prisma.questionPaper.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        subject: dto.subject?.trim(),
        description: dto.description?.trim(),
        totalMarks: dto.totalMarks ? Number(dto.totalMarks) : undefined,
        passingMarks: dto.passingMarks ? Number(dto.passingMarks) : undefined,
      },
    });
  }

  async deleteQuestionPaper(id: string) {
    await this.getQuestionPaper(id);
    return this.prisma.questionPaper.delete({ where: { id } });
  }

  /*
   * ==========================================================
   * 4. QUESTIONS MANAGEMENT & 4-OPTION VALIDATION
   * ==========================================================
   */

  private validateQuestionDto(dto: CreateQuestionDto, index: number = 1) {
    if (!dto.questionText || !dto.questionText.trim()) {
      throw new BadRequestException(`Question #${index}: Question text is mandatory.`);
    }

    if (!Array.isArray(dto.options) || dto.options.length < 4) {
      throw new BadRequestException(
        `Question #${index}: At least FOUR answer options (Option A, B, C, D) are strictly mandatory for every CBT question. Provided: ${dto.options?.length || 0}.`,
      );
    }

    // Ensure all options have valid text
    for (let i = 0; i < dto.options.length; i++) {
      const opt = dto.options[i];
      if (!opt.text || !opt.text.trim()) {
        throw new BadRequestException(
          `Question #${index}: Option ${opt.id || String.fromCharCode(65 + i)} cannot be empty.`,
        );
      }
    }

    // Ensure correct answer is specified
    if (!dto.correctAnswer || !dto.correctAnswer.trim()) {
      throw new BadRequestException(
        `Question #${index}: You must select exactly one correct answer option.`,
      );
    }
  }

  async addQuestion(paperId: string, dto: CreateQuestionDto) {
    await this.getQuestionPaper(paperId);

    // Validate 4 options mandatory rule
    this.validateQuestionDto(dto);

    const question = await this.prisma.question.create({
      data: {
        questionPaperId: paperId,
        questionText: dto.questionText.trim(),
        questionType: dto.questionType || 'MCQ',
        section: dto.section || 'General',
        orderIndex: Number(dto.orderIndex || 1),
        options: dto.options as any,
        correctAnswer: dto.correctAnswer.trim().toUpperCase(),
        marks: Number(dto.marks || 1.0),
        negativeMarks: Number(dto.negativeMarks || 0.0),
        explanation: dto.explanation?.trim() || null,
        imageUrl: dto.imageUrl?.trim() || null,
      },
    });

    // Recalculate total marks for the paper
    const allQuestions = await this.prisma.question.findMany({
      where: { questionPaperId: paperId },
    });
    const newTotal = allQuestions.reduce((acc, q) => acc + q.marks, 0);

    await this.prisma.questionPaper.update({
      where: { id: paperId },
      data: { totalMarks: newTotal },
    });

    return question;
  }

  async updateQuestion(paperId: string, questionId: string, dto: Partial<CreateQuestionDto>) {
    if (dto.options) {
      if (dto.options.length < 4) {
        throw new BadRequestException('At least FOUR answer options are mandatory.');
      }
    }

    const updated = await this.prisma.question.update({
      where: { id: questionId },
      data: {
        questionText: dto.questionText?.trim(),
        questionType: dto.questionType,
        section: dto.section,
        orderIndex: dto.orderIndex,
        options: dto.options as any,
        correctAnswer: dto.correctAnswer?.trim().toUpperCase(),
        marks: dto.marks ? Number(dto.marks) : undefined,
        negativeMarks: dto.negativeMarks !== undefined ? Number(dto.negativeMarks) : undefined,
        explanation: dto.explanation?.trim(),
        imageUrl: dto.imageUrl?.trim(),
      },
    });

    const allQuestions = await this.prisma.question.findMany({
      where: { questionPaperId: paperId },
    });
    const newTotal = allQuestions.reduce((acc, q) => acc + q.marks, 0);

    await this.prisma.questionPaper.update({
      where: { id: paperId },
      data: { totalMarks: newTotal },
    });

    return updated;
  }

  async deleteQuestion(paperId: string, questionId: string) {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, questionPaperId: paperId },
    });

    if (!question) {
      throw new NotFoundException(`Question not found in paper.`);
    }

    await this.prisma.question.delete({ where: { id: questionId } });

    const allQuestions = await this.prisma.question.findMany({
      where: { questionPaperId: paperId },
    });
    const newTotal = allQuestions.reduce((acc, q) => acc + q.marks, 0);

    await this.prisma.questionPaper.update({
      where: { id: paperId },
      data: { totalMarks: newTotal },
    });

    return { success: true };
  }

  /*
   * ==========================================================
   * 5. EXAMS MANAGEMENT & CBT WORKFLOW
   * ==========================================================
   */

  async createExam(userId: string, dto: CreateExamDto) {
    const qp = await this.getQuestionPaper(dto.questionPaperId);

    const totalMarks = dto.totalMarks ?? qp.totalMarks;
    const passingMarks = dto.passingMarks ?? qp.passingMarks;

    // Generate persistent unique CBT Code
    const cbtCode = await this.generateUniqueCbtCode();

    // Link CBT code to session if sessionId provided
    if (dto.sessionId) {
      await this.prisma.classSession.update({
        where: { id: dto.sessionId },
        data: {
          cbtCode,
          sessionMode: 'CBT',
        },
      });
    }

    return this.prisma.exam.create({
      data: {
        title: dto.title.trim(),
        subject: dto.subject.trim(),
        description: dto.description?.trim() || null,
        instructions: dto.instructions?.trim() || null,
        cbtCode,
        questionPaperId: dto.questionPaperId,
        sessionId: dto.sessionId || null,
        createdById: userId,
        durationMinutes: Number(dto.durationMinutes || 60),
        totalMarks: Number(totalMarks),
        passingMarks: Number(passingMarks),
        shuffleQuestions: Boolean(dto.shuffleQuestions),
        shuffleOptions: Boolean(dto.shuffleOptions),
        allowReview: dto.allowReview ?? true,
        autoSubmitOnTimeUp: dto.autoSubmitOnTimeUp ?? true,
        status: dto.status || 'SCHEDULED',
        resultVisibility: dto.resultVisibility || 'AFTER_PUBLISH',
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
      include: {
        questionPaper: {
          select: { id: true, title: true, _count: { select: { questions: true } } },
        },
        session: {
          select: { id: true, sessionCode: true, classTitle: true, status: true, cbtCode: true },
        },
      },
    });
  }

  async listExams(sessionId?: string, status?: string) {
    return this.prisma.exam.findMany({
      where: {
        sessionId: sessionId || undefined,
        status: status || undefined,
      },
      include: {
        questionPaper: {
          select: { id: true, title: true, _count: { select: { questions: true } } },
        },
        session: {
          select: { id: true, sessionCode: true, classTitle: true, status: true, cbtCode: true },
        },
        createdBy: {
          select: { id: true, name: true, username: true },
        },
        _count: {
          select: { attempts: true, results: true, pcRegistrations: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getExam(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        questionPaper: {
          include: {
            questions: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
        session: {
          select: { id: true, sessionCode: true, classTitle: true, status: true, cbtCode: true },
        },
        createdBy: {
          select: { id: true, name: true, username: true },
        },
        _count: {
          select: { attempts: true, results: true, pcRegistrations: true },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam with ID ${id} not found.`);
    }

    return exam;
  }

  async updateExam(id: string, dto: UpdateExamDto) {
    await this.getExam(id);

    return this.prisma.exam.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        subject: dto.subject?.trim(),
        description: dto.description?.trim(),
        instructions: dto.instructions?.trim(),
        questionPaperId: dto.questionPaperId,
        sessionId: dto.sessionId,
        durationMinutes: dto.durationMinutes ? Number(dto.durationMinutes) : undefined,
        totalMarks: dto.totalMarks ? Number(dto.totalMarks) : undefined,
        passingMarks: dto.passingMarks ? Number(dto.passingMarks) : undefined,
        shuffleQuestions: dto.shuffleQuestions,
        shuffleOptions: dto.shuffleOptions,
        allowReview: dto.allowReview,
        autoSubmitOnTimeUp: dto.autoSubmitOnTimeUp,
        status: dto.status,
        resultVisibility: dto.resultVisibility,
        resultPublished: dto.resultPublished,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
    });
  }

  async deleteExam(id: string) {
    await this.getExam(id);
    return this.prisma.exam.delete({ where: { id } });
  }

  /*
   * ==========================================================
   * 6. STUDENT EXAM ATTEMPT LIFECYCLE
   * ==========================================================
   */

  async getStudentActiveExam(studentId: string, sessionCodeOrId?: string, pcHostname?: string) {
    let sessionWhere = {};
    if (sessionCodeOrId) {
      sessionWhere = {
        OR: [{ id: sessionCodeOrId }, { sessionCode: sessionCodeOrId }, { cbtCode: sessionCodeOrId }],
      };
    }

    const exams = await this.prisma.exam.findMany({
      where: {
        status: { in: ['ACTIVE', 'SCHEDULED'] },
        ...(sessionCodeOrId
          ? {
              OR: [
                { session: sessionWhere },
                { cbtCode: sessionCodeOrId.toUpperCase() },
              ],
            }
          : {}),
      },
      include: {
        questionPaper: {
          select: {
            id: true,
            title: true,
            _count: { select: { questions: true } },
          },
        },
        attempts: {
          where: { studentId },
        },
        results: {
          where: { studentId },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return exams.map((exam) => {
      const attempt = exam.attempts[0] || null;
      const result = exam.results[0] || null;
      return {
        id: exam.id,
        cbtCode: exam.cbtCode,
        title: exam.title,
        subject: exam.subject,
        description: exam.description,
        instructions: exam.instructions,
        durationMinutes: exam.durationMinutes,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
        totalQuestions: exam.questionPaper?._count?.questions || 0,
        status: exam.status,
        resultPublished: exam.resultPublished,
        attemptStatus: attempt ? attempt.status : 'NOT_STARTED',
        attemptId: attempt?.id,
        hasResult: Boolean(result),
        isPassed: result?.isPassed,
        score: exam.resultPublished ? result?.obtainedMarks : null,
      };
    });
  }

  async startExam(studentId: string, dto: StartExamDto) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: dto.examId },
      include: {
        questionPaper: {
          include: {
            questions: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam not found.`);
    }

    if (exam.status !== 'ACTIVE' && exam.status !== 'SCHEDULED') {
      throw new ForbiddenException(`This examination is currently not active.`);
    }

    // Check PC Authorization if PC config is locked
    if (exam.isPcConfigLocked && dto.pcHostname) {
      const pcReg = await this.prisma.cbtPcRegistration.findFirst({
        where: {
          pcHostname: dto.pcHostname.trim().toUpperCase(),
          OR: [{ examId: exam.id }, { cbtCode: exam.cbtCode || '' }],
        },
      });

      if (!pcReg) {
        throw new ForbiddenException(
          `PC (${dto.pcHostname}) is not authorized for this CBT examination. Please contact the administrator.`,
        );
      }
    }

    // Check existing attempt
    let attempt = await this.prisma.examAttempt.findUnique({
      where: {
        examId_studentId: {
          examId: dto.examId,
          studentId,
        },
      },
      include: {
        answers: true,
      },
    });

    if (attempt && attempt.status === 'SUBMITTED') {
      throw new ConflictException(`You have already completed and submitted this examination.`);
    }

    const durationSeconds = exam.durationMinutes * 60;

    if (!attempt) {
      attempt = await this.prisma.examAttempt.create({
        data: {
          examId: dto.examId,
          studentId,
          sessionId: dto.sessionId || exam.sessionId,
          pcHostname: dto.pcHostname || null,
          status: 'IN_PROGRESS',
          timeRemainingSeconds: durationSeconds,
        },
        include: {
          answers: true,
        },
      });
    }

    // Compute remaining time server-side
    const elapsedSeconds = Math.floor(
      (Date.now() - new Date(attempt.startedAt).getTime()) / 1000,
    );
    const serverRemaining = Math.max(0, durationSeconds - elapsedSeconds);

    // Sanitize questions (strip correctAnswer and explanation for student attempt)
    const sanitizedQuestions = exam.questionPaper.questions.map((q) => {
      const savedAnswer = attempt!.answers.find((a) => a.questionId === q.id);
      return {
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        section: q.section,
        orderIndex: q.orderIndex,
        options: q.options,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        imageUrl: q.imageUrl,
        savedOption: savedAnswer?.selectedOption || null,
        isMarkedForReview: savedAnswer?.isMarkedForReview || false,
      };
    });

    return {
      attemptId: attempt.id,
      examId: exam.id,
      cbtCode: exam.cbtCode,
      title: exam.title,
      subject: exam.subject,
      instructions: exam.instructions,
      durationMinutes: exam.durationMinutes,
      timeRemainingSeconds: serverRemaining,
      totalMarks: exam.totalMarks,
      passingMarks: exam.passingMarks,
      totalQuestions: sanitizedQuestions.length,
      questions: sanitizedQuestions,
    };
  }

  async saveAnswer(studentId: string, dto: SaveAnswerDto) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: {
        examId_studentId: {
          examId: dto.examId,
          studentId,
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException(`No active attempt found.`);
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new ForbiddenException(`Exam attempt is already finalized.`);
    }

    return this.prisma.examAnswer.upsert({
      where: {
        attemptId_questionId: {
          attemptId: attempt.id,
          questionId: dto.questionId,
        },
      },
      create: {
        attemptId: attempt.id,
        questionId: dto.questionId,
        selectedOption: dto.selectedOption || null,
        answerText: dto.answerText || null,
        isMarkedForReview: dto.isMarkedForReview || false,
      },
      update: {
        selectedOption: dto.selectedOption !== undefined ? dto.selectedOption : undefined,
        answerText: dto.answerText !== undefined ? dto.answerText : undefined,
        isMarkedForReview:
          dto.isMarkedForReview !== undefined ? dto.isMarkedForReview : undefined,
        savedAt: new Date(),
      },
    });
  }

  async submitExam(studentId: string, dto: SubmitExamDto) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: {
        examId_studentId: {
          examId: dto.examId,
          studentId,
        },
      },
      include: {
        answers: true,
        exam: {
          include: {
            questionPaper: {
              include: {
                questions: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException(`Attempt not found.`);
    }

    if (attempt.status === 'SUBMITTED' || attempt.status === 'AUTO_SUBMITTED') {
      return this.prisma.examResult.findUnique({
        where: {
          examId_studentId: {
            examId: dto.examId,
            studentId,
          },
        },
      });
    }

    // Finalize attempt
    const finalStatus = dto.isAutoSubmit ? 'AUTO_SUBMITTED' : 'SUBMITTED';
    await this.prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        status: finalStatus,
        submittedAt: new Date(),
        timeRemainingSeconds: 0,
      },
    });

    // Objective Evaluation Engine
    const questions = attempt.exam.questionPaper.questions;
    let correctCount = 0;
    let wrongCount = 0;
    let attemptedCount = 0;
    let obtainedMarks = 0;

    for (const q of questions) {
      const studentAnswer = attempt.answers.find((a) => a.questionId === q.id);
      if (studentAnswer && studentAnswer.selectedOption) {
        attemptedCount++;
        const isCorrect =
          studentAnswer.selectedOption.trim().toUpperCase() ===
          q.correctAnswer.trim().toUpperCase();

        if (isCorrect) {
          correctCount++;
          obtainedMarks += q.marks;
        } else {
          wrongCount++;
          obtainedMarks -= q.negativeMarks || 0;
        }

        // Save evaluation on answer record
        await this.prisma.examAnswer.update({
          where: { id: studentAnswer.id },
          data: {
            isEvaluated: true,
            isCorrect,
            marksObtained: isCorrect ? q.marks : -(q.negativeMarks || 0),
          },
        });
      }
    }

    // Round obtained marks to 2 decimal places, minimum 0
    obtainedMarks = Math.max(0, Math.round(obtainedMarks * 100) / 100);
    const totalQuestions = questions.length;
    const unansweredCount = totalQuestions - attemptedCount;
    const totalMarks = attempt.exam.totalMarks || 100;
    const percentage = Math.round((obtainedMarks / totalMarks) * 10000) / 100;
    const isPassed = obtainedMarks >= attempt.exam.passingMarks;

    // Determine grade
    let grade = 'F';
    if (percentage >= 90) grade = 'A+';
    else if (percentage >= 80) grade = 'A';
    else if (percentage >= 70) grade = 'B';
    else if (percentage >= 60) grade = 'C';
    else if (percentage >= 50) grade = 'D';

    const result = await this.prisma.examResult.upsert({
      where: {
        examId_studentId: {
          examId: dto.examId,
          studentId,
        },
      },
      create: {
        examId: dto.examId,
        attemptId: attempt.id,
        studentId,
        sessionId: attempt.sessionId,
        totalQuestions,
        attemptedCount,
        correctCount,
        wrongCount,
        unansweredCount,
        totalMarks,
        obtainedMarks,
        percentage,
        grade,
        isPassed,
        status: attempt.exam.resultVisibility === 'IMMEDIATE' ? 'PUBLISHED' : 'EVALUATED',
        publishedAt: attempt.exam.resultVisibility === 'IMMEDIATE' ? new Date() : null,
      },
      update: {
        attemptedCount,
        correctCount,
        wrongCount,
        unansweredCount,
        obtainedMarks,
        percentage,
        grade,
        isPassed,
      },
    });

    // When attempt is finalized, reset the physical workstation to AVAILABLE for the next candidate
    if (attempt.pcHostname) {
      await this.prisma.cbtPcRegistration.updateMany({
        where: { pcHostname: attempt.pcHostname },
        data: {
          status: 'AVAILABLE',
          isDobVerified: false,
          assignedStudentId: null,
          assignedStudentName: null,
          assignedStudentRegNo: null,
        },
      });

      await this.prisma.pc.updateMany({
        where: { hostname: attempt.pcHostname },
        data: {
          cbtStatus: 'AVAILABLE',
          assignedStudentId: null,
          currentStudentId: null,
        },
      });

      const socketServer = this.realtimeService.getServer();
      if (socketServer) {
        socketServer.emit('cbt:pc-list-updated', {
          pcHostname: attempt.pcHostname,
          status: 'AVAILABLE',
        });
      }
    }

    return result;
  }

  async getStudentResult(studentId: string, examId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new NotFoundException(`Exam not found.`);

    const result = await this.prisma.examResult.findUnique({
      where: {
        examId_studentId: {
          examId,
          studentId,
        },
      },
    });

    if (!result) {
      throw new NotFoundException(`No result recorded for this student.`);
    }

    if (!exam.resultPublished && exam.resultVisibility !== 'IMMEDIATE') {
      return {
        isPublished: false,
        message:
          'Examination results are currently under instructor review and will be published once finalized.',
      };
    }

    return {
      isPublished: true,
      result,
      examTitle: exam.title,
      subject: exam.subject,
    };
  }

  async resolveStudentId(params: {
    studentId?: string;
    pcHostname?: string;
    cbtCode?: string;
    examId?: string;
  }): Promise<string> {
    if (params.studentId && params.studentId.trim()) {
      return params.studentId.trim();
    }
    const host = (params.pcHostname || '').trim().toUpperCase();
    const code = (params.cbtCode || '').trim().toUpperCase();

    if (host && code) {
      const reg = await this.prisma.cbtPcRegistration.findFirst({
        where: { pcHostname: host, cbtCode: code },
        orderBy: { registeredAt: 'desc' },
      });
      if (reg?.assignedStudentId) {
        return reg.assignedStudentId;
      }
    }

    if (host) {
      const reg = await this.prisma.cbtPcRegistration.findFirst({
        where: { pcHostname: host },
        orderBy: { registeredAt: 'desc' },
      });
      if (reg?.assignedStudentId) {
        return reg.assignedStudentId;
      }
      const pc = await this.prisma.pc.findUnique({ where: { hostname: host } });
      if (pc?.assignedStudentId) {
        return pc.assignedStudentId;
      }
    }

    if (code) {
      const reg = await this.prisma.cbtPcRegistration.findFirst({
        where: { cbtCode: code },
        orderBy: { registeredAt: 'desc' },
      });
      if (reg?.assignedStudentId) {
        return reg.assignedStudentId;
      }
    }

    // Fallback: If there is an attempt for the given exam on this PC hostname
    if (host && params.examId) {
      const attempt = await this.prisma.examAttempt.findFirst({
        where: { examId: params.examId, pcHostname: host },
        orderBy: { startedAt: 'desc' },
      });
      if (attempt?.studentId) {
        return attempt.studentId;
      }
    }

    throw new NotFoundException('Could not identify allocated student candidate for this workstation session.');
  }

  async saveStudentCbtAnswer(dto: StudentSaveAnswerDto) {
    const studentId = await this.resolveStudentId({
      studentId: dto.studentId,
      pcHostname: dto.pcHostname,
      cbtCode: dto.cbtCode,
      examId: dto.examId,
    });
    return this.saveAnswer(studentId, dto);
  }

  async submitStudentCbtExam(dto: StudentSubmitExamDto) {
    const studentId = await this.resolveStudentId({
      studentId: dto.studentId,
      pcHostname: dto.pcHostname,
      cbtCode: dto.cbtCode,
      examId: dto.examId,
    });
    return this.submitExam(studentId, dto);
  }

  async getStudentCbtResult(examId: string, params: { studentId?: string; pcHostname?: string; cbtCode?: string }) {
    const studentId = await this.resolveStudentId({
      studentId: params.studentId,
      pcHostname: params.pcHostname,
      cbtCode: params.cbtCode,
      examId,
    });
    return this.getStudentResult(studentId, examId);
  }

  async concludeStudentCbtExam(params: { pcHostname?: string; studentId?: string; cbtCode?: string }) {
    const pcHostname = (params.pcHostname || '').trim().toUpperCase();
    if (pcHostname) {
      await this.prisma.cbtPcRegistration.updateMany({
        where: { pcHostname },
        data: {
          status: 'AVAILABLE',
          isDobVerified: false,
          assignedStudentId: null,
          assignedStudentName: null,
          assignedStudentRegNo: null,
        },
      });

      await this.prisma.pc.updateMany({
        where: { hostname: pcHostname },
        data: {
          cbtStatus: 'AVAILABLE',
          assignedStudentId: null,
          currentStudentId: null,
        },
      });

      const socketServer = this.realtimeService.getServer();
      if (socketServer) {
        socketServer.emit('cbt:pc-list-updated', {
          pcHostname,
          status: 'AVAILABLE',
        });
      }
    }

    return {
      success: true,
      message: 'Workstation released and reset to AVAILABLE for the next candidate.',
      pcHostname,
      cbtStatus: 'AVAILABLE',
    };
  }

  /*
   * ==========================================================
   * 7. MANUAL RESULT CORRECTION & AUDIT LOGGING (ADMIN)
   * ==========================================================
   */

  async correctResult(resultId: string, adminId: string, dto: CorrectResultDto) {
    const result = await this.prisma.examResult.findUnique({
      where: { id: resultId },
      include: {
        exam: true,
        student: { select: { id: true, name: true, username: true, regNumber: true } },
      },
    });

    if (!result) {
      throw new NotFoundException(`Exam result record not found.`);
    }

    const previousMarks = result.obtainedMarks;
    const newMarks = Math.max(0, Math.min(result.totalMarks, Number(dto.obtainedMarks)));
    const percentage = Math.round((newMarks / result.totalMarks) * 10000) / 100;
    const isPassed = newMarks >= result.exam.passingMarks;

    let newGrade = 'F';
    if (percentage >= 90) newGrade = 'A+';
    else if (percentage >= 80) newGrade = 'A';
    else if (percentage >= 70) newGrade = 'B';
    else if (percentage >= 60) newGrade = 'C';
    else if (percentage >= 50) newGrade = 'D';

    // Record Audit Log
    const audit = await this.prisma.resultCorrectionAudit.create({
      data: {
        examResultId: result.id,
        examId: result.examId,
        studentId: result.studentId,
        adminId,
        previousMarks,
        newMarks,
        previousGrade: result.grade,
        newGrade,
        reason: dto.reason?.trim() || 'Admin manual score adjustment',
      },
    });

    // Update Result
    const updatedResult = await this.prisma.examResult.update({
      where: { id: resultId },
      data: {
        obtainedMarks: newMarks,
        percentage,
        grade: newGrade,
        isPassed,
        status: 'CORRECTED',
      },
      include: {
        student: {
          select: { id: true, name: true, username: true, regNumber: true, rollNumber: true },
        },
        corrections: {
          orderBy: { correctedAt: 'desc' },
        },
      },
    });

    return {
      success: true,
      message: `Score updated from ${previousMarks} to ${newMarks} for student ${result.student.name || result.student.username}.`,
      result: updatedResult,
      audit,
    };
  }

  async getCorrectionAudit(examId: string) {
    return this.prisma.resultCorrectionAudit.findMany({
      where: { examId },
      include: {
        examResult: {
          include: {
            student: { select: { id: true, name: true, username: true, regNumber: true } },
          },
        },
      },
      orderBy: { correctedAt: 'desc' },
    });
  }

  /*
   * ==========================================================
   * 8. RESULT GENERATION (WHOLE CLASS vs SELECTED CANDIDATES)
   * ==========================================================
   */

  async generateResults(examId: string, dto: GenerateResultsDto) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        session: { select: { id: true, sessionCode: true, classTitle: true } },
      },
    });

    if (!exam) throw new NotFoundException(`Exam not found.`);

    const effectiveScope = (dto.scope || dto.type || 'ALL').toUpperCase();
    let whereClause: any = { examId };

    if (effectiveScope === 'SELECTED' && dto.studentIds?.length) {
      whereClause.studentId = { in: dto.studentIds };
    }

    const rawResults = await this.prisma.examResult.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            username: true,
            regNumber: true,
            rollNumber: true,
            classId: true,
          },
        },
        corrections: {
          orderBy: { correctedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ student: { rollNumber: 'asc' } }, { student: { regNumber: 'asc' } }, { percentage: 'desc' }],
    });

    // Generate continuous serial numbers (1, 2, 3...)
    const candidates = rawResults.map((r, index) => ({
      serialNumber: index + 1,
      id: r.id,
      studentId: r.student.id,
      studentName: r.student.name || r.student.username,
      regNumber: r.student.regNumber || r.student.rollNumber || r.student.username,
      registrationNumber: r.student.regNumber || r.student.rollNumber || r.student.username,
      rollNumber: r.student.rollNumber || '-',
      totalMarks: r.totalMarks,
      attended: r.attemptedCount > 0,
      attemptedCount: r.attemptedCount,
      totalQuestions: r.totalQuestions,
      obtainedMarks: r.obtainedMarks,
      correctCount: r.correctCount,
      totalCorrect: r.correctCount,
      wrongCount: r.wrongCount,
      totalWrong: r.wrongCount,
      unansweredCount: r.unansweredCount,
      totalUnanswered: r.unansweredCount,
      percentage: r.percentage,
      grade: r.grade || (r.isPassed ? 'A' : 'F'),
      isPassed: r.isPassed,
      status: r.isPassed ? 'PASSED' : 'FAILED',
      hasManualCorrection: r.corrections.length > 0,
      evaluatedAt: r.evaluatedAt,
      submittedAt: r.evaluatedAt ? r.evaluatedAt.toLocaleString() : '—',
      publishedAt: r.publishedAt,
    }));

    const totalCandidates = candidates.length;
    const passedCount = candidates.filter((c) => c.isPassed).length;
    const failedCount = totalCandidates - passedCount;
    const totalScoreSum = candidates.reduce((acc, c) => acc + c.obtainedMarks, 0);
    const averageScore = totalCandidates > 0 ? Math.round((totalScoreSum / totalCandidates) * 100) / 100 : 0;
    const passPercentage =
      totalCandidates > 0 ? Math.round((passedCount / totalCandidates) * 10000) / 100 : 0;

    return {
      exam: {
        id: exam.id,
        cbtCode: exam.cbtCode,
        title: exam.title,
        subject: exam.subject,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
        durationMinutes: exam.durationMinutes,
        resultPublished: exam.resultPublished,
        sessionTitle: exam.session?.classTitle || 'General Session',
      },
      examTitle: exam.title,
      subject: exam.subject,
      scope: effectiveScope,
      generatedAt: new Date(),
      totalCandidates,
      count: totalCandidates,
      passedCount,
      failedCount,
      averageScore,
      passPercentage,
      candidates,
      results: candidates,
      stats: {
        totalCandidates,
        passedCount,
        failedCount,
        avgMarks: averageScore,
        passRate: passPercentage,
      },
    };
  }

  async getResults(examId?: string, sessionId?: string) {
    return this.prisma.examResult.findMany({
      where: {
        examId: examId || undefined,
        sessionId: sessionId || undefined,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            username: true,
            regNumber: true,
            rollNumber: true,
            classId: true,
          },
        },
        exam: {
          select: {
            id: true,
            cbtCode: true,
            title: true,
            subject: true,
            totalMarks: true,
            passingMarks: true,
            resultPublished: true,
          },
        },
        corrections: {
          orderBy: { correctedAt: 'desc' },
        },
      },
      orderBy: { percentage: 'desc' },
    });
  }

  async publishResults(examId: string, publish: boolean = true) {
    const exam = await this.getExam(examId);

    await this.prisma.exam.update({
      where: { id: examId },
      data: { resultPublished: publish },
    });

    await this.prisma.examResult.updateMany({
      where: { examId },
      data: {
        status: publish ? 'PUBLISHED' : 'EVALUATED',
        publishedAt: publish ? new Date() : null,
      },
    });

    const socketServer = this.realtimeService.getServer();
    if (socketServer) {
      socketServer.emit('cbt:results-published', {
        examId,
        cbtCode: exam.cbtCode,
        resultPublished: publish,
      });
    }

    return { success: true, examId, resultPublished: publish };
  }

  async getExamStats(examId: string) {
    const results = await this.prisma.examResult.findMany({
      where: { examId },
    });

    if (!results.length) {
      return {
        totalSubmissions: 0,
        averagePercentage: 0,
        highestScore: 0,
        lowestScore: 0,
        passCount: 0,
        failCount: 0,
        passPercentage: 0,
      };
    }

    const totalSubmissions = results.length;
    const totalMarksArray = results.map((r) => r.obtainedMarks);
    const passCount = results.filter((r) => r.isPassed).length;
    const failCount = totalSubmissions - passCount;
    const avgPercentage =
      results.reduce((acc, r) => acc + r.percentage, 0) / totalSubmissions;

    return {
      totalSubmissions,
      averagePercentage: Math.round(avgPercentage * 100) / 100,
      highestScore: Math.max(...totalMarksArray),
      lowestScore: Math.min(...totalMarksArray),
      passCount,
      failCount,
      passPercentage: Math.round((passCount / totalSubmissions) * 10000) / 100,
    };
  }

  /*
   * ==========================================================
   * 7. OFFLINE CBT PRE-EXAM SYNCHRONIZATION
   * ==========================================================
   */

  async syncOfflinePackage(studentId: string, examIdOrCode: string, pcHostname: string) {
    const trimmedTarget = (examIdOrCode || '').trim();
    if (!trimmedTarget) {
      throw new BadRequestException('Exam ID or CBT Code is required for offline synchronization');
    }

    const exam = await this.prisma.exam.findFirst({
      where: {
        OR: [{ id: trimmedTarget }, { cbtCode: trimmedTarget.toUpperCase() }],
      },
      include: {
        questionPaper: {
          include: {
            questions: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
        session: {
          include: {
            allowedWebsites: true,
            blockedWebsites: true,
            allowedApplications: true,
            blockedApplications: true,
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException('Exam not found for offline synchronization');
    }

    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, username: true, regNumber: true, rollNumber: true },
    });

    if (!student) {
      throw new NotFoundException('Student account not found');
    }

    const durationMinutes = exam.durationMinutes || exam.session?.durationMinutes || 60;
    const synchronizedAt = new Date().toISOString();
    const validUntil = new Date(Date.now() + (durationMinutes + 45) * 60 * 1000).toISOString();

    const sanitizedQuestions = (exam.questionPaper?.questions || []).map((q) => {
      let parsedOptions: any[] = [];
      try {
        parsedOptions = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
      } catch {
        parsedOptions = [];
      }

      return {
        id: q.id,
        text: q.questionText,
        type: q.questionType,
        options: parsedOptions,
        marks: q.marks,
        orderIndex: q.orderIndex,
      };
    });

    const offlinePayload = {
      syncVersion: '1.0.0',
      synchronizedAt,
      validUntil,
      pcHostname: pcHostname || 'UNKNOWN-PC',
      student: {
        id: student.id,
        name: student.name || student.username,
        username: student.username,
        regNumber: student.regNumber || student.rollNumber || student.username,
      },
      exam: {
        id: exam.id,
        title: exam.title,
        cbtCode: exam.cbtCode,
        durationMinutes,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
        instructions: exam.instructions || exam.session?.instructions,
        questionPaperTitle: exam.questionPaper?.title,
        questions: sanitizedQuestions,
      },
      policy: {
        allowInternet: exam.session?.allowInternet ?? false,
        allowClipboard: exam.session?.allowClipboard ?? false,
        allowUsb: exam.session?.allowUsb ?? false,
        allowTaskManager: exam.session?.allowTaskManager ?? false,
        allowAltTab: exam.session?.allowAltTab ?? false,
        allowWindowsKey: exam.session?.allowWindowsKey ?? false,
        allowPrintScreen: exam.session?.allowPrintScreen ?? false,
        freezeOnEnd: exam.session?.freezeOnEnd ?? true,
        allowedWebsites: (exam.session?.allowedWebsites || []).map((w) => w.domain),
        blockedWebsites: (exam.session?.blockedWebsites || []).map((w) => w.domain),
        allowedApplications: (exam.session?.allowedApplications || []).map((a) => a.processName),
        blockedApplications: (exam.session?.blockedApplications || []).map((a) => a.processName),
        restrictExistingFiles: exam.session?.restrictExistingFiles ?? true,
        restrictUnauthorizedApps: exam.session?.restrictUnauthorizedApps ?? true,
      },
    };

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: student.id,
          action: 'OFFLINE_CBT_SYNC',
          targetPc: pcHostname || 'UNKNOWN-PC',
          metadata: JSON.stringify({
            examId: exam.id,
            cbtCode: exam.cbtCode,
            synchronizedAt,
            validUntil,
          }),
        },
      });
    } catch {
      // Non-blocking audit log
    }

    return offlinePayload;
  }
}
