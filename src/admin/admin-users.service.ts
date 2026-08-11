import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';

import {
  CreateStudentDto,
  CreateTeacherDto,
  UpdateUserDto,
} from './dto/users.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * =========================================================
   * CREATE STUDENT
   * =========================================================
   *
   * Creates a new STUDENT account.
   *
   * Student fields:
   * - username
   * - password
   * - name (optional)
   * - regNumber
   * - mobile
   * - email
   * - classId
   */
  async createStudent(
    adminId: string,
    dto: CreateStudentDto,
  ) {
    await this.assertUnique(
      dto.username,
      dto.regNumber,
      dto.email,
    );

    const passwordHash =
      await bcrypt.hash(
        dto.password,
        10,
      );

    return this.prisma.user.create({
      data: {
        role: 'STUDENT',

        username:
          dto.username.trim(),

        passwordHash,

        regNumber:
          dto.regNumber.trim(),

        mobile:
          dto.mobile?.trim() ||
          null,

        email:
          dto.email?.trim() ||
          null,

        classId:
          dto.classId?.trim() ||
          null,

        createdById:
          adminId,

        isActive:
          true,
      },

      select:
        this.safeSelect(),
    });
  }

  /**
   * =========================================================
   * CREATE TEACHER
   * =========================================================
   *
   * Creates a new TEACHER account.
   */
  async createTeacher(
    adminId: string,
    dto: CreateTeacherDto,
  ) {
    await this.assertUnique(
      dto.username,
      undefined,
      dto.email,
    );

    const passwordHash =
      await bcrypt.hash(
        dto.password,
        10,
      );

    return this.prisma.user.create({
      data: {
        role: 'TEACHER',

        name:
          dto.name?.trim() ||
          null,

        username:
          dto.username.trim(),

        passwordHash,

        mobile:
          dto.mobile?.trim() ||
          null,

        email:
          dto.email?.trim() ||
          null,

        createdById:
          adminId,

        isActive:
          true,
      },

      select:
        this.safeSelect(),
    });
  }

  /**
   * =========================================================
   * CREATE ADMIN
   * =========================================================
   */
  async createAdmin(
    adminId: string,
    dto: { name?: string; username: string; password: string; mobile?: string; email?: string },
  ) {
    await this.assertUnique(
      dto.username,
      undefined,
      dto.email,
    );

    const passwordHash =
      await bcrypt.hash(
        dto.password,
        10,
      );

    return this.prisma.user.create({
      data: {
        role: 'ADMIN',
        name: dto.name?.trim() || null,
        username: dto.username.trim(),
        passwordHash,
        mobile: dto.mobile?.trim() || null,
        email: dto.email?.trim() || null,
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
   *
   * Examples:
   *
   * GET /admin/users
   *
   * GET /admin/users?role=STUDENT
   *
   * GET /admin/users?role=TEACHER
   *
   * GET /admin/users?role=ADMIN
   */
  async listUsers(
    role?:
      | 'STUDENT'
      | 'TEACHER'
      | 'ADMIN',
    classId?: string,
  ) {
    return this.prisma.user.findMany({
      where: {
        ...(role
          ? { role }
          : {}),

        ...(classId
          ? { classId }
          : {}),
      },

      select:
        this.safeSelect(),

      orderBy: {
        createdAt:
          'desc',
      },
    });
  }

  /**
   * =========================================================
   * UPDATE USER
   * =========================================================
   *
   * Used for both Student and Teacher accounts.
   *
   * Only supplied fields are updated.
   */
  async updateUser(
    userId: string,
    dto: UpdateUserDto,
  ) {
    const existing =
      await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'User not found',
      );
    }

    /**
     * Check username uniqueness
     * if username is being changed.
     */
    if (
      dto.username &&
      dto.username.trim() !==
        existing.username
    ) {
      const usernameExists =
        await this.prisma.user.findUnique({
          where: {
            username:
              dto.username.trim(),
          },
        });

      if (usernameExists) {
        throw new ConflictException(
          'Username already in use',
        );
      }
    }

    /**
     * Check registration number uniqueness
     * if registration number is being changed.
     */
    if (
      dto.regNumber &&
      dto.regNumber.trim() !==
        existing.regNumber
    ) {
      const regNumberExists =
        await this.prisma.user.findUnique({
          where: {
            regNumber:
              dto.regNumber.trim(),
          },
        });

      if (regNumberExists) {
        throw new ConflictException(
          'Registration number already in use',
        );
      }
    }

    /**
     * Check email uniqueness
     * if email is being changed.
     */
    if (
      dto.email &&
      dto.email.trim() !==
        existing.email
    ) {
      const emailExists =
        await this.prisma.user.findUnique({
          where: {
            email:
              dto.email.trim(),
          },
        });

      if (emailExists) {
        throw new ConflictException(
          'Email already in use',
        );
      }
    }

    /**
     * Build update object dynamically.
     *
     * This prevents undefined fields
     * from accidentally changing data.
     */
    const data: {
      name?: string | null;
      username?: string;
      regNumber?: string | null;
      mobile?: string | null;
      email?: string | null;
      classId?: string | null;
      isActive?: boolean;
      passwordHash?: string;
    } = {};

    if (
      dto.name !==
      undefined
    ) {
      data.name =
        dto.name.trim() ||
        null;
    }

    if (
      dto.username !==
      undefined
    ) {
      data.username =
        dto.username.trim();
    }

    if (
      dto.regNumber !==
      undefined
    ) {
      data.regNumber =
        dto.regNumber.trim() ||
        null;
    }

    if (
      dto.mobile !==
      undefined
    ) {
      data.mobile =
        dto.mobile.trim() ||
        null;
    }

    if (
      dto.email !==
      undefined
    ) {
      data.email =
        dto.email.trim() ||
        null;
    }

    if (
      dto.classId !==
      undefined
    ) {
      data.classId =
        dto.classId.trim() ||
        null;
    }

    if (
      dto.isActive !==
      undefined
    ) {
      data.isActive =
        dto.isActive;
    }

    /**
     * Only hash and update password
     * when a new password is provided.
     */
    if (
      dto.password &&
      dto.password.trim()
    ) {
      data.passwordHash =
        await bcrypt.hash(
          dto.password,
          10,
        );
    }

    return this.prisma.user.update({
      where: {
        id:
          userId,
      },

      data,

      select:
        this.safeSelect(),
    });
  }

  /**
   * =========================================================
   * DELETE USER
   * =========================================================
   *
   * Default:
   * Soft delete.
   *
   * The account becomes inactive but historical
   * attendance/session records remain available.
   *
   * hard=true:
   * Permanently deletes the database record.
   */
  async deleteUser(
    userId: string,
    hard = false,
  ) {
    const existing =
      await this.prisma.user.findUnique({
        where: {
          id:
            userId,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'User not found',
      );
    }

    /**
     * Hard delete.
     *
     * Note:
     * This can fail if the user has related
     * session/attendance records.
     */
    if (hard) {
      return this.prisma.user.delete({
        where: {
          id:
            userId,
        },
      });
    }

    /**
     * Soft delete.
     */
    return this.prisma.user.update({
      where: {
        id:
          userId,
      },

      data: {
        isActive:
          false,
      },

      select:
        this.safeSelect(),
    });
  }

  /**
   * =========================================================
   * UNIQUE FIELD VALIDATION
   * =========================================================
   */
  private async assertUnique(
    username: string,
    regNumber?: string,
    email?: string,
  ) {
    const normalizedUsername =
      username.trim();

    const normalizedRegNumber =
      regNumber?.trim();

    const normalizedEmail =
      email?.trim();

    const clashes =
      await this.prisma.user.findFirst({
        where: {
          OR: [
            {
              username:
                normalizedUsername,
            },

            ...(normalizedRegNumber
              ? [
                  {
                    regNumber:
                      normalizedRegNumber,
                  },
                ]
              : []),

            ...(normalizedEmail
              ? [
                  {
                    email:
                      normalizedEmail,
                  },
                ]
              : []),
          ],
        },
      });

    if (clashes) {
      if (
        clashes.username ===
        normalizedUsername
      ) {
        throw new ConflictException(
          'Username already in use',
        );
      }

      if (
        normalizedRegNumber &&
        clashes.regNumber ===
          normalizedRegNumber
      ) {
        throw new ConflictException(
          'Registration number already in use',
        );
      }

      if (
        normalizedEmail &&
        clashes.email ===
          normalizedEmail
      ) {
        throw new ConflictException(
          'Email already in use',
        );
      }

      throw new ConflictException(
        'User information already in use',
      );
    }
  }

  /**
   * =========================================================
   * SAFE USER RESPONSE
   * =========================================================
   *
   * IMPORTANT:
   * passwordHash must NEVER be returned
   * to the frontend.
   */
  private safeSelect() {
    return {
      id:
        true,

      role:
        true,

      name:
        true,

      username:
        true,

      regNumber:
        true,

      mobile:
        true,

      email:
        true,

      classId:
        true,

      isActive:
        true,

      createdAt:
        true,

      updatedAt:
        true,
    } as const;
  }
}