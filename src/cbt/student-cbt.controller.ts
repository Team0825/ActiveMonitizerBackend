import { Controller, Get, Query } from '@nestjs/common';
import { CbtService } from './cbt.service';

@Controller('student')
export class StudentCbtController {
  constructor(private readonly cbtService: CbtService) {}

  /**
   * ============================================================
   * GET /student/cbt
   *
   * Physical student PC / agent / browser requests CBT status and
   * question paper payload.
   *
   * Query parameters:
   *   cbtCode: CBT session code (e.g. 73ZA-A4NG-DXXB)
   *   pc / pcHostname: Physical PC machine name (e.g. LENOVO-UE016HG8)
   * ============================================================
   */
  @Get('cbt')
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
}
