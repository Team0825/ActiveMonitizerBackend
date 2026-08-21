import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { PcsService } from './pcs.service';

@Controller('pcs')
export class PcsController {
  constructor(
    private readonly pcsService: PcsService,
  ) {}

  @Get()
  async getAllPcs() {
    return this.pcsService.getAllPcs();
  }

  @Post('heartbeat')
  async recordHeartbeat(
    @Body()
    dto: {
      hostname: string;
      labName?: string;
      sessionId?: string;
      studentId?: string;
      agentVersion?: string;
      healthStatus?: string;
    },
  ) {
    return this.pcsService.recordHeartbeat(dto);
  }

  @Get('health')
  async getHealth() {
    return this.pcsService.getHealth();
  }

  @Delete('health/:hostname')
  async deleteHealthRecord(@Param('hostname') hostname: string) {
    return this.pcsService.deleteHealthRecord(hostname);
  }

  @Get('violations')
  async getViolations(@Query('sessionId') sessionId?: string) {
    return this.pcsService.getViolations(sessionId);
  }
}