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
}
