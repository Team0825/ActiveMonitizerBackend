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
export class AgentThemeController {
  constructor(private readonly agentThemeService: AgentThemeService) {}

  /*
   * ==========================================
   * GET ACTIVE THEME
   * ==========================================
   * GET /agent-theme/active
   * * Accessible by: ALL (Public, ADMIN, TEACHER, STUDENT)
   * Used by the Windows Agent and Admin Settings
   * to load the organization's custom UI.
   */
  @Get('active')
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
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateActiveTheme(@Body() updateData: any) {
    return this.agentThemeService.updateActiveTheme(updateData);
  }
}