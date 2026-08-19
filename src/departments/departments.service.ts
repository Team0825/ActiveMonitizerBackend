import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listDepartments(user?: any, institutionId?: string) {
    const targetInstitutionId =
      institutionId || user?.institutionId || (await this.getDefaultInstitutionId());

    if (!targetInstitutionId) {
      return this.prisma.department.findMany({
        orderBy: { name: 'asc' },
      });
    }

    return this.prisma.department.findMany({
      where: { institutionId: targetInstitutionId },
      include: {
        _count: {
          select: { students: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: { institution: true },
    });
    if (!dept) throw new NotFoundException('Department not found.');
    return dept;
  }

  async create(dto: CreateDepartmentDto, user: any) {
    const institutionId =
      dto.institutionId || user?.institutionId || (await this.getDefaultInstitutionId());

    if (!institutionId) {
      throw new NotFoundException('No institution assigned or found.');
    }

    const name = dto.name.trim();
    const code = dto.code.trim().toUpperCase();

    const existing = await this.prisma.department.findFirst({
      where: {
        institutionId,
        OR: [{ name }, { code }],
      },
    });

    if (existing) {
      throw new ConflictException(`A department with name "${name}" or code "${code}" already exists in this institution.`);
    }

    return this.prisma.department.create({
      data: {
        name,
        code,
        description: dto.description?.trim() || null,
        institutionId,
        isActive: true,
      },
    });
  }

  async update(id: string, dto: UpdateDepartmentDto, user: any) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found.');

    if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN' && !user?.isSuperAdmin) {
      throw new ForbiddenException('Only Administrators can modify departments.');
    }

    return this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        code: dto.code ? dto.code.trim().toUpperCase() : undefined,
        description: dto.description !== undefined ? dto.description.trim() : undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
      },
    });
  }

  async delete(id: string, user: any) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found.');

    if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN' && !user?.isSuperAdmin) {
      throw new ForbiddenException('Only Administrators can disable departments.');
    }

    return this.prisma.department.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async getDefaultInstitutionId(): Promise<string | undefined> {
    const inst = await this.prisma.institution.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return inst?.id;
  }
}
