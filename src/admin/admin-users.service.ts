import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAdminDto,
  CreateStudentDto,
  CreateTeacherDto,
  UpdateUserDto,
} from './dto/users.dto';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  private async getDefaultInstitutionId(): Promise<string | undefined> {
    const inst = await this.prisma.institution.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return inst?.id;
  }

  /**
   * =========================================================
   * CREATE STUDENT
   * =========================================================
   */
  async createStudent(adminId: string, dto: CreateStudentDto) {
    await this.assertUnique(dto.username, dto.regNumber, dto.email);

    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    const institutionId =
      dto.institutionId || admin?.institutionId || (await this.getDefaultInstitutionId());

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        role: 'STUDENT',
        username: dto.username.trim(),
        name: dto.name?.trim() || null,
        passwordHash,
        regNumber: dto.regNumber.trim(),
        mobile: dto.mobile?.trim() || null,
        email: dto.email?.trim() || null,
        classId: dto.classId?.trim() || null,
        departmentId: dto.departmentId || null,
        institutionId: institutionId || null,
        createdById: adminId,
        isActive: true,
      },
      select: this.safeSelect(),
    });
  }

  /**
   * =========================================================
   * CREATE TEACHER
   * =========================================================
   */
  async createTeacher(adminId: string, dto: CreateTeacherDto) {
    await this.assertUnique(dto.username, undefined, dto.email);

    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    const institutionId =
      dto.institutionId || admin?.institutionId || (await this.getDefaultInstitutionId());

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        role: 'TEACHER',
        name: dto.name?.trim() || null,
        username: dto.username.trim(),
        passwordHash,
        mobile: dto.mobile?.trim() || null,
        email: dto.email?.trim() || null,
        departmentId: dto.departmentId || null,
        institutionId: institutionId || null,
        createdById: adminId,
        isActive: true,
      },
      select: this.safeSelect(),
    });
  }

  /**
   * =========================================================
   * CREATE ADMIN
   * =========================================================
   */
  async createAdmin(adminId: string, dto: CreateAdminDto) {
    const creator = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!creator?.isSuperAdmin && creator?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Admin can create Administrator accounts.');
    }

    await this.assertUnique(dto.username, undefined, dto.email);

    const institutionId =
      dto.institutionId || creator.institutionId || (await this.getDefaultInstitutionId());

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        role: 'ADMIN',
        isSuperAdmin: false,
        name: dto.name?.trim() || null,
        username: dto.username.trim(),
        passwordHash,
        mobile: dto.mobile?.trim() || null,
        email: dto.email?.trim() || null,
        institutionId: institutionId || null,
        createdById: adminId,
        isActive: true,
      },
      select: this.safeSelect(),
    });
  }

  /**
   * =========================================================
   * LIST USERS
   * =========================================================
   */
  async listUsers(
    role?: 'STUDENT' | 'TEACHER' | 'ADMIN',
    classId?: string,
    institutionId?: string,
    departmentId?: string,
  ) {
    return this.prisma.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(classId ? { classId } : {}),
        ...(institutionId ? { institutionId } : {}),
        ...(departmentId ? { departmentId } : {}),
      },
      select: this.safeSelect(),
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * =========================================================
   * UPDATE USER
   * =========================================================
   */
  async updateUser(userId: string, dto: UpdateUserDto, callerId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (callerId) {
      const caller = await this.prisma.user.findUnique({ where: { id: callerId } });

      // Super Admin protection: Normal Admin cannot modify Super Admin
      if (existing.isSuperAdmin && (!caller?.isSuperAdmin && caller?.role !== 'SUPER_ADMIN')) {
        throw new ForbiddenException('Only Super Admin can modify the Super Admin account.');
      }

      // Normal Admin cannot edit another Admin's personal information or credentials
      if (
        existing.role === 'ADMIN' &&
        existing.id !== callerId &&
        (!caller?.isSuperAdmin && caller?.role !== 'SUPER_ADMIN')
      ) {
        throw new ForbiddenException(
          'Administrators cannot modify another Administrator account. Contact Super Admin.',
        );
      }
    }

    if (dto.username && dto.username.trim() !== existing.username) {
      const usernameExists = await this.prisma.user.findUnique({
        where: { username: dto.username.trim() },
      });
      if (usernameExists) throw new ConflictException('Username already in use');
    }

    if (dto.regNumber && dto.regNumber.trim() !== existing.regNumber) {
      const regNumberExists = await this.prisma.user.findUnique({
        where: { regNumber: dto.regNumber.trim() },
      });
      if (regNumberExists) throw new ConflictException('Registration number already in use');
    }

    if (dto.email && dto.email.trim() !== existing.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: dto.email.trim() },
      });
      if (emailExists) throw new ConflictException('Email already in use');
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim() || null;
    if (dto.username !== undefined) data.username = dto.username.trim();
    if (dto.regNumber !== undefined) data.regNumber = dto.regNumber.trim() || null;
    if (dto.mobile !== undefined) data.mobile = dto.mobile.trim() || null;
    if (dto.email !== undefined) data.email = dto.email.trim() || null;
    if (dto.classId !== undefined) data.classId = dto.classId.trim() || null;
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId || null;
    if (dto.institutionId !== undefined) data.institutionId = dto.institutionId || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password && dto.password.trim()) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: this.safeSelect(),
    });
  }

  /**
   * =========================================================
   * DELETE USER
   * =========================================================
   */
  async deleteUser(userId: string, hard = false, callerId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundException('User not found');

    if (existing.isSuperAdmin) {
      throw new ForbiddenException('Super Admin account cannot be deleted or disabled.');
    }

    if (callerId) {
      const caller = await this.prisma.user.findUnique({ where: { id: callerId } });
      if (
        existing.role === 'ADMIN' &&
        existing.id !== callerId &&
        (!caller?.isSuperAdmin && caller?.role !== 'SUPER_ADMIN')
      ) {
        throw new ForbiddenException('Administrators cannot delete other Administrators.');
      }
    }

    if (hard) {
      return this.prisma.user.delete({ where: { id: userId } });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: this.safeSelect(),
    });
  }

  /**
   * =========================================================
   * UNIQUE FIELD VALIDATION
   * =========================================================
   */
  private async assertUnique(username: string, regNumber?: string, email?: string) {
    const normalizedUsername = username.trim();
    const normalizedRegNumber = regNumber?.trim();
    const normalizedEmail = email?.trim();

    const clashes = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: normalizedUsername },
          ...(normalizedRegNumber ? [{ regNumber: normalizedRegNumber }] : []),
          ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ],
      },
    });

    if (clashes) {
      if (clashes.username === normalizedUsername) throw new ConflictException('Username already in use');
      if (normalizedRegNumber && clashes.regNumber === normalizedRegNumber)
        throw new ConflictException('Registration number already in use');
      if (normalizedEmail && clashes.email === normalizedEmail)
        throw new ConflictException('Email already in use');
      throw new ConflictException('User information already in use');
    }
  }

  /**
   * =========================================================
   * SAFE USER RESPONSE
   * =========================================================
   */
  private safeSelect() {
    return {
      id: true,
      role: true,
      isSuperAdmin: true,
      name: true,
      username: true,
      regNumber: true,
      mobile: true,
      email: true,
      classId: true,
      departmentId: true,
      department: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      institutionId: true,
      institution: {
        select: {
          id: true,
          name: true,
          code: true,
          board: true,
          location: true,
        },
      },
      isActive: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
    } as const;
  }
}