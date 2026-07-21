import {
  Body,
  Controller,
  Get,
  Param,
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

import {
  CreateMessageDto,
  MessageFilterDto,
  ReplyMessageDto,
} from './dto/messages.dto';

import { NotificationsService } from './notifications.service';

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
 * NOTIFICATIONS / INTERNAL MESSAGING CONTROLLER
 * ============================================================
 *
 * Base URL:
 *
 * /notifications
 *
 * Accessible by:
 *
 * ADMIN
 * TEACHER
 *
 * Student messaging access will be added later when
 * we build the Student Dashboard and student
 * authentication/session integration.
 * ============================================================
 */

@Controller('notifications')
@UseGuards(RolesGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService:
      NotificationsService,
  ) {}

  /*
   * ==========================================================
   * GET AVAILABLE RECIPIENTS
   * ==========================================================
   *
   * GET /notifications/recipients
   *
   * Used by the Compose Message UI.
   *
   * ADMIN:
   * - Teachers
   * - Students
   *
   * TEACHER:
   * - Admins
   * - Other Teachers
   * - Students
   */
  @Roles('ADMIN', 'TEACHER')

  @Get('recipients')
  getRecipients(
    @Req()
    req: AuthenticatedRequest,
  ) {
    return this.notificationsService.getRecipients(
      req.user,
    );
  }

  /*
   * ==========================================================
   * GET AVAILABLE CLASSES
   * ==========================================================
   *
   * GET /notifications/classes
   *
   * Returns unique classId values
   * from active Student accounts.
   */
  @Roles('ADMIN', 'TEACHER')

  @Get('classes')
  getClasses() {
    return this.notificationsService.getClasses();
  }

  /*
   * ==========================================================
   * GET INBOX
   * ==========================================================
   *
   * GET /notifications/inbox
   *
   * Optional filters:
   *
   * ?messageType=MESSAGE
   * ?messageType=QUESTION
   * ?messageType=PRACTICE
   * ?messageType=VIVA
   * ?messageType=NOTIFICATION
   *
   * ?classId=CSE
   *
   * ?sessionId=<SESSION_UUID>
   */
  @Roles('ADMIN', 'TEACHER')

  @Get('inbox')
  getInbox(
    @Req()
    req: AuthenticatedRequest,

    @Query()
    filter: MessageFilterDto,
  ) {
    return this.notificationsService.getInbox(
      req.user,
      filter,
    );
  }

  /*
   * ==========================================================
   * GET SENT MESSAGES
   * ==========================================================
   *
   * GET /notifications/sent
   */
  @Roles('ADMIN', 'TEACHER')

  @Get('sent')
  getSent(
    @Req()
    req: AuthenticatedRequest,
  ) {
    return this.notificationsService.getSent(
      req.user,
    );
  }

  /*
   * ==========================================================
   * CREATE / SEND MESSAGE
   * ==========================================================
   *
   * POST /notifications
   *
   * Example direct message:
   *
   * {
   *   "recipientType": "USER",
   *   "recipientId": "USER_UUID",
   *   "messageType": "MESSAGE",
   *   "subject": "Meeting",
   *   "body": "Please meet me after class.",
   *   "allowReply": true
   * }
   *
   * Example whole class:
   *
   * {
   *   "recipientType": "CLASS",
   *   "classId": "CSE",
   *   "messageType": "NOTIFICATION",
   *   "subject": "Tomorrow's Class",
   *   "body": "The laboratory starts at 10 AM.",
   *   "allowReply": false
   * }
   *
   * Example Viva:
   *
   * {
   *   "recipientType": "CLASS",
   *   "classId": "CSE",
   *   "messageType": "VIVA",
   *   "subject": "DBMS Viva Questions",
   *   "body": "Explain normalization and primary keys.",
   *   "allowReply": true
   * }
   */
  @Roles('ADMIN', 'TEACHER')

  @Post()
  createMessage(
    @Req()
    req: AuthenticatedRequest,

    @Body()
    dto: CreateMessageDto,
  ) {
    return this.notificationsService.createMessage(
      req.user,
      dto,
    );
  }

  /*
   * ==========================================================
   * REPLY TO MESSAGE
   * ==========================================================
   *
   * POST /notifications/:id/reply
   *
   * Example:
   *
   * {
   *   "body": "Received. Thank you."
   * }
   */

  @Post(':id/reply')
   @Roles('ADMIN', 'TEACHER', 'STUDENT')
   reply(
    @Req()
    req: AuthenticatedRequest,

    @Param('id')
    id: string,

    @Body()
    dto: ReplyMessageDto,
  ) {
    return this.notificationsService.reply(
      req.user,
      id,
      dto,
    );
  }

  /*
   * ==========================================================
   * GET SINGLE MESSAGE
   * ==========================================================
   *
   * GET /notifications/:id
   *
   * IMPORTANT:
   *
   * Keep this dynamic route AFTER routes such as:
   *
   * /recipients
   * /classes
   * /inbox
   * /sent
   *
   * This makes the routing intention clear and prevents
   * static paths from being confused with message IDs.
   */

  @Get(':id')
   @Roles('ADMIN', 'TEACHER', 'STUDENT')
   getMessage(
    @Req()
    req: AuthenticatedRequest,

    @Param('id')
    id: string,
  ) {
    return this.notificationsService.getMessage(
      req.user,
      id,
    );
  }
}