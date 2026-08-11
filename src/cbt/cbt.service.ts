import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateExamDto,
  CreateQuestionDto,
  CreateQuestionPaperDto,
  SaveAnswerDto,
  StartExamDto,
  SubmitExamDto,
  UpdateExamDto,
  UpdateQuestionPaperDto,
} from './dto/cbt.dto';

@Injectable()
export class CbtService {
  constructor(private readonly prisma: PrismaService) {}

  /*
   * ==========================================================
   * 1. QUESTION PAPERS
   * ==========================================================
   */

  async createQuestionPaper(userId: string, dto: CreateQuestionPaperDto) {
    const totalMarks =
      dto.totalMarks ??
      (dto.questions?.reduce((acc, q) => acc + (q.marks || 1), 0) || 100);

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
                correctAnswer: q.correctAnswer.trim(),
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
   * 2. QUESTIONS MANAGEMENT
   * ==========================================================
   */

  async addQuestion(paperId: string, dto: CreateQuestionDto) {
    await this.getQuestionPaper(paperId);

    const question = await this.prisma.question.create({
      data: {
        questionPaperId: paperId,
        questionText: dto.questionText.trim(),
        questionType: dto.questionType || 'MCQ',
        section: dto.section || 'General',
        orderIndex: Number(dto.orderIndex || 1),
        options: dto.options as any,
        correctAnswer: dto.correctAnswer.trim(),
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

  async deleteQuestion(paperId: string, questionId: string) {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, questionPaperId: paperId },
    });

    if (!question) {
      throw new NotFoundException(`Question not found in paper.`);
    }

    await this.prisma.question.delete({ where: { id: questionId } });

    // Update total marks
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
   * 3. EXAMS MANAGEMENT
   * ==========================================================
   */

  async createExam(userId: string, dto: CreateExamDto) {
    const qp = await this.getQuestionPaper(dto.questionPaperId);

    const totalMarks = dto.totalMarks ?? qp.totalMarks;
    const passingMarks = dto.passingMarks ?? qp.passingMarks;

    return this.prisma.exam.create({
      data: {
        title: dto.title.trim(),
        subject: dto.subject.trim(),
        description: dto.description?.trim() || null,
        instructions: dto.instructions?.trim() || null,
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
          select: { id: true, sessionCode: true, classTitle: true, status: true },
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
          select: { id: true, sessionCode: true, classTitle: true, status: true },
        },
        createdBy: {
          select: { id: true, name: true, username: true },
        },
        _count: {
          select: { attempts: true, results: true },
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
          select: { id: true, sessionCode: true, classTitle: true, status: true },
        },
        createdBy: {
          select: { id: true, name: true, username: true },
        },
        _count: {
          select: { attempts: true, results: true },
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
   * 4. STUDENT EXAM LIFECYCLE
   * ==========================================================
   */

  async getStudentActiveExam(studentId: string, sessionCodeOrId?: string) {
    let sessionWhere = {};
    if (sessionCodeOrId) {
      sessionWhere = {
        OR: [{ id: sessionCodeOrId }, { sessionCode: sessionCodeOrId }],
      };
    }

    // Find active exam for this session or any globally active exam
    const exams = await this.prisma.exam.findMany({
      where: {
        status: { in: ['ACTIVE', 'SCHEDULED'] },
        ...(sessionCodeOrId
          ? {
              session: sessionWhere,
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
        message: 'Examination results are being reviewed and will be published by your instructor.',
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
   * 5. RESULTS & PUBLICATION (ADMIN / TEACHER)
   * ==========================================================
   */

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
            title: true,
            subject: true,
            totalMarks: true,
            passingMarks: true,
            resultPublished: true,
          },
        },
      },
      orderBy: { percentage: 'desc' },
    });
  }

  async publishResults(examId: string, publish: boolean = true) {
    await this.getExam(examId);

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
