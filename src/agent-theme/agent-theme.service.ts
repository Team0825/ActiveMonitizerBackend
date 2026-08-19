import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const DEFAULT_THEME_VALUES = {
  themeName: 'Activity Monetizer Default',
  themeMode: 'AUTO',
  palette: 'DEFAULT',
  primaryColor: '#2563EB',
  secondaryColor: '#0F172A',
  accentColor: '#22C55E',
  backgroundColor: '#0F172A',
  cardBackground: '#1E293B',
  textColor: '#FFFFFF',
  mutedTextColor: '#94A3B8',
  buttonColor: '#2563EB',
  buttonTextColor: '#FFFFFF',
  headerColor: '#0F172A',
  sidebarColor: '#0F172A',
  borderColor: '#334155',
  statusSuccess: '#22C55E',
  statusWarning: '#F59E0B',
  statusDanger: '#EF4444',
  statusInfo: '#3B82F6',
  logoUrl: '',
  institutionName: 'National Institute of Science & Technology',
  institutionBoard: 'Central Board of Secondary & Higher Education',
  institutionLocation: 'Main Campus, Academic Complex',
};

@Injectable()
export class AgentThemeService {
  private readonly logger = new Logger(AgentThemeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetches active theme for target interface (Admin, Teacher, Agent, Android, Global)
   */
  async getActiveTheme(targetInterface: string = 'GLOBAL', institutionId?: string) {
    const cleanInterface = (targetInterface || 'GLOBAL').toUpperCase();

    // 1. Try to find interface-specific AppTheme
    let theme = await this.prisma.appTheme.findFirst({
      where: {
        targetInterface: cleanInterface,
        isActive: true,
        ...(institutionId ? { institutionId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });

    // 2. Fallback to GLOBAL AppTheme
    if (!theme && cleanInterface !== 'GLOBAL') {
      theme = await this.prisma.appTheme.findFirst({
        where: {
          targetInterface: 'GLOBAL',
          isActive: true,
        },
        orderBy: { updatedAt: 'desc' },
      });
    }

    // 3. Fallback to legacy AgentTheme
    let legacyAgentTheme = await this.prisma.agentTheme.findFirst({
      where: { isActive: true },
    });

    if (!legacyAgentTheme) {
      legacyAgentTheme = await this.prisma.agentTheme.create({
        data: {
          themeName: 'Default Theme',
          isActive: true,
        },
      });
    }

    // 4. Return unified theme object combining AppTheme + legacy AgentTheme fields
    const base = theme || {
      targetInterface: cleanInterface,
      ...DEFAULT_THEME_VALUES,
    };

    return {
      ...legacyAgentTheme,
      ...base,
      targetInterface: cleanInterface,
      // Ensure compatibility fields for Agent Bubble
      mainBubbleBgColor: (theme as any)?.cardBackground || legacyAgentTheme.mainBubbleBgColor || '#1E293B',
      secondaryPanelColor: (theme as any)?.secondaryColor || legacyAgentTheme.secondaryPanelColor || '#0F172A',
      borderColor: (theme as any)?.borderColor || legacyAgentTheme.borderColor || '#334155',
      accentColor: (theme as any)?.accentColor || legacyAgentTheme.accentColor || '#22C55E',
      textColor: (theme as any)?.textColor || legacyAgentTheme.textColor || '#FFFFFF',
      mutedTextColor: (theme as any)?.mutedTextColor || legacyAgentTheme.mutedTextColor || '#94A3B8',
      buttonColor: (theme as any)?.buttonColor || legacyAgentTheme.buttonColor || '#334155',
      buttonTextColor: (theme as any)?.buttonTextColor || legacyAgentTheme.buttonTextColor || '#FFFFFF',
      organizationLogoUrl: (theme as any)?.logoUrl || legacyAgentTheme.organizationLogoUrl || '',
    };
  }

  /**
   * Updates or saves theme settings for a specific interface
   */
  async updateActiveTheme(data: any) {
    const targetInterface = (data.targetInterface || 'GLOBAL').toUpperCase();

    // 1. Sync legacy AgentTheme if present
    try {
      const currentLegacy = await this.prisma.agentTheme.findFirst({
        where: { isActive: true },
      });

      if (currentLegacy) {
        await this.prisma.agentTheme.update({
          where: { id: currentLegacy.id },
          data: {
            themeName: data.themeName || currentLegacy.themeName,
            mainBubbleBgColor: data.cardBackground || data.mainBubbleBgColor || currentLegacy.mainBubbleBgColor,
            secondaryPanelColor: data.secondaryColor || data.secondaryPanelColor || currentLegacy.secondaryPanelColor,
            borderColor: data.borderColor || currentLegacy.borderColor,
            accentColor: data.accentColor || currentLegacy.accentColor,
            textColor: data.textColor || currentLegacy.textColor,
            mutedTextColor: data.mutedTextColor || currentLegacy.mutedTextColor,
            buttonColor: data.buttonColor || currentLegacy.buttonColor,
            buttonTextColor: data.buttonTextColor || currentLegacy.buttonTextColor,
            organizationLogoUrl: data.logoUrl || data.organizationLogoUrl || currentLegacy.organizationLogoUrl,
          },
        });
      }
    } catch (err) {
      this.logger.error('Failed to sync legacy AgentTheme:', err);
    }

    // 2. Find or create AppTheme record
    let existingAppTheme = await this.prisma.appTheme.findFirst({
      where: {
        targetInterface,
      },
    });

    const payload = {
      targetInterface,
      themeName: data.themeName || `${targetInterface} Custom Theme`,
      themeMode: data.themeMode || 'AUTO',
      palette: data.palette || 'DEFAULT',
      primaryColor: data.primaryColor || '#2563EB',
      secondaryColor: data.secondaryColor || '#0F172A',
      accentColor: data.accentColor || '#22C55E',
      backgroundColor: data.backgroundColor || '#0F172A',
      cardBackground: data.cardBackground || '#1E293B',
      textColor: data.textColor || '#FFFFFF',
      mutedTextColor: data.mutedTextColor || '#94A3B8',
      buttonColor: data.buttonColor || '#2563EB',
      buttonTextColor: data.buttonTextColor || '#FFFFFF',
      headerColor: data.headerColor || '#0F172A',
      sidebarColor: data.sidebarColor || '#0F172A',
      borderColor: data.borderColor || '#334155',
      statusSuccess: data.statusSuccess || '#22C55E',
      statusWarning: data.statusWarning || '#F59E0B',
      statusDanger: data.statusDanger || '#EF4444',
      statusInfo: data.statusInfo || '#3B82F6',
      logoUrl: data.logoUrl !== undefined ? data.logoUrl : null,
      institutionName: data.institutionName || 'National Institute of Science & Technology',
      institutionBoard: data.institutionBoard || 'Central Board of Secondary & Higher Education',
      institutionLocation: data.institutionLocation || 'Main Campus, Academic Complex',
      isActive: true,
    };

    if (existingAppTheme) {
      return this.prisma.appTheme.update({
        where: { id: existingAppTheme.id },
        data: payload,
      });
    }

    return this.prisma.appTheme.create({
      data: payload,
    });
  }

  /**
   * Resets the active theme to default values
   */
  async restoreDefault(targetInterface: string = 'GLOBAL') {
    const cleanInterface = (targetInterface || 'GLOBAL').toUpperCase();

    const existing = await this.prisma.appTheme.findFirst({
      where: { targetInterface: cleanInterface },
    });

    const defaultData = {
      ...DEFAULT_THEME_VALUES,
      targetInterface: cleanInterface,
      themeName: `${cleanInterface} Default Theme`,
      isActive: true,
    };

    if (existing) {
      return this.prisma.appTheme.update({
        where: { id: existing.id },
        data: defaultData,
      });
    }

    return this.prisma.appTheme.create({
      data: defaultData,
    });
  }

  /**
   * List all configured interface themes
   */
  async listAll() {
    return this.prisma.appTheme.findMany({
      orderBy: { targetInterface: 'asc' },
    });
  }
}