import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { Roles, RolesGuard } from '../auth/roles.guard';
import { AgentThemeService } from './agent-theme.service';

@Controller('agent-theme')
@UseGuards(RolesGuard)
export class AgentThemeController {
  constructor(private readonly agentThemeService: AgentThemeService) {}

  /*
   * ==========================================
   * GET ACTIVE THEME
   * ==========================================
   * GET /agent-theme/active
   * * Accessible by: ADMIN, TEACHER, STUDENT
   * Used by the Windows Agent on startup/login
   * to download the organization's custom UI.
   */
  @Get('active')
  @Roles('ADMIN', 'TEACHER', 'STUDENT')
  getActiveTheme() {
    return this.agentThemeService.getActiveTheme();
  }

  /*
   * ==========================================
   * UPDATE ACTIVE THEME
   * ==========================================
   * PATCH /agent-theme/active
   * * Accessible by: ADMIN
   * Used by the Admin Dashboard to save custom
   * colors, labels, and branding.
   */
  @Patch('active')
  @Roles('ADMIN')
  updateActiveTheme(@Body() updateData: any) {
    return this.agentThemeService.updateActiveTheme(updateData);
  }
}