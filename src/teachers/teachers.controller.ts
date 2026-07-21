import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

import {
  JwtPayload,
} from '../auth/jwt.strategy';

import {
  Roles,
  RolesGuard,
} from '../auth/roles.guard';

import {
  TeachersService,
} from './teachers.service';

import {
  UpdateTeacherProfileDto,
} from './dto/update-teacher-profile.dto';

/*
 * ============================================================
 * AUTHENTICATED TEACHER REQUEST
 * ============================================================
 */

type AuthenticatedTeacherRequest =
  Request & {
    user: JwtPayload;
  };

/*
 * ============================================================
 * TEACHER PROFILE CONTROLLER
 * ============================================================
 *
 * Base URL:
 *
 * /teachers
 *
 * Available endpoints:
 *
 * GET   /teachers/me
 * PATCH /teachers/me
 *
 * Only authenticated TEACHER users can access these routes.
 * ============================================================
 */

@Controller('teachers')
@UseGuards(
  AuthGuard('jwt'),
  RolesGuard,
)
@Roles('TEACHER')
export class TeachersController {
  constructor(
    private readonly teachersService:
      TeachersService,
  ) {}

  /*
   * ==========================================================
   * GET MY PROFILE
   * ==========================================================
   *
   * GET /teachers/me
   *
   * Returns only the currently logged-in Teacher.
   */

  @Get('me')
  getMyProfile(
    @Req()
    req: AuthenticatedTeacherRequest,
  ) {
    return this.teachersService.getMyProfile(
      req.user.sub,
    );
  }

  /*
   * ==========================================================
   * UPDATE MY PROFILE
   * ==========================================================
   *
   * PATCH /teachers/me
   *
   * Teacher can update only their own permitted profile data.
   *
   * Username should remain non-editable.
   */

  @Patch('me')
  updateMyProfile(
    @Req()
    req: AuthenticatedTeacherRequest,

    @Body()
    dto: UpdateTeacherProfileDto,
  ) {
    return this.teachersService.updateMyProfile(
      req.user.sub,
      dto,
    );
  }
}