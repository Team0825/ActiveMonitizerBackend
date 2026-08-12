import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
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

import { SessionsService } from './sessions.service';

import {
  CreateSessionDto,
  HandleAccessRequestDto,
  JoinSessionDto,
  RequestSpecialAccessDto,
} from './dto/session.dto';

import { UpdateSessionPolicyDto } from './dto/session-policy.dto';

/*
 * ============================================================
 * REQUEST TYPES
 * ============================================================
 */

type AuthenticatedRequest =
  Request & {
    user: JwtPayload;
  };

type TeacherAdminRequest =
  Request & {
    user: JwtPayload & {
      role:
        | 'TEACHER'
        | 'ADMIN';
    };
  };

/*
 * ============================================================
 * PUBLIC STUDENT SESSION CONTROLLER
 * ============================================================
 *
 * Students do NOT need username/password.
 *
 * Student enters:
 *
 * Registration Number
 * +
 * 8-character Session Code
 *
 * Example:
 *
 * {
 *   "regNumber": "REG001",
 *   "sessionId": "K7M2X9PQ",
 *   "pcHostname": "LAB-PC-01"
 * }
 *
 * No existing Student JWT is required.
 */

@Controller('sessions/student')
export class StudentSessionController {
  constructor(
    private readonly sessionsService:
      SessionsService,
  ) {}

  /*
   * ==========================================================
   * PUBLIC STUDENT LOGIN
   * ==========================================================
   *
   * POST:
   *
   * /sessions/student/login
   */

  @Post('login')
  studentLogin(
    @Body()
    dto: JoinSessionDto,
  ) {
    return this.sessionsService
      .studentLogin(dto);
  }
}

/*
 * ============================================================
 * PROTECTED SESSION CONTROLLER
 * ============================================================
 */

@Controller('sessions')
@UseGuards(RolesGuard)
export class SessionsController {
  constructor(
    private readonly sessionsService:
      SessionsService,
  ) {}

  /*
   * ==========================================================
   * GET SESSIONS
   * ==========================================================
   *
   * GET:
   *
   * /sessions
   *
   * ADMIN:
   * Returns all Sessions.
   *
   * TEACHER:
   * Returns only Sessions created by them.
   */

  @Get()
  @Roles(
    'TEACHER',
    'ADMIN',
  )
  getSessions(
    @Req()
    req: TeacherAdminRequest,
  ) {
    return this.sessionsService
      .getSessions(
        req.user.sub,
        req.user.role,
      );
  }

  /*
   * ==========================================================
   * CREATE SESSION
   * ==========================================================
   *
   * Teacher:
   * Creates own Session.
   *
   * Admin:
   * Can also create Session.
   *
   * POST:
   *
   * /sessions
   */

  @Post()
  @Roles(
    'TEACHER',
    'ADMIN',
  )
  create(
    @Req()
    req: TeacherAdminRequest,

    @Body()
    dto: CreateSessionDto,
  ) {
    return this.sessionsService
      .createSession(
        req.user.sub,
        dto,
      );
  }

  /*
   * ==========================================================
   * AUTHENTICATED STUDENT JOIN
   * ==========================================================
   *
   * Kept for:
   *
   * Windows PC Agent
   * or
   * future authenticated Student flow.
   *
   * POST:
   *
   * /sessions/join
   */

  @Post('join')
  @Roles('STUDENT')
  join(
    @Req()
    req: AuthenticatedRequest,

    @Body()
    dto: JoinSessionDto,
  ) {
    return this.sessionsService
      .joinSession(
        req.user.sub,
        dto,
      );
  }

  /*
   * ==========================================================
   * REQUEST SPECIAL ACCESS
   * ==========================================================
   *
   * Used when the normal Session
   * join window has closed.
   *
   * POST:
   *
   * /sessions/request-access
   */

  @Post('request-access')
  @Roles('STUDENT')
  requestAccess(
    @Req()
    req: AuthenticatedRequest,

    @Body()
    dto: RequestSpecialAccessDto,
  ) {
    return this.sessionsService
      .requestSpecialAccess(
        req.user.sub,
        dto,
      );
  }

  /*
   * ==========================================================
   * HANDLE SPECIAL ACCESS REQUEST
   * ==========================================================
   *
   * Teacher:
   * Can approve/reject requests
   * belonging to their own Session.
   *
   * Admin:
   * Can approve/reject requests
   * for any Session.
   *
   * POST:
   *
   * /sessions/handle-access-request
   */

  @Post(
    'handle-access-request',
  )
  @Roles(
    'TEACHER',
    'ADMIN',
  )
  handleAccess(
    @Req()
    req: TeacherAdminRequest,

    @Body()
    dto: HandleAccessRequestDto,
  ) {
    return this.sessionsService
      .handleAccessRequest(
        req.user.sub,
        req.user.role,
        dto,
      );
  }

  @Get('special-access')
  @Roles('TEACHER', 'ADMIN')
  listAccessRequests(
    @Req() req: TeacherAdminRequest,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.sessionsService.listAccessRequests(
      req.user.sub,
      req.user.role,
      sessionId,
    );
  }

  /*
   * ==========================================================
   * VIEW ONLINE SESSION PARTICIPANTS
   * ==========================================================
   *
   * GET:
   *
   * /sessions/:id/participants
   *
   * IMPORTANT:
   *
   * :id should be the internal
   * Session UUID.
   */

  @Get(':id/participants')
  @Roles(
    'TEACHER',
    'ADMIN',
  )
  participants(
    @Param('id')
    id: string,
  ) {
    return this.sessionsService
      .getOnlineParticipants(
        id,
      );
  }

  /*
   * ==========================================================
   * END SESSION
   * ==========================================================
   *
   * Teacher:
   * Can end own Session.
   *
   * Admin:
   * Can end any Session.
   *
   * POST:
   *
   * /sessions/:id/end
   *
   * :id should be the internal
   * Session UUID.
   */

  @Post(':id/end')
  @Roles(
    'TEACHER',
    'ADMIN',
  )
  end(
    @Req()
    req: TeacherAdminRequest,

    @Param('id')
    id: string,
  ) {
    return this.sessionsService
      .endSession(
        req.user.sub,
        req.user.role,
        id,
      );
  }

  /*
   * ==========================================================
   * GET SESSION POLICY
   * ==========================================================
   *
   * GET:
   *
   * /sessions/:id/policy
   *
   * Returns the complete security policy
   * for the session.
   */

  @Get(':id/policy')
  @Roles(
    'TEACHER',
    'ADMIN',
  )
  getSessionPolicy(
    @Param('id')
    id: string,
  ) {
    return this.sessionsService.getSessionPolicy(
      id,
    );
  }

  /*
   * ==========================================================
   * UPDATE SESSION POLICY
   * ==========================================================
   *
   * PUT:
   *
   * /sessions/:id/policy
   *
   * Updates the security policy
   * for the session.
   */

  @Put(':id/policy')
  @Roles(
    'TEACHER',
    'ADMIN',
  )
  updateSessionPolicy(
    @Param('id')
    id: string,

    @Body()
    dto: UpdateSessionPolicyDto,
  ) {
    return this.sessionsService.updateSessionPolicy(
      id,
      dto,
    );
  }

}