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
import { JwtAuthGuard, JwtPayload } from '../auth/jwt.strategy';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CbtService } from './cbt.service';
import {
  AllocateStudentDto,
  AutoAllocateStudentDto,
  AuthorityLoginDto,
  AuthorityPasswordDto,
  CorrectResultDto,
  CreateExamDto,
  CreateQuestionDto,
  CreateQuestionPaperDto,
  DeallocateStudentDto,
  EmergencyTerminationToggleDto,
  GenerateResultsDto,
  LockPcConfigDto,
  RegisterPcDto,
  SaveAnswerDto,
  StartExamDto,
  SubmitExamDto,
  TerminatePcDto,
  UpdateExamDto,
  UpdateQuestionPaperDto,
  ValidateUniqueCodeDto,
  VerifyAuthorityPasswordDto,
  VerifyDobDto,
} from './dto/cbt.dto';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('cbt')
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

  @Post(['validate-unique-code', 'validate-unique-code-and-register'])
  validateUniqueCode(@Body() dto: ValidateUniqueCodeDto) {
    return this.cbtService.validateUniqueCodeAndRegister(dto);
  }

  @UseGuards(RolesGuard)
  @Get('authority-password/status')
  @Roles('ADMIN')
  getAuthorityPasswordStatus() {
    return this.cbtService.getAuthorityPasswordStatus();
  }

  @UseGuards(RolesGuard)
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

  @UseGuards(RolesGuard)
  @Post('admin-reauth')
  @Roles('ADMIN', 'TEACHER')
  adminReauth(
    @Req() req: AuthenticatedRequest,
    @Body() dto: { password: string },
  ) {
    return this.cbtService.verifyAdminCredentials(req.user.sub, dto.password);
  }

  @UseGuards(RolesGuard)
  @Post('code/generate-one-time')
  @Roles('ADMIN', 'TEACHER')
  generateOneTimeCode(@Req() req: AuthenticatedRequest) {
    return this.cbtService.generateOneTimeCbtCode(req.user.sub);
  }

  @Get('pc-status')
  getPcStatus(@Query('pcHostname') pcHostname: string) {
    return this.cbtService.checkCbtPcStatus(pcHostname || '');
  }

  @UseGuards(RolesGuard)
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

  @UseGuards(RolesGuard)
  @Get('pcs')
  @Roles('ADMIN', 'TEACHER')
  listRegisteredPcs(@Query('cbtCode') cbtCode?: string, @Query('examId') examId?: string) {
    const target = examId || cbtCode || '';
    return this.cbtService.listRegisteredPcs(target);
  }

  @UseGuards(RolesGuard)
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

  @UseGuards(RolesGuard)
  @Post(['allocate-student', 'pc/allocate', 'pcs/allocate', 'allocate'])
  @Roles('ADMIN', 'TEACHER')
  allocateStudent(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AllocateStudentDto,
  ) {
    return this.cbtService.allocateStudent(req.user.sub, dto);
  }

  @UseGuards(RolesGuard)
  @Post('auto-allocate')
  @Roles('ADMIN', 'TEACHER')
  autoAllocateStudent(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AutoAllocateStudentDto,
  ) {
    return this.cbtService.autoAllocateStudent(req.user.sub, dto);
  }

  @UseGuards(RolesGuard)
  @Post(['deallocate-student', 'pc/deallocate', 'pcs/deallocate', 'deallocate'])
  @Roles('ADMIN', 'TEACHER')
  deallocateStudent(
    @Req() req: AuthenticatedRequest,
    @Body() dto: DeallocateStudentDto,
  ) {
    return this.cbtService.deallocateStudent(req.user.sub, dto);
  }

  @Post('verify-dob')
  verifyDob(@Body() dto: VerifyDobDto) {
    return this.cbtService.verifyDob(dto);
  }

  @Get('student/cbt')
  getStudentCbt(
    @Query('cbtCode') cbtCode?: string,
    @Query('session') session?: string,
    @Query('pc') pc?: string,
    @Query('pcHostname') pcHostname?: string,
  ) {
    return this.cbtService.getStudentCbtExamination({
      cbtCode: cbtCode || session || '',
      pcHostname: pc || pcHostname || '',
    });
  }

  @Get('pc-allocation')
  getPcAllocation(
    @Query('pcHostname') pcHostname?: string,
    @Query('pc') pc?: string,
    @Query('cbtCode') cbtCode?: string,
    @Query('session') session?: string,
  ) {
    return this.cbtService.getPcAllocation(pcHostname || pc, cbtCode || session);
  }

  @Post('terminate-pc')
  terminatePc(@Body() dto: TerminatePcDto) {
    return this.cbtService.terminatePc(dto);
  }

  @UseGuards(RolesGuard)
  @Post('emergency-termination/toggle')
  @Roles('ADMIN', 'SUPER_ADMIN')
  toggleEmergencyTermination(
    @Req() req: AuthenticatedRequest,
    @Body() dto: EmergencyTerminationToggleDto,
  ) {
    return this.cbtService.toggleEmergencyTermination(req.user.sub, dto);
  }

  @Get('emergency-termination/status')
  getEmergencyTerminationStatus() {
    return this.cbtService.getEmergencyTerminationStatus();
  }

  @UseGuards(RolesGuard)
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

  @UseGuards(RolesGuard)
  @Post('question-papers')
  @Roles('ADMIN', 'TEACHER')
  createQuestionPaper(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateQuestionPaperDto,
  ) {
    return this.cbtService.createQuestionPaper(req.user.sub, dto);
  }

  @UseGuards(RolesGuard)
  @Get('question-papers')
  @Roles('ADMIN', 'TEACHER')
  listQuestionPapers(@Query('subject') subject?: string) {
    return this.cbtService.listQuestionPapers(subject);
  }

  @UseGuards(RolesGuard)
  @Get('question-papers/:id')
  @Roles('ADMIN', 'TEACHER')
  getQuestionPaper(@Param('id') id: string) {
    return this.cbtService.getQuestionPaper(id);
  }

  @UseGuards(RolesGuard)
  @Patch('question-papers/:id')
  @Roles('ADMIN', 'TEACHER')
  updateQuestionPaper(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionPaperDto,
  ) {
    return this.cbtService.updateQuestionPaper(id, dto);
  }

  @UseGuards(RolesGuard)
  @Delete('question-papers/:id')
  @Roles('ADMIN', 'TEACHER')
  deleteQuestionPaper(@Param('id') id: string) {
    return this.cbtService.deleteQuestionPaper(id);
  }

  @UseGuards(RolesGuard)
  @Post('question-papers/:id/questions')
  @Roles('ADMIN', 'TEACHER')
  addQuestion(
    @Param('id') paperId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.cbtService.addQuestion(paperId, dto);
  }

  @UseGuards(RolesGuard)
  @Patch('question-papers/:paperId/questions/:questionId')
  @Roles('ADMIN', 'TEACHER')
  updateQuestion(
    @Param('paperId') paperId: string,
    @Param('questionId') questionId: string,
    @Body() dto: Partial<CreateQuestionDto>,
  ) {
    return this.cbtService.updateQuestion(paperId, questionId, dto);
  }

  @UseGuards(RolesGuard)
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

  @UseGuards(RolesGuard)
  @Post('exams')
  @Roles('ADMIN', 'TEACHER')
  createExam(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateExamDto,
  ) {
    return this.cbtService.createExam(req.user.sub, dto);
  }

  @UseGuards(RolesGuard)
  @Get('exams')
  @Roles('ADMIN', 'TEACHER')
  listExams(
    @Query('sessionId') sessionId?: string,
    @Query('status') status?: string,
  ) {
    return this.cbtService.listExams(sessionId, status);
  }

  @UseGuards(RolesGuard)
  @Get('exams/:id')
  @Roles('ADMIN', 'TEACHER')
  getExam(@Param('id') id: string) {
    return this.cbtService.getExam(id);
  }

  @UseGuards(RolesGuard)
  @Patch('exams/:id')
  @Roles('ADMIN', 'TEACHER')
  updateExam(
    @Param('id') id: string,
    @Body() dto: UpdateExamDto,
  ) {
    return this.cbtService.updateExam(id, dto);
  }

  @UseGuards(RolesGuard)
  @Delete('exams/:id')
  @Roles('ADMIN', 'TEACHER')
  deleteExam(@Param('id') id: string) {
    return this.cbtService.deleteExam(id);
  }

  @UseGuards(RolesGuard)
  @Patch('exams/:id/publish-results')
  @Roles('ADMIN', 'TEACHER')
  publishResults(
    @Param('id') id: string,
    @Body('publish') publish: boolean = true,
  ) {
    return this.cbtService.publishResults(id, publish);
  }

  @UseGuards(RolesGuard)
  @Get('exams/:id/stats')
  @Roles('ADMIN', 'TEACHER')
  getExamStats(@Param('id') id: string) {
    return this.cbtService.getExamStats(id);
  }

  @UseGuards(RolesGuard)
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

  @UseGuards(JwtAuthGuard)
  @Get('student/active')
  getStudentActiveExam(
    @Req() req: AuthenticatedRequest,
    @Query('session') sessionCodeOrId?: string,
    @Query('pcHostname') pcHostname?: string,
  ) {
    return this.cbtService.getStudentActiveExam(req.user.sub, sessionCodeOrId, pcHostname);
  }

  @UseGuards(JwtAuthGuard)
  @Post('student/start')
  startExam(
    @Req() req: AuthenticatedRequest,
    @Body() dto: StartExamDto,
  ) {
    return this.cbtService.startExam(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('student/answer')
  saveAnswer(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.cbtService.saveAnswer(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('student/submit')
  submitExam(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SubmitExamDto,
  ) {
    return this.cbtService.submitExam(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('student/result/:examId')
  getStudentResult(
    @Req() req: AuthenticatedRequest,
    @Param('examId') examId: string,
  ) {
    return this.cbtService.getStudentResult(req.user.sub, examId);
  }

  @Post('student/conclude')
  concludeExam(
    @Body() dto: { pcHostname?: string; studentId?: string; cbtCode?: string },
  ) {
    return this.cbtService.concludeStudentCbtExam(dto);
  }

  /*
   * ==========================================================
   * 6. RESULTS, MANUAL CORRECTIONS & GENERATION (ADMIN / TEACHER)
   * ==========================================================
   */

  @UseGuards(RolesGuard)
  @Get('results')
  @Roles('ADMIN', 'TEACHER')
  getResults(
    @Query('examId') examId?: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.cbtService.getResults(examId, sessionId);
  }

  @UseGuards(RolesGuard)
  @Post('results/:id/correct')
  @Roles('ADMIN')
  correctResult(
    @Req() req: AuthenticatedRequest,
    @Param('id') resultId: string,
    @Body() dto: CorrectResultDto,
  ) {
    return this.cbtService.correctResult(resultId, req.user.sub, dto);
  }

  @UseGuards(RolesGuard)
  @Post('exams/:id/generate-results')
  @Roles('ADMIN', 'TEACHER')
  generateResults(
    @Param('id') examId: string,
    @Body() dto: GenerateResultsDto,
  ) {
    return this.cbtService.generateResults(examId, dto);
  }

  @UseGuards(RolesGuard)
  @Post('offline-sync')
  @Roles('STUDENT', 'ADMIN', 'TEACHER')
  offlineSync(
    @Req() req: AuthenticatedRequest,
    @Body() dto: { examId: string; pcHostname?: string },
  ) {
    return this.cbtService.syncOfflinePackage(
      req.user.sub,
      dto.examId,
      dto.pcHostname || '',
    );
  }
}
