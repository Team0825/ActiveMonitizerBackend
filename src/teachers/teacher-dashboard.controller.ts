import {
  Controller,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
} from '@nestjs/passport';

import {
  Request,
} from 'express';

import {
  JwtPayload,
} from '../auth/jwt.strategy';

import {
  Roles,
  RolesGuard,
} from '../auth/roles.guard';

import {
  TeacherDashboardService,
} from './teacher-dashboard.service';

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
 * TEACHER DASHBOARD CONTROLLER
 * ============================================================
 *
 * Base URL:
 *
 * /teacher
 *
 * Endpoints:
 *
 * GET /teacher/overview
 *
 * TEACHER ONLY
 * ============================================================
 */

@Controller('teacher')
@UseGuards(
  AuthGuard('jwt'),
  RolesGuard,
)
@Roles('TEACHER')
export class TeacherDashboardController {
  constructor(
    private readonly dashboardService:
      TeacherDashboardService,
  ) {}

  /*
   * ==========================================================
   * TEACHER DASHBOARD OVERVIEW
   * ==========================================================
   *
   * GET /teacher/overview
   */

  @Get('overview')
  overview(
    @Req()
    req: AuthenticatedTeacherRequest,
  ) {
    return this.dashboardService.overview(
      req.user.sub,
    );
  }
}