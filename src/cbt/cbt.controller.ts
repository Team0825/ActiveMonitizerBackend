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
  AuthorityLoginDto,
  AuthorityPasswordDto,
  CorrectResultDto,
  CreateExamDto,
  CreateQuestionDto,
  CreateQuestionPaperDto,
  GenerateResultsDto,
  LockPcConfigDto,
  RegisterPcDto,
  SaveAnswerDto,
  StartExamDto,
  SubmitExamDto,
  UpdateExamDto,
  UpdateQuestionPaperDto,
  ValidateUniqueCodeDto,
  VerifyAuthorityPasswordDto,
} from './dto/cbt.dto';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('cbt')
@UseGuards(RolesGuard)
export class CbtController {
  constructor(private readonly cbtService: CbtService) {}

  /*
   * ==========================================================
   * 1. AUTHORITY AUTHENTICATION & REGISTRATION
   * ==========================================================
   */

  @Post('authority-login')
  authorityLogin(@Body() dto: AuthorityLoginDto) {
    return this.cbtService.authorityLogin(dto);
  }

  @Post('validate-unique-code')
  validateUniqueCode(@Body() dto: ValidateUniqueCodeDto) {
    return this.cbtService.validateUniqueCodeAndRegister(dto);
  }

  @Get('authority-password/status')
  @Roles('ADMIN')
  getAuthorityPasswordStatus() {
    return this.cbtService.getAuthorityPasswordStatus();
  }

  @Post('authority-password')
  @Roles('ADMIN')
  setAuthorityPassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AuthorityPasswordDto,
  ) {
    return this.cbtService.setAuthorityPassword(dto.password, req.user.sub);
  }

  @Post('authority-password/verify')
  verifyAuthorityPassword(@Body() dto: VerifyAuthorityPasswordDto) {
    return this.cbtService.verifyAuthorityPassword(dto.password);
  }

  @Post('recovery-audit')
  recordRecoveryAudit(@Body() dto: { pcHostname: string; sessionId?: string; examId?: string; reason?: string }) {
    return this.cbtService.recordRecoveryAudit(dto);
  }

  @Post('admin-reauth')
  @Roles('ADMIN', 'TEACHER')
  adminReauth(
    @Req() req: AuthenticatedRequest,
    @Body() dto: { password: string },
  ) {
    return this.cbtService.verifyAdminCredentials(req.user.sub, dto.password);
  }

  @Post('code/generate-one-time')
  @Roles('ADMIN', 'TEACHER')
  generateOneTimeCode(@Req() req: AuthenticatedRequest) {
    return this.cbtService.generateOneTimeCbtCode(req.user.sub);
  }

  @Get('pc-status')
  getPcStatus(@Query('pcHostname') pcHostname: string) {
    return this.cbtService.checkCbtPcStatus(pcHostname || '');
  }

  @Post('code/generate')
  @Roles('ADMIN', 'TEACHER')
  async generateCode() {
    const cbtCode = await this.cbtService.generateUniqueCbtCode();
    return { cbtCode };
  }

  @Post('register-pc')
  registerPc(@Body() dto: RegisterPcDto) {
    return this.cbtService.registerPcForCbt(dto);
  }

  @Post('deregister-pc')
  deregisterPc(@Body() dto: { pcHostname: string; cbtCode?: string; examId?: string }) {
    const target = dto.examId || dto.cbtCode || '';
    return this.cbtService.deleteRegisteredPc(target, dto.pcHostname);
  }

  @Get('pcs')
  @Roles('ADMIN', 'TEACHER')
  listRegisteredPcs(@Query('cbtCode') cbtCode?: string, @Query('examId') examId?: string) {
    const target = examId || cbtCode || '';
    return this.cbtService.listRegisteredPcs(target);
  }

  @Delete('pcs/:pcHostname')
  @Roles('ADMIN', 'TEACHER')
  deleteRegisteredPc(
    @Param('pcHostname') pcHostname: string,
    @Query('cbtCode') cbtCode?: string,
    @Query('examId') examId?: string,
  ) {
    const target = examId || cbtCode || '';
    return this.cbtService.deleteRegisteredPc(target, pcHostname);
  }

  @Post('exams/:id/lock-pcs')
  @Roles('ADMIN', 'TEACHER')
  lockPcConfig(
    @Param('id') id: string,
    @Body() dto: LockPcConfigDto,
  ) {
    return this.cbtService.savePcConfig(id, dto.isLocked);
  }

  /*
   * ==========================================================
   * 3. QUESTION PAPERS (ADMIN / TEACHER)
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

  @Patch('question-papers/:paperId/questions/:questionId')
  @Roles('ADMIN', 'TEACHER')
  updateQuestion(
    @Param('paperId') paperId: string,
    @Param('questionId') questionId: string,
    @Body() dto: Partial<CreateQuestionDto>,
  ) {
    return this.cbtService.updateQuestion(paperId, questionId, dto);
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
   * 4. EXAMS (ADMIN / TEACHER)
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

  @Get('exams/:id/corrections')
  @Roles('ADMIN', 'TEACHER')
  getCorrectionAudit(@Param('id') id: string) {
    return this.cbtService.getCorrectionAudit(id);
  }

  /*
   * ==========================================================
   * 5. STUDENT EXAM ATTEMPTS & RESULTS (STUDENT)
   * ==========================================================
   */

  @Get('student/active')
  getStudentActiveExam(
    @Req() req: AuthenticatedRequest,
    @Query('session') sessionCodeOrId?: string,
    @Query('pcHostname') pcHostname?: string,
  ) {
    return this.cbtService.getStudentActiveExam(req.user.sub, sessionCodeOrId, pcHostname);
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

  /*
   * ==========================================================
   * 6. RESULTS, MANUAL CORRECTIONS & GENERATION (ADMIN / TEACHER)
   * ==========================================================
   */

  @Get('results')
  @Roles('ADMIN', 'TEACHER')
  getResults(
    @Query('examId') examId?: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.cbtService.getResults(examId, sessionId);
  }

  @Post('results/:id/correct')
  @Roles('ADMIN')
  correctResult(
    @Req() req: AuthenticatedRequest,
    @Param('id') resultId: string,
    @Body() dto: CorrectResultDto,
  ) {
    return this.cbtService.correctResult(resultId, req.user.sub, dto);
  }

  @Post('exams/:id/generate-results')
  @Roles('ADMIN', 'TEACHER')
  generateResults(
    @Param('id') examId: string,
    @Body() dto: GenerateResultsDto,
  ) {
    return this.cbtService.generateResults(examId, dto);
  }
}
