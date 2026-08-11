import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SessionRealtimeService } from '../realtime/session-realtime.service';
import {
  CorrectResultDto,
  CreateExamDto,
  CreateQuestionDto,
  CreateQuestionPaperDto,
  GenerateResultsDto,
  RegisterPcDto,
  SaveAnswerDto,
  StartExamDto,
  SubmitExamDto,
  UpdateExamDto,
  UpdateQuestionPaperDto,
} from './dto/cbt.dto';

@Injectable()
export class CbtService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: SessionRealtimeService,
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

  async verifyAuthorityPassword(password: string): Promise<{ valid: boolean }> {
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

  /*
   * ==========================================================
   * 2. PC REGISTRATION & REAL-TIME STATUS FOR CBT
   * ==========================================================
   */

  async registerPcForCbt(dto: RegisterPcDto) {
    const cbtCode = dto.cbtCode.trim().toUpperCase();

    // Verify authority password if provided
    if (dto.authorityPassword) {
      const auth = await this.verifyAuthorityPassword(dto.authorityPassword);
      if (!auth.valid) {
        throw new ForbiddenException('Invalid Authority Password. CBT PC registration rejected.');
      }
    }

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

    const pcHostname = dto.pcHostname.trim().toUpperCase();

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
          currentSessionId: session?.id || exam?.sessionId || null,
        },
      });
    } else {
      await this.prisma.pc.update({
        where: { hostname: pcHostname },
        data: {
          status: 'ONLINE',
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
        updatedAt: new Date(),
      },
    });

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

  async listRegisteredPcs(cbtCodeOrExamId: string) {
    let exam = await this.prisma.exam.findFirst({
      where: {
        OR: [{ id: cbtCodeOrExamId }, { cbtCode: cbtCodeOrExamId.toUpperCase() }],
      },
    });

    const cbtCode = exam?.cbtCode || cbtCodeOrExamId.toUpperCase();

    const registrations = await this.prisma.cbtPcRegistration.findMany({
      where: {
        OR: [{ cbtCode }, { examId: exam?.id || undefined }],
      },
      orderBy: { registeredAt: 'asc' },
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
        lastSeen: true,
      },
    });

    const pcMap = new Map(pcs.map((p) => [p.hostname.toUpperCase(), p]));

    const result = registrations.map((reg, index) => {
      const pcInfo = pcMap.get(reg.pcHostname.toUpperCase());
      const isLiveOnline = pcInfo?.status === 'ONLINE';
      return {
        serialNumber: index + 1,
        id: reg.id,
        cbtCode: reg.cbtCode,
        pcHostname: reg.pcHostname,
        displayName: pcInfo?.displayName || reg.pcHostname,
        labName: pcInfo?.labName || 'Main Lab',
        status: reg.status,
        isOnline: isLiveOnline,
        healthStatus: pcInfo?.healthStatus || 'HEALTHY',
        internetStatus: pcInfo?.internetStatus || 'ONLINE',
        lastSeen: pcInfo?.lastSeen || null,
        registeredAt: reg.registeredAt,
      };
    });

    const onlineCount = result.filter((p) => p.isOnline).length;
    const offlineCount = result.length - onlineCount;

    return {
      cbtCode,
      examId: exam?.id || null,
      isPcConfigLocked: exam?.isPcConfigLocked || false,
      totalRegistered: result.length,
      onlineCount,
      offlineCount,
      pcs: result,
    };
  }

  async deleteRegisteredPc(examIdOrCode: string, pcHostname: string) {
    const upperHost = pcHostname.trim().toUpperCase();
    const upperCode = examIdOrCode.trim().toUpperCase();

    await this.prisma.cbtPcRegistration.deleteMany({
      where: {
        pcHostname: upperHost,
        OR: [{ cbtCode: upperCode }, { examId: examIdOrCode }],
      },
    });

    const socketServer = this.realtimeService.getServer();
    if (socketServer) {
      socketServer.emit('cbt:pc-list-updated', { cbtCode: upperCode, examId: examIdOrCode });
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

    let whereClause: any = { examId };

    if (dto.scope === 'SELECTED' && dto.studentIds?.length) {
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
      studentId: r.student.id,
      studentName: r.student.name || r.student.username,
      registrationNumber: r.student.regNumber || r.student.username,
      rollNumber: r.student.rollNumber || '-',
      totalMarks: r.totalMarks,
      attended: r.attemptedCount > 0,
      attemptedCount: r.attemptedCount,
      obtainedMarks: r.obtainedMarks,
      totalCorrect: r.correctCount,
      totalWrong: r.wrongCount,
      totalUnanswered: r.unansweredCount,
      percentage: r.percentage,
      grade: r.grade,
      isPassed: r.isPassed,
      status: r.status,
      hasManualCorrection: r.corrections.length > 0,
      evaluatedAt: r.evaluatedAt,
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
      scope: dto.scope,
      generatedAt: new Date(),
      totalCandidates,
      passedCount,
      failedCount,
      averageScore,
      passPercentage,
      candidates,
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
}
