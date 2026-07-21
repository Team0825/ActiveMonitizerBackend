import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AgentThemeService {
  constructor(private readonly prisma: PrismaService) {}

  /*
   * ==========================================
   * GET ACTIVE THEME
   * ==========================================
   * Fetches the currently active theme.
   * If no theme exists, it automatically
   * creates the default theme based on
   * Prisma schema defaults.
   */
  async getActiveTheme() {
    let theme = await this.prisma.agentTheme.findFirst({
      where: { isActive: true },
    });

    if (!theme) {
      theme = await this.prisma.agentTheme.create({
        data: {
          themeName: 'Default Theme',
          isActive: true,
        },
      });
    }

    return theme;
  }

  /*
   * ==========================================
   * UPDATE ACTIVE THEME
   * ==========================================
   * Receives a partial object of theme settings
   * from the Admin dashboard and updates the
   * currently active theme in the database.
   */
  async updateActiveTheme(data: any) {
    const currentTheme = await this.getActiveTheme();

    return this.prisma.agentTheme.update({
      where: { id: currentTheme.id },
      data,
    });
  }
}