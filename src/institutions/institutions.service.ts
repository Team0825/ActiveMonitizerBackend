import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInstitutionDto, UpdateInstitutionDto } from './dto/institution.dto';

@Injectable()
export class InstitutionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(user: any) {
    if (user?.isSuperAdmin || user?.role === 'SUPER_ADMIN') {
      return this.prisma.institution.findMany({
        include: {
          _count: {
            select: {
              users: true,
              departments: true,
              licenses: true,
              sessions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user?.institutionId) {
      return this.prisma.institution.findMany({
        where: { id: user.institutionId },
        include: {
          _count: {
            select: {
              users: true,
              departments: true,
              licenses: true,
              sessions: true,
            },
          },
        },
      });
    }

    return this.prisma.institution.findMany({
      where: { isActive: true },
      take: 1,
    });
  }

  async getById(id: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      include: {
        departments: true,
        licenses: true,
      },
    });

    if (!institution) {
      throw new NotFoundException('Institution not found.');
    }
    return institution;
  }

  async create(dto: CreateInstitutionDto, user: any) {
    if (!user?.isSuperAdmin && user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Admin can create institutions.');
    }

    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.institution.findUnique({
      where: { code },
    });

    if (existing) {
      throw new ConflictException(`Institution code "${code}" is already in use.`);
    }

    return this.prisma.institution.create({
      data: {
        name: dto.name.trim(),
        code,
        board: dto.board?.trim() || null,
        location: dto.location?.trim() || null,
        logoUrl: dto.logoUrl?.trim() || null,
        isActive: true,
      },
    });
  }

  async update(id: string, dto: UpdateInstitutionDto, user: any) {
    if (!user?.isSuperAdmin && user?.role !== 'SUPER_ADMIN' && user?.institutionId !== id) {
      throw new ForbiddenException('You do not have permission to update this institution.');
    }

    const institution = await this.prisma.institution.findUnique({ where: { id } });
    if (!institution) throw new NotFoundException('Institution not found.');

    if (dto.code && dto.code.trim().toUpperCase() !== institution.code) {
      const code = dto.code.trim().toUpperCase();
      const existing = await this.prisma.institution.findUnique({ where: { code } });
      if (existing) {
        throw new ConflictException(`Institution code "${code}" is already in use.`);
      }
    }

    return this.prisma.institution.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        code: dto.code ? dto.code.trim().toUpperCase() : undefined,
        board: dto.board !== undefined ? dto.board.trim() : undefined,
        location: dto.location !== undefined ? dto.location.trim() : undefined,
        logoUrl: dto.logoUrl !== undefined ? dto.logoUrl.trim() : undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
      },
    });
  }

  async delete(id: string, user: any) {
    if (!user?.isSuperAdmin && user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Admin can delete institutions.');
    }

    return this.prisma.institution.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getBranding(user?: any) {
    let institution = null;
    if (user?.institutionId) {
      institution = await this.prisma.institution.findUnique({
        where: { id: user.institutionId },
      });
    }

    if (!institution) {
      institution = await this.prisma.institution.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    const appTheme = await this.prisma.appTheme.findFirst({
      where: { targetInterface: 'GLOBAL', isActive: true },
    }).catch(() => null);

    return {
      institutionId: institution?.id || '',
      name: institution?.name || (appTheme as any)?.institutionName || 'National Institute of Science & Technology',
      code: institution?.code || 'NIST-MAIN',
      board: institution?.board || (appTheme as any)?.institutionBoard || 'Central Board of Secondary & Higher Education',
      location: institution?.location || (appTheme as any)?.institutionLocation || 'Main Campus, Academic Complex',
      logoUrl: institution?.logoUrl || (appTheme as any)?.logoUrl || '',
      showInstituteBranding: (appTheme as any)?.showInstituteBranding !== undefined ? (appTheme as any).showInstituteBranding : true,
      showPdfHeader: (appTheme as any)?.showPdfHeader !== undefined ? (appTheme as any).showPdfHeader : true,
    };
  }

  async updateBranding(dto: any, user: any) {
    if (!user?.isSuperAdmin && user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Administrator can modify Institute Identity & Branding.');
    }

    let institution = null;
    if (dto.institutionId) {
      institution = await this.prisma.institution.findUnique({ where: { id: dto.institutionId } });
    }
    if (!institution && user?.institutionId) {
      institution = await this.prisma.institution.findUnique({ where: { id: user.institutionId } });
    }
    if (!institution) {
      institution = await this.prisma.institution.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (institution) {
      institution = await this.prisma.institution.update({
        where: { id: institution.id },
        data: {
          name: dto.name ? dto.name.trim() : undefined,
          board: dto.board !== undefined ? dto.board.trim() : undefined,
          location: dto.location !== undefined ? dto.location.trim() : undefined,
          logoUrl: dto.logoUrl !== undefined ? dto.logoUrl.trim() : undefined,
        },
      });
    }

    // Synchronize to GLOBAL AppTheme and legacy AgentTheme for instant multi-client propagation
    try {
      const globalTheme = await this.prisma.appTheme.findFirst({
        where: { targetInterface: 'GLOBAL' },
      });
      const themePayload: any = {
        institutionName: dto.name || institution?.name,
        institutionBoard: dto.board !== undefined ? dto.board : institution?.board,
        institutionLocation: dto.location !== undefined ? dto.location : institution?.location,
        logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : institution?.logoUrl,
      };

      if (globalTheme) {
        await this.prisma.appTheme.update({
          where: { id: globalTheme.id },
          data: themePayload,
        });
      }

      const agentTheme = await this.prisma.agentTheme.findFirst({
        where: { isActive: true },
      });
      if (agentTheme && dto.logoUrl !== undefined) {
        await this.prisma.agentTheme.update({
          where: { id: agentTheme.id },
          data: { organizationLogoUrl: dto.logoUrl },
        });
      }
    } catch {}

    return {
      success: true,
      message: 'Institute Branding successfully saved and persisted.',
      branding: {
        institutionId: institution?.id || '',
        name: institution?.name || dto.name,
        board: institution?.board || dto.board,
        location: institution?.location || dto.location,
        logoUrl: institution?.logoUrl || dto.logoUrl,
        showInstituteBranding: dto.showInstituteBranding !== undefined ? dto.showInstituteBranding : true,
        showPdfHeader: dto.showPdfHeader !== undefined ? dto.showPdfHeader : true,
      },
    };
  }
}
