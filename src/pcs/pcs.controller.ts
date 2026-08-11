import { Controller, Get, Query } from '@nestjs/common';
import { PcsService } from './pcs.service';

@Controller('pcs')
export class PcsController {
  constructor(
    private readonly pcsService: PcsService,
  ) {}

  @Get('health')
  async getHealth() {
    return this.pcsService.getHealth();
  }

  @Get('violations')
  async getViolations(@Query('sessionId') sessionId?: string) {
    return this.pcsService.getViolations(sessionId);
  }
}