import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '../auth/jwt.strategy';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CbtService } from './cbt.service';
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

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('cbt')
@UseGuards(RolesGuard)
export class CbtController {
  constructor(private readonly cbtService: CbtService) {}

  /*
   * ==========================================================
   * 1. QUESTION PAPERS (ADMIN / TEACHER)
   * ==========================================================
   */

  @Post('question-papers')
  @Roles('ADMIN', 'TEACHER')
  createQuestionPaper(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateQuestionPaperDto,
  ) {
    return this.cbtService.createQuestionPaper(req.user.sub, dto);
  }

  @Get('question-papers')
  @Roles('ADMIN', 'TEACHER')
  listQuestionPapers(@Query('subject') subject?: string) {
    return this.cbtService.listQuestionPapers(subject);
  }

  @Get('question-papers/:id')
  @Roles('ADMIN', 'TEACHER')
  getQuestionPaper(@Param('id') id: string) {
    return this.cbtService.getQuestionPaper(id);
  }

  @Patch('question-papers/:id')
  @Roles('ADMIN', 'TEACHER')
  updateQuestionPaper(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionPaperDto,
  ) {
    return this.cbtService.updateQuestionPaper(id, dto);
  }

  @Delete('question-papers/:id')
  @Roles('ADMIN', 'TEACHER')
  deleteQuestionPaper(@Param('id') id: string) {
    return this.cbtService.deleteQuestionPaper(id);
  }

  @Post('question-papers/:id/questions')
  @Roles('ADMIN', 'TEACHER')
  addQuestion(
    @Param('id') paperId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.cbtService.addQuestion(paperId, dto);
  }

  @Delete('question-papers/:paperId/questions/:questionId')
  @Roles('ADMIN', 'TEACHER')
  deleteQuestion(
    @Param('paperId') paperId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.cbtService.deleteQuestion(paperId, questionId);
  }

  /*
   * ==========================================================
   * 2. EXAMS (ADMIN / TEACHER)
   * ==========================================================
   */

  @Post('exams')
  @Roles('ADMIN', 'TEACHER')
  createExam(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateExamDto,
  ) {
    return this.cbtService.createExam(req.user.sub, dto);
  }

  @Get('exams')
  @Roles('ADMIN', 'TEACHER')
  listExams(
    @Query('sessionId') sessionId?: string,
    @Query('status') status?: string,
  ) {
    return this.cbtService.listExams(sessionId, status);
  }

  @Get('exams/:id')
  @Roles('ADMIN', 'TEACHER')
  getExam(@Param('id') id: string) {
    return this.cbtService.getExam(id);
  }

  @Patch('exams/:id')
  @Roles('ADMIN', 'TEACHER')
  updateExam(
    @Param('id') id: string,
    @Body() dto: UpdateExamDto,
  ) {
    return this.cbtService.updateExam(id, dto);
  }

  @Delete('exams/:id')
  @Roles('ADMIN', 'TEACHER')
  deleteExam(@Param('id') id: string) {
    return this.cbtService.deleteExam(id);
  }

  @Patch('exams/:id/publish-results')
  @Roles('ADMIN', 'TEACHER')
  publishResults(
    @Param('id') id: string,
    @Body('publish') publish: boolean = true,
  ) {
    return this.cbtService.publishResults(id, publish);
  }

  @Get('exams/:id/stats')
  @Roles('ADMIN', 'TEACHER')
  getExamStats(@Param('id') id: string) {
    return this.cbtService.getExamStats(id);
  }

  @Get('results')
  @Roles('ADMIN', 'TEACHER')
  getResults(
    @Query('examId') examId?: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.cbtService.getResults(examId, sessionId);
  }

  /*
   * ==========================================================
   * 3. STUDENT EXAM ATTEMPTS & RESULTS (STUDENT)
   * ==========================================================
   */

  @Get('student/active')
  getStudentActiveExam(
    @Req() req: AuthenticatedRequest,
    @Query('session') sessionCodeOrId?: string,
  ) {
    return this.cbtService.getStudentActiveExam(req.user.sub, sessionCodeOrId);
  }

  @Post('student/start')
  startExam(
    @Req() req: AuthenticatedRequest,
    @Body() dto: StartExamDto,
  ) {
    return this.cbtService.startExam(req.user.sub, dto);
  }

  @Post('student/answer')
  saveAnswer(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.cbtService.saveAnswer(req.user.sub, dto);
  }

  @Post('student/submit')
  submitExam(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SubmitExamDto,
  ) {
    return this.cbtService.submitExam(req.user.sub, dto);
  }

  @Get('student/result/:examId')
  getStudentResult(
    @Req() req: AuthenticatedRequest,
    @Param('examId') examId: string,
  ) {
    return this.cbtService.getStudentResult(req.user.sub, examId);
  }
}
