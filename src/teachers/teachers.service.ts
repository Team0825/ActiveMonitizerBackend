import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';

import {
  UpdateTeacherProfileDto,
} from './dto/update-teacher-profile.dto';

@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /*
   * ============================================================
   * GET LOGGED-IN TEACHER PROFILE
   * ============================================================
   */

  async getMyProfile(
    teacherId: string,
  ) {
    const teacher =
      await this.prisma.user.findFirst({
        where: {
          id: teacherId,
          role: 'TEACHER',
        },

        select: {
          id: true,
          role: true,
          username: true,
          name: true,
          mobile: true,
          email: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    if (!teacher) {
      throw new NotFoundException(
        'Teacher profile not found',
      );
    }

    return teacher;
  }

  /*
   * ============================================================
   * UPDATE LOGGED-IN TEACHER PROFILE
   * ============================================================
   */

  async updateMyProfile(
    teacherId: string,
    dto: UpdateTeacherProfileDto,
  ) {
    const teacher =
      await this.prisma.user.findFirst({
        where: {
          id: teacherId,
          role: 'TEACHER',
        },
      });

    if (!teacher) {
      throw new NotFoundException(
        'Teacher profile not found',
      );
    }

    /*
     * Check email uniqueness only when
     * teacher is changing the email.
     */

    if (
      dto.email &&
      dto.email !== teacher.email
    ) {
      const emailOwner =
        await this.prisma.user.findUnique({
          where: {
            email: dto.email,
          },
          select: {
            id: true,
          },
        });

      if (
        emailOwner &&
        emailOwner.id !== teacherId
      ) {
        throw new ConflictException(
          'Email address is already in use',
        );
      }
    }

    /*
     * Build update data.
     */

    const updateData: {
      name?: string;
      mobile?: string;
      email?: string;
      passwordHash?: string;
    } = {};

    if (
      dto.name !== undefined
    ) {
      updateData.name =
        dto.name.trim();
    }

    if (
      dto.mobile !== undefined
    ) {
      updateData.mobile =
        dto.mobile.trim();
    }

    if (
      dto.email !== undefined
    ) {
      updateData.email =
        dto.email.trim();
    }

    /*
     * Password is hashed before saving.
     */

    if (
      dto.password
    ) {
      updateData.passwordHash =
        await bcrypt.hash(
          dto.password,
          10,
        );
    }

    /*
     * Update only the logged-in
     * Teacher account.
     */

    return this.prisma.user.update({
      where: {
        id: teacherId,
      },

      data: updateData,

      select: {
        id: true,
        role: true,
        username: true,
        name: true,
        mobile: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}