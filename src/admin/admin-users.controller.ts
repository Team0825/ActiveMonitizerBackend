import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

import { JwtPayload } from '../auth/jwt.strategy';

import {
  Roles,
  RolesGuard,
} from '../auth/roles.guard';

import { AdminUsersService } from './admin-users.service';

import {
  CreateStudentDto,
  CreateTeacherDto,
  UpdateUserDto,
} from './dto/users.dto';

/*
 * ============================================================
 * AUTHENTICATED REQUEST TYPE
 * ============================================================
 */

type AuthenticatedRequest =
  Request & {
    user: JwtPayload;
  };

/*
 * ============================================================
 * ADMIN USER MANAGEMENT
 * ============================================================
 *
 * Base URL:
 *
 * /admin/users
 *
 * IMPORTANT:
 *
 * The controller itself is protected by ADMIN role.
 *
 * Therefore:
 *
 * ADMIN can:
 * - Create Students
 * - Create Teachers
 * - List Students/Teachers
 * - Update Users
 * - Delete/Deactivate Users
 *
 * TEACHERS cannot access these endpoints.
 * ============================================================
 */

@Controller('admin/users')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AdminUsersController {
  constructor(
    private readonly usersService:
      AdminUsersService,
  ) {}

  /*
   * ==========================================================
   * CREATE STUDENT
   * ==========================================================
   *
   * POST /admin/users/students
   *
   * ADMIN ONLY
   */

  @Post('students')
  createStudent(
    @Req()
    req: AuthenticatedRequest,

    @Body()
    dto: CreateStudentDto,
  ) {
    return this.usersService.createStudent(
      req.user.sub,
      dto,
    );
  }

  /*
   * ==========================================================
   * CREATE TEACHER
   * ==========================================================
   *
   * POST /admin/users/teachers
   *
   * ADMIN ONLY
   */

  @Post('teachers')
  createTeacher(
    @Req()
    req: AuthenticatedRequest,

    @Body()
    dto: CreateTeacherDto,
  ) {
    return this.usersService.createTeacher(
      req.user.sub,
      dto,
    );
  }

  /*
   * ==========================================================
   * LIST USERS
   * ==========================================================
   *
   * GET /admin/users
   *
   * Optional:
   *
   * ?role=STUDENT
   * ?role=TEACHER
   * ?classId=CSE
   *
   * Examples:
   *
   * /admin/users?role=STUDENT
   *
   * /admin/users?role=TEACHER
   *
   * /admin/users?role=STUDENT&classId=CSE
   *
   * ADMIN ONLY
   */

  @Get()
  list(
    @Query('role')
    role?:
      | 'STUDENT'
      | 'TEACHER',

    @Query('classId')
    classId?: string,
  ) {
    return this.usersService.listUsers(
      role,
      classId,
    );
  }

  /*
   * ==========================================================
   * UPDATE USER
   * ==========================================================
   *
   * PATCH /admin/users/:id
   *
   * ADMIN ONLY
   */

  @Patch(':id')
  update(
    @Param('id')
    id: string,

    @Body()
    dto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(
      id,
      dto,
    );
  }

  /*
   * ==========================================================
   * DELETE / DEACTIVATE USER
   * ==========================================================
   *
   * DELETE /admin/users/:id
   *
   * Default:
   * Soft delete / deactivate
   *
   * DELETE /admin/users/:id?hard=true
   *
   * Hard delete.
   *
   * ADMIN ONLY
   */

  @Delete(':id')
  remove(
    @Param('id')
    id: string,

    @Query('hard')
    hard?: string,
  ) {
    return this.usersService.deleteUser(
      id,
      hard === 'true',
    );
  }
}

/*
 * ============================================================
 * TEACHER STUDENT DIRECTORY
 * ============================================================
 *
 * Base URL:
 *
 * /teacher/students
 *
 * TEACHER ONLY
 *
 * This is intentionally READ-ONLY.
 *
 * Teachers can:
 *
 * ✓ View students
 * ✓ Search/filter students on frontend
 * ✓ Filter students by class
 *
 * Teachers CANNOT:
 *
 * ✗ Create students
 * ✗ Update students
 * ✗ Delete students
 * ✗ Create teachers
 * ✗ Manage other teachers
 *
 * This keeps Admin and Teacher permissions separated.
 * ============================================================
 */

@Controller('teacher/students')
@UseGuards(RolesGuard)
@Roles('TEACHER')
export class TeacherStudentsController {
  constructor(
    private readonly usersService:
      AdminUsersService,
  ) {}

  /*
   * ==========================================================
   * GET STUDENT DIRECTORY
   * ==========================================================
   *
   * GET /teacher/students
   *
   * Optional:
   *
   * GET /teacher/students?classId=CSE
   *
   * Always returns STUDENT users only.
   */

  @Get()
  listStudents(
    @Query('classId')
    classId?: string,
  ) {
    return this.usersService.listUsers(
      'STUDENT',
      classId,
    );
  }
}