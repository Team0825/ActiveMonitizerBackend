import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  Cron,
  CronExpression,
} from '@nestjs/schedule'
import {
  JwtService,
} from '@nestjs/jwt';

import {
  PrismaService,
} from '../prisma/prisma.service';

import {
  SessionRealtimeService,
} from '../realtime/session-realtime.service';

import {
  CreateSessionDto,
  HandleAccessRequestDto,
  JoinSessionDto,
  RequestSpecialAccessDto,
} from './dto/session.dto';
import { UpdateSessionPolicyDto } from './dto/session-policy.dto';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly jwt:
      JwtService,

    private readonly sessionRealtimeService:
      SessionRealtimeService,
  ) {}

  /*
   * ==========================================
   * SESSION CODE GENERATOR
   * ==========================================
   */

  private generateSessionCode():
    string {
    const characters =
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    let code = '';

    for (
      let i = 0;
      i < 8;
      i++
    ) {
      const randomIndex =
        Math.floor(
          Math.random() *
            characters.length,
        );

      code +=
        characters[
          randomIndex
        ];
    }

    return code;
  }

  /*
   * ==========================================
   * UNIQUE SESSION CODE
   * ==========================================
   */

  private async generateUniqueSessionCode():
    Promise<string> {
    const maxAttempts =
      10;

    for (
      let attempt = 0;
      attempt <
      maxAttempts;
      attempt++
    ) {
      const sessionCode =
        this.generateSessionCode();

      const existing =
        await this.prisma
          .classSession
          .findUnique({
            where: {
              sessionCode,
            },

            select: {
              id: true,
            },
          });

      if (!existing) {
        return sessionCode;
      }
    }

    throw new BadRequestException(
      'Unable to generate a unique session code. Please try again.',
    );
  }

  /*
   * ==========================================
   * CREATE SESSION
   * ==========================================
   */

  async createSession(
  teacherId: string,
  dto: CreateSessionDto,
) {
  const createdAt = new Date();

  const endsAt = new Date(
    createdAt.getTime() +
      dto.durationMinutes * 60_000,
  );

  const sessionCode =
    await this.generateUniqueSessionCode();

  const created =
    await this.prisma.$transaction(
      async (tx) => {
        const session =
          await tx.classSession.create({
            data: {
              sessionCode,

              classTitle: dto.classTitle,

              teacherId,

              durationMinutes:
                dto.durationMinutes,

              joinWindowMinutes:
                dto.joinWindowMinutes ??
                15,

              /* -------------------------
               * Security Policy
               * ------------------------- */

              allowInternet:
                dto.allowInternet ??
                true,

              allowClipboard:
                dto.allowClipboard ??
                true,

              allowUsb:
                dto.allowUsb ??
                true,

              allowTaskManager:
                dto.allowTaskManager ??
                true,

              allowAltTab:
                dto.allowAltTab ??
                true,

              allowWindowsKey:
                dto.allowWindowsKey ??
                true,

              allowPrintScreen:
                dto.allowPrintScreen ??
                true,

              freezeOnEnd:
                dto.freezeOnEnd ??
                false,

              allowOffline:
                dto.allowOffline ??
                true,

              restrictExistingFiles:
                dto.restrictExistingFiles ??
                false,

              restrictUnauthorizedApps:
                dto.restrictUnauthorizedApps ??
                false,

              screenshotInterval:
                dto.screenshotInterval,

              warningMinutes:
                dto.warningMinutes ??
                5,

              instructions:
                dto.instructions,

              startupUrl:
                 dto.startupUrl,  

              sessionMode:
                dto.sessionMode ??
                'LAB',

              questionMode:
                dto.questionMode ??
                'COMMON',

              createdAt,

              endsAt,
            },
          });

        /* -------------------------
         * Allowed Websites
         * ------------------------- */

        if (
          dto.allowedWebsites?.length
        ) {
          await tx.allowedWebsite.createMany({
            data:
              dto.allowedWebsites.map(
                (domain) => ({
                  sessionId:
                    session.id,
                  domain,
                }),
              ),
          });
        }

        /* -------------------------
         * Blocked Websites
         * ------------------------- */

        if (
          dto.blockedWebsites?.length
        ) {
          await tx.blockedWebsite.createMany({
            data:
              dto.blockedWebsites.map(
                (domain) => ({
                  sessionId:
                    session.id,
                  domain,
                }),
              ),
          });
        }

        /* -------------------------
         * Allowed Applications
         * ------------------------- */

        if (
          dto.allowedApplications?.length
        ) {
          await tx.allowedApplication.createMany({
            data:
              dto.allowedApplications.map(
                (processName) => ({
                  sessionId:
                    session.id,
                  processName,
                }),
              ),
          });
        }

        /* -------------------------
         * Blocked Applications
         * ------------------------- */

        if (
          dto.blockedApplications?.length
        ) {
          await tx.blockedApplication.createMany({
            data:
              dto.blockedApplications.map(
                (processName) => ({
                  sessionId:
                    session.id,
                  processName,
                }),
              ),
          });
        }

        return tx.classSession.findUnique({
          where: {
            id: session.id,
          },
          include: {
            allowedWebsites: true,
            blockedWebsites: true,
            allowedApplications: true,
            blockedApplications: true,
          },
        });
      },
    );

  return {
    ...created,

    sessionId:
      created?.sessionCode,
  };
}

  /*
   * ==========================================
   * PUBLIC STUDENT LOGIN
   * ==========================================
   */

  async studentLogin(
    dto: JoinSessionDto,
  ) {
    const regNumber =
      dto.regNumber.trim();

    const sessionCode =
      dto.sessionId
        .trim()
        .toUpperCase();

    /*
     * ----------------------------------------
     * VALIDATE STUDENT
     * ----------------------------------------
     */

    const student =
      await this.prisma
        .user
        .findUnique({
          where: {
            regNumber,
          },
        });

    if (!student) {
      throw new NotFoundException(
        'Student registration number not found.',
      );
    }

    if (
      student.role !==
      'STUDENT'
    ) {
      throw new ForbiddenException(
        'This registration number does not belong to a student account.',
      );
    }

    if (
      !student.isActive
    ) {
      throw new ForbiddenException(
        'This student account is inactive. Please contact the administrator.',
      );
    }

    /*
     * ----------------------------------------
     * VALIDATE SESSION
     * ----------------------------------------
     */

    const session =
  await this.prisma
    .classSession
    .findUnique({
      where: {
        sessionCode,
      },

      include: {
        allowedWebsites: true,
        blockedWebsites: true,
        allowedApplications: true,
        blockedApplications: true,
      },
    });

    if (!session) {
      throw new NotFoundException(
        'Invalid Session Code.',
      );
    }

    if (
      session.status !==
      'ACTIVE'
    ) {
      throw new ForbiddenException(
        'This session is not active.',
      );
    }

    const now =
      new Date();

    /*
     * ----------------------------------------
     * SESSION EXPIRY
     * ----------------------------------------
     */

    if (
      now >=
      session.endsAt
    ) {
      throw new ForbiddenException(
        'This session has ended. The Session Code can no longer be used.',
      );
    }

    /*
     * ----------------------------------------
     * JOIN WINDOW
     * ----------------------------------------
     */

    const windowCloses =
      new Date(
        session.createdAt
          .getTime() +
          session
            .joinWindowMinutes *
            60_000,
      );

    const withinWindow =
      now <=
      windowCloses;

    /*
     * ----------------------------------------
     * LATE STUDENT
     * ----------------------------------------
     */

    if (
      !withinWindow
    ) {
      const approvedRequest =
        await this.prisma
          .specialAccessRequest
          .findFirst({
            where: {
              sessionId:
                session.id,

              studentId:
                student.id,

              status:
                'APPROVED',
            },
          });

      if (
        !approvedRequest
      ) {
        const existingRequest =
          await this.prisma
            .specialAccessRequest
            .findFirst({
              where: {
                sessionId:
                  session.id,

                studentId:
                  student.id,

                status:
                  'PENDING',
              },
            });

        const accessRequest =
          existingRequest ??
          await this.prisma
            .specialAccessRequest
            .create({
              data: {
                sessionId:
                  session.id,

                studentId:
                  student.id,

                status:
                  'PENDING',
              },
            });

        return {
          success:
            false,

          requiresSpecialAccess:
            true,

          message:
            'The normal join window has closed. A special access request has been sent to the teacher.',

          accessRequest: {
            id:
              accessRequest.id,

            status:
              accessRequest.status,
          },

          student: {
            id:
              student.id,

            username:
              student.username,

            regNumber:
              student.regNumber,

            classId:
              student.classId,
          },

          session: {
            id:
              session.id,

            sessionCode:
              session.sessionCode,

            sessionId:
              session.sessionCode,

            classTitle:
              session.classTitle,

            endsAt:
              session.endsAt,
          },
        };
      }
    }

    /*
     * ----------------------------------------
     * JOIN STUDENT
     * ----------------------------------------
     */

    const joinResult =
      await this.joinSession(
        student.id,
        {
          sessionId:
            session.sessionCode,

          regNumber:
            student.regNumber ??
            regNumber,

          pcHostname:
            dto.pcHostname,
        },
      );

    /*
     * ----------------------------------------
     * STUDENT SESSION JWT
     * ----------------------------------------
     */

    const sessionAccessToken =
      await this.jwt
        .signAsync(
          {
            sub:
              student.id,

            role:
              'STUDENT',

            username:
              student.username,

            sessionId:
              session.id,

            sessionCode:
              session.sessionCode,

            pcHostname:
              dto.pcHostname,

            tokenType:
              'SESSION',
          },

          {
            expiresIn:
              Math.max(
                60,

                Math.floor(
                  (
                    session.endsAt
                      .getTime() -
                    Date.now()
                  ) /
                    1000,
                ),
              ),
          },
        );

    return {
      success:
        true,

      message:
        'Student successfully joined the session.',

      sessionAccessToken,

      student: {
        id:
          student.id,

        username:
          student.username,

        regNumber:
          student.regNumber,

        classId:
          student.classId,
      },

      ...joinResult,
    };
  }

  /*
   * ==========================================
   * AUTHENTICATED STUDENT JOIN
   * ==========================================
   */

  async joinSession(
    studentId: string,
    dto: JoinSessionDto,
  ) {
    const sessionCode =
      dto.sessionId
        .trim()
        .toUpperCase();

    const session =
      await this.prisma
        .classSession
        .findUnique({
          where: {
            sessionCode,
          },
          include: {
            allowedWebsites: true,
            blockedWebsites: true,
            allowedApplications: true,
            blockedApplications: true,
          },
        });

    if (
      !session ||
      session.status !==
        'ACTIVE'
    ) {
      throw new NotFoundException(
        'Session not found or not active',
      );
    }

    const now =
      new Date();

    /*
     * Session duration expired.
     */

    if (
      now >=
      session.endsAt
    ) {
      throw new ForbiddenException(
        'This session has ended. The Session Code can no longer be used to join.',
      );
    }

    /*
     * Calculate normal
     * joining window.
     */

    const windowCloses =
      new Date(
        session.createdAt
          .getTime() +
          session
            .joinWindowMinutes *
            60_000,
      );

    const withinWindow =
      now <=
      windowCloses;

    /*
     * Check late access.
     */

    if (
      !withinWindow
    ) {
      const approved =
        await this.prisma
          .specialAccessRequest
          .findFirst({
            where: {
              sessionId:
                session.id,

              studentId,

              status:
                'APPROVED',
            },
          });

      if (!approved) {
        throw new ForbiddenException(
          'Join window has closed. Request special access from the teacher to join this session.',
        );
      }
    }

    /*
     * ----------------------------------------
     * SESSION PARTICIPANT
     * ----------------------------------------
     */

    const participant =
      await this.prisma
        .sessionParticipant
        .upsert({
          where: {
            sessionId_studentId:
              {
                sessionId:
                  session.id,

                studentId,
              },
          },

          create: {
            sessionId:
              session.id,

            studentId,

            pcHostname:
              dto.pcHostname,

            approvedLate:
              !withinWindow,
          },

          update: {
            pcHostname:
              dto.pcHostname,

            leftAt:
              null,
          },
        });

    /*
     * ----------------------------------------
     * ATTENDANCE
     * ----------------------------------------
     */

    const requiredSeconds =
      Math.floor(
        session
          .durationMinutes *
          60 *
          0.7,
      );

    await this.prisma
      .attendance
      .upsert({
        where: {
          sessionId_studentId:
            {
              sessionId:
                session.id,

              studentId,
            },
        },

        create: {
          sessionId:
            session.id,

          studentId,

          presentSeconds:
            0,

          requiredSeconds,
        },

        update: {},
      });

    /*
     * ----------------------------------------
     * RESPONSE
     * ----------------------------------------
     */

    return {
      session: {
        id:
          session.id,

        sessionCode:
          session.sessionCode,

        sessionId:
          session.sessionCode,

        classTitle:
          session.classTitle,

        durationMinutes:
          session.durationMinutes,

        joinWindowMinutes:
          session.joinWindowMinutes,

        createdAt:
          session.createdAt,

        endsAt:
          session.endsAt,

        status:
          session.status,

        allowInternet:
          session.allowInternet,

        allowClipboard:
          session.allowClipboard,

        allowUsb:
          session.allowUsb,

        allowTaskManager:
          session.allowTaskManager,

        allowAltTab:
          session.allowAltTab,

        allowWindowsKey:
          session.allowWindowsKey,

        allowPrintScreen:
          session.allowPrintScreen,

        freezeOnEnd:
          session.freezeOnEnd,

        allowOffline:
          session.allowOffline,

        restrictExistingFiles:
          session.restrictExistingFiles,

        restrictUnauthorizedApps:
          session.restrictUnauthorizedApps,

        warningMinutes:
          session.warningMinutes,

        screenshotInterval:
          session.screenshotInterval,

        sessionMode:
          session.sessionMode,

        questionMode:
          session.questionMode,

        instructions:
          session.instructions,
        
        startupUrl:
            session.startupUrl,  

        allowedWebsites:
          session.allowedWebsites.map(
            site => site.domain,
          ),

        blockedWebsites:
          session.blockedWebsites.map(
            site => site.domain,
          ),

        allowedApplications:
          session.allowedApplications.map(
            app => app.processName,
          ),

        blockedApplications:
          session.blockedApplications.map(
            app => app.processName,
          ),
      },

      participant,
    };
  }

  /*
   * ==========================================
   * REQUEST SPECIAL ACCESS
   * ==========================================
   */

  async requestSpecialAccess(
    studentId: string,
    dto:
      RequestSpecialAccessDto,
  ) {
    const sessionCode =
      dto.sessionId
        .trim()
        .toUpperCase();

    const session =
      await this.prisma
        .classSession
        .findUnique({
          where: {
            sessionCode,
          },
        });

    if (
      !session ||
      session.status !==
        'ACTIVE'
    ) {
      throw new NotFoundException(
        'Session not found or not active',
      );
    }

    if (
      new Date() >=
      session.endsAt
    ) {
      throw new BadRequestException(
        'Session has already ended',
      );
    }

    const existingRequest =
      await this.prisma
        .specialAccessRequest
        .findFirst({
          where: {
            sessionId:
              session.id,

            studentId,

            status: {
              in: [
                'PENDING',
                'APPROVED',
              ],
            },
          },
        });

    if (
      existingRequest
    ) {
      return existingRequest;
    }

    return this.prisma
      .specialAccessRequest
      .create({
        data: {
          sessionId:
            session.id,

          studentId,

          status:
            'PENDING',
        },
      });
  }

  /*
   * ==========================================
   * HANDLE SPECIAL ACCESS
   * ==========================================
   */

  async handleAccessRequest(
    actorId: string,

    actorRole:
      | 'TEACHER'
      | 'ADMIN',

    dto:
      HandleAccessRequestDto,
  ) {
    const request =
      await this.prisma
        .specialAccessRequest
        .findUnique({
          where: {
            id:
              dto.requestId,
          },

          include: {
            session:
              true,
          },
        });

    if (!request) {
      throw new NotFoundException(
        'Access request not found',
      );
    }

    if (
      actorRole ===
        'TEACHER' &&
      request.session
        .teacherId !==
        actorId
    ) {
      throw new ForbiddenException(
        'Not your session',
      );
    }

    return this.prisma
      .specialAccessRequest
      .update({
        where: {
          id:
            dto.requestId,
        },

        data: {
          status:
            dto.approve
              ? 'APPROVED'
              : 'REJECTED',

          handledById:
            actorId,

          handledAt:
            new Date(),
        },
      });
  }

  /*
   * ==========================================
   * GET SESSIONS
   * ==========================================
   *
   * ADMIN:
   * Can view all Sessions available to Admin.
   *
   * TEACHER:
   * Can view only Sessions created by them.
   *
   * IMPORTANT:
   * Later, when Institution multi-tenancy is
   * implemented, ADMIN results must also be
   * filtered by institutionId.
   */

  async getSessions(
    actorId: string,

    actorRole:
      | 'TEACHER'
      | 'ADMIN',
  ) {
    const sessions =
      await this.prisma
        .classSession
        .findMany({
          where:
            actorRole ===
            'TEACHER'
              ? {
                  teacherId:
                    actorId,
                }
              : {},

          orderBy: {
            createdAt:
              'desc',
          },

          include: {
            _count: {
              select: {
                participants: true,
              },
            },

            allowedWebsites: true,
            blockedWebsites: true,
            allowedApplications: true,
            blockedApplications: true,
          },
        });

    return sessions.map(
      (session) => {
        const allowedWebsites =
          session.allowedWebsites.map(
            site => site.domain,
          );

        const blockedWebsites =
          session.blockedWebsites.map(
            site => site.domain,
          );

        const allowedApplications =
          session.allowedApplications.map(
            app => app.processName,
          );

        const blockedApplications =
          session.blockedApplications.map(
            app => app.processName,
          );

        return {
          id:
            session.id,

          /*
           * Public Session Code.
           */

          sessionId:
            session.sessionCode,

          sessionCode:
            session.sessionCode,

          classTitle:
            session.classTitle,

          durationMinutes:
            session.durationMinutes,

          joinWindowMinutes:
            session.joinWindowMinutes,

          createdAt:
            session.createdAt,

          endsAt:
            session.endsAt,

          status:
            session.status,

          teacherId:
            session.teacherId,

          participantCount:
            session._count
              .participants,

          allowInternet:
            session.allowInternet,

          allowClipboard:
            session.allowClipboard,

          allowUsb:
            session.allowUsb,

          allowTaskManager:
            session.allowTaskManager,

          allowAltTab:
            session.allowAltTab,

          allowWindowsKey:
            session.allowWindowsKey,

          allowPrintScreen:
            session.allowPrintScreen,

          freezeOnEnd:
            session.freezeOnEnd,

          allowOffline:
            session.allowOffline,

          restrictExistingFiles:
            session.restrictExistingFiles,

          restrictUnauthorizedApps:
            session.restrictUnauthorizedApps,

          warningMinutes:
            session.warningMinutes,

          screenshotInterval:
            session.screenshotInterval,

          sessionMode:
            session.sessionMode,

          questionMode:
            session.questionMode,

          instructions:
            session.instructions,

          startupUrl:
            session.startupUrl,  

          allowedWebsites,

          blockedWebsites,

          allowedApplications,

          blockedApplications,
        };
      },
    );
  }

  /*
   * ==========================================
   * ONLINE PARTICIPANTS
   * ==========================================
   */

  async getOnlineParticipants(
    sessionId: string,
  ) {
    return this.prisma
      .sessionParticipant
      .findMany({
        where: {
          sessionId,

          leftAt:
            null,
        },

        include: {
          student: {
            select: {
              id:
                true,

              username:
                true,

              regNumber:
                true,
            },
          },
        },
      });
  }

  /*
   * ==========================================
   * END SESSION
   * ==========================================
   *
   * Teacher:
   * Can end own Session.
   *
   * Admin:
   * Can forcibly end any Session.
   *
   * After ending:
   *
   * 1. Session becomes ENDED
   * 2. Active participants are closed
   * 3. Attendance is calculated
   * 4. session:ended is broadcast
   * 5. Student Agent receives event
   */

  async endSession(
    actorId: string,

    actorRole:
      | 'TEACHER'
      | 'ADMIN',

    sessionId: string,
  ) {
    const session =
      await this.prisma
        .classSession
        .findUnique({
          where: {
            id:
              sessionId,
          },

          include: {
            participants:
              true,
          },
        });

    if (!session) {
      throw new NotFoundException(
        'Session not found',
      );
    }

    /*
     * Teacher can only end
     * their own Session.
     */

    if (
      actorRole ===
        'TEACHER' &&
      session.teacherId !==
        actorId
    ) {
      throw new ForbiddenException(
        'Not your session',
      );
    }

    /*
     * Already ended.
     */

    if (
      session.status ===
      'ENDED'
    ) {
      return {
        id:
          session.id,

        sessionCode:
          session.sessionCode,

        sessionId:
          session.sessionCode,

        status:
          session.status,

        alreadyEnded:
          true,
      };
    }

    const now =
      new Date();

    /*
     * ----------------------------------------
     * MARK SESSION ENDED
     * ----------------------------------------
     *
     * Also close all currently
     * active participants.
     */

    await this.prisma
      .$transaction([
        this.prisma
          .classSession
          .update({
            where: {
              id:
                sessionId,
            },

            data: {
              status:
                'ENDED',
            },
          }),

        this.prisma
          .sessionParticipant
          .updateMany({
            where: {
              sessionId,

              leftAt:
                null,
            },

            data: {
              leftAt:
                now,
            },
          }),
      ]);

    /*
     * ----------------------------------------
     * RELOAD PARTICIPANTS
     * ----------------------------------------
     */

    const participants =
      await this.prisma
        .sessionParticipant
        .findMany({
          where: {
            sessionId,
          },
        });

    /*
     * ----------------------------------------
     * FINAL ATTENDANCE CALCULATION
     * ----------------------------------------
     */

    for (
      const participant
      of participants
    ) {
      const participantEndTime =
        participant.leftAt ??
        now;

      const presentSeconds =
        Math.max(
          0,

          Math.floor(
            (
              participantEndTime
                .getTime() -
              participant
                .joinedAt
                .getTime()
            ) /
              1000,
          ),
        );

      /*
       * Student needs at least
       * 70% Session duration.
       */

      const requiredSeconds =
        Math.floor(
          session
            .durationMinutes *
            60 *
            0.7,
        );

      await this.prisma
        .attendance
        .upsert({
          where: {
            sessionId_studentId:
              {
                sessionId,

                studentId:
                  participant
                    .studentId,
              },
          },

          create: {
            sessionId,

            studentId:
              participant
                .studentId,

            presentSeconds,

            requiredSeconds,

            isPresent:
              presentSeconds >=
              requiredSeconds,

            computedAt:
              now,
          },

          update: {
            presentSeconds,

            requiredSeconds,

            isPresent:
              presentSeconds >=
              requiredSeconds,

            computedAt:
              now,
          },
        });
    }

    /*
     * ==========================================
     * REALTIME SESSION ENDED EVENT
     * ==========================================
     *
     * Broadcast to:
     *
     * session:<internal UUID>
     *
     * Connected Student Agents,
     * Teacher dashboard and Admin dashboard
     * can receive this event.
     */

    const endedReason =
      actorRole ===
      'ADMIN'
        ? 'ADMIN_TERMINATED'
        : 'COMPLETED';

    this.sessionRealtimeService
      .emitSessionEnded(
        session.id,
        {
          sessionId:
            session.id,

          sessionCode:
            session.sessionCode,

          classTitle:
            session.classTitle,

          endedAt:
            now.toISOString(),

          endedById:
            actorId,

          endedByRole:
            actorRole,

          reason:
            endedReason,
        },
      );

    /*
     * ==========================================
     * FINAL RESPONSE
     * ==========================================
     */

    return {
      id:
        session.id,

      sessionCode:
        session.sessionCode,

      sessionId:
        session.sessionCode,

      status:
        'ENDED',

      endedAt:
        now,

      endedById:
        actorId,

      endedByRole:
        actorRole,

      reason:
        endedReason,
    };
  }

  /*
   * ==========================================
   * AUTOMATED SESSION EXPIRATION
   * ==========================================
   *
   * Runs every minute to detect active sessions
   * that have passed their endsAt timestamp.
   * Closes them gracefully using existing logic.
   */

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredSessions() {
    const now = new Date();

    const expiredSessions = await this.prisma.classSession.findMany({
      where: {
        status: 'ACTIVE',
        endsAt: {
          lte: now,
        },
      },
      select: {
        id: true,
        teacherId: true,
      },
    });

    if (expiredSessions.length === 0) {
      return;
    }

    for (const session of expiredSessions) {
      try {
        /*
         * Execute the standard endSession workflow.
         * Passing 'TEACHER' ensures the reason broadcasts
         * as COMPLETED rather than ADMIN_TERMINATED.
         */
        await this.endSession(
          session.teacherId,
          'TEACHER',
          session.id,
        );
      } catch (error) {
        // Prevent one failing session closure from stopping the rest
        console.error(
          `[CRON] Failed to auto-end expired session ${session.id}:`,
          error,
        );
      }
    }
  }

  /*
 * ==========================================
 * GET SESSION POLICY
 * ==========================================
 */

async getSessionPolicy(
  sessionId: string,
) {
  const session =
    await this.prisma.classSession.findUnique({
      where: {
        id: sessionId,
      },

      include: {
        allowedWebsites: true,
        blockedWebsites: true,
        allowedApplications: true,
        blockedApplications: true,
      },
    });

  if (!session) {
    throw new NotFoundException(
      'Session not found',
    );
  }

  return {
    allowInternet: session.allowInternet,
    allowClipboard: session.allowClipboard,
    allowUsb: session.allowUsb,
    allowTaskManager: session.allowTaskManager,
    allowAltTab: session.allowAltTab,
    allowWindowsKey: session.allowWindowsKey,
    allowPrintScreen: session.allowPrintScreen,
    allowOffline: session.allowOffline,
    restrictExistingFiles:
      session.restrictExistingFiles,
    restrictUnauthorizedApps:
      session.restrictUnauthorizedApps,
    freezeOnEnd: session.freezeOnEnd,
    warningMinutes:
      session.warningMinutes,
    screenshotInterval:
      session.screenshotInterval,
    sessionMode:
      session.sessionMode,
    questionMode:
      session.questionMode,
    instructions:
      session.instructions,

    startupUrl:
    session.startupUrl,

    allowedWebsites:
      session.allowedWebsites.map(
        s => s.domain,
      ),

    blockedWebsites:
      session.blockedWebsites.map(
        s => s.domain,
      ),

    allowedApplications:
      session.allowedApplications.map(
        a => a.processName,
      ),

    blockedApplications:
      session.blockedApplications.map(
        a => a.processName,
      ),
  };
}

/*
 * ==========================================
 * UPDATE SESSION POLICY
 * ==========================================
 */

async updateSessionPolicy(
  sessionId: string,
  dto: UpdateSessionPolicyDto,
) {
  await this.prisma.$transaction(
    async (tx) => {
      await tx.classSession.update({
        where: {
          id: sessionId,
        },

        data: {
          allowInternet:
            dto.allowInternet,

          allowClipboard:
            dto.allowClipboard,

          allowUsb:
            dto.allowUsb,

          allowTaskManager:
            dto.allowTaskManager,

          allowAltTab:
            dto.allowAltTab,

          allowWindowsKey:
            dto.allowWindowsKey,

          allowPrintScreen:
            dto.allowPrintScreen,

          allowOffline:
            dto.allowOffline,

          restrictExistingFiles:
            dto.restrictExistingFiles,

          restrictUnauthorizedApps:
            dto.restrictUnauthorizedApps,

          freezeOnEnd:
            dto.freezeOnEnd,

          warningMinutes:
            dto.warningMinutes,

          screenshotInterval:
            dto.screenshotInterval,

          sessionMode:
            dto.sessionMode,

          questionMode:
            dto.questionMode,

          instructions:
            dto.instructions,
          
          startupUrl:
    dto.startupUrl,  
        },
      });

      await tx.allowedWebsite.deleteMany({
        where: {
          sessionId,
        },
      });

      await tx.blockedWebsite.deleteMany({
        where: {
          sessionId,
        },
      });

      await tx.allowedApplication.deleteMany({
        where: {
          sessionId,
        },
      });

      await tx.blockedApplication.deleteMany({
        where: {
          sessionId,
        },
      });

      if (dto.allowedWebsites?.length) {
        await tx.allowedWebsite.createMany({
          data: dto.allowedWebsites.map(
            (domain: string) => ({
              sessionId,
              domain,
            }),
          ),
        });
      }

      if (dto.blockedWebsites?.length) {
        await tx.blockedWebsite.createMany({
          data: dto.blockedWebsites.map(
            (domain: string) => ({
              sessionId,
              domain,
            }),
          ),
        });
      }

      if (dto.allowedApplications?.length) {
        await tx.allowedApplication.createMany({
          data:
            dto.allowedApplications.map(
              (processName: string) => ({
                sessionId,
                processName,
              }),
            ),
        });
      }

      if (dto.blockedApplications?.length) {
        await tx.blockedApplication.createMany({
          data:
            dto.blockedApplications.map(
              (processName: string) => ({
                sessionId,
                processName,
              }),
            ),
        });
      }
    },
  );

  return this.getSessionPolicy(
    sessionId,
  );
}
}