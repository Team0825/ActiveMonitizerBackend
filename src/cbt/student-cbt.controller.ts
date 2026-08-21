import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CbtService } from './cbt.service';
import {
  StudentSaveAnswerDto,
  StudentSubmitExamDto,
  VerifyDobDto,
} from './dto/cbt.dto';

@Controller('student')
export class StudentCbtController {
  constructor(private readonly cbtService: CbtService) {}

  /**
   * ============================================================
   * GET /student/cbt & GET /student/cbt/status
   *
   * Physical student PC / agent / browser requests CBT status and
   * question paper payload.
   * ============================================================
   */
  @Get(['cbt', 'cbt/status'])
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

  /**
   * ============================================================
   * POST /student/answer & POST /student/cbt/answer
   *
   * Saves student answer or updates review status from physical CBT PC.
   * ============================================================
   */
  @Post(['answer', 'cbt/answer'])
  saveAnswer(@Body() dto: StudentSaveAnswerDto) {
    return this.cbtService.saveStudentCbtAnswer(dto);
  }

  /**
   * ============================================================
   * POST /student/submit & POST /student/cbt/submit
   *
   * Finalizes and submits student exam attempt.
   * ============================================================
   */
  @Post(['submit', 'cbt/submit'])
  submitExam(@Body() dto: StudentSubmitExamDto) {
    return this.cbtService.submitStudentCbtExam(dto);
  }

  /**
   * ============================================================
   * GET /student/result/:examId & GET /student/cbt/result/:examId
   *
   * Retrieves exam result for student.
   * ============================================================
   */
  @Get(['result/:examId', 'cbt/result/:examId'])
  getStudentResult(
    @Param('examId') examId: string,
    @Query('studentId') studentId?: string,
    @Query('pc') pc?: string,
    @Query('pcHostname') pcHostname?: string,
    @Query('cbtCode') cbtCode?: string,
  ) {
    return this.cbtService.getStudentCbtResult(examId, {
      studentId,
      pcHostname: pc || pcHostname,
      cbtCode,
    });
  }

  /**
   * ============================================================
   * POST /student/verify-dob & POST /student/cbt/verify-dob
   *
   * Candidate date of birth verification to unlock exam terminal.
   * ============================================================
   */
  @Post(['verify-dob', 'cbt/verify-dob'])
  verifyDob(@Body() dto: VerifyDobDto) {
    return this.cbtService.verifyDob(dto);
  }
}
