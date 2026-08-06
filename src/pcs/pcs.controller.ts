import { Controller, Get } from '@nestjs/common';
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
}