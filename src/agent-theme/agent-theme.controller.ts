import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AgentThemeService } from './agent-theme.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';

@Controller('agent-theme')
export class AgentThemeController {
  constructor(private readonly agentThemeService: AgentThemeService) {}

  /**
   * Public: Get active theme for interface (ADMIN, TEACHER, AGENT, ANDROID, GLOBAL)
   */
  @Get('active')
  getActiveTheme(
    @Query('targetInterface') targetInterface?: string,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.agentThemeService.getActiveTheme(targetInterface || 'GLOBAL', institutionId);
  }

  /**
   * Protected (Staff): List all configured interface themes
   */
  @UseGuards(JwtAuthGuard)
  @Get('all')
  listAll() {
    return this.agentThemeService.listAll();
  }

  /**
   * Protected (Admin/Staff): Update active theme for interface
   */
  @UseGuards(JwtAuthGuard)
  @Patch('active')
  updateActiveTheme(@Body() updateData: any) {
    return this.agentThemeService.updateActiveTheme(updateData);
  }

  /**
   * Protected (Admin/Staff): Restore default theme
   */
  @UseGuards(JwtAuthGuard)
  @Post('reset')
  restoreDefault(@Body() body: { targetInterface?: string }) {
    return this.agentThemeService.restoreDefault(body?.targetInterface || 'GLOBAL');
  }
}