import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import {
  Logger,
} from '@nestjs/common';

import {
  JwtService,
} from '@nestjs/jwt';

import {
  randomUUID,
} from 'crypto';
import { PcSystemInfoPayload } from "./dto/system-info.dto";

import {
  Server,
  Socket,
} from 'socket.io';

import {
  PrismaService,
} from '../prisma/prisma.service';

import {
  SessionRealtimeService,
} from '../realtime/session-realtime.service';

import {
  PcsService,
} from './pcs.service';

import {
  HeartbeatPayload,
  RegisterPcPayload,
  TeacherCommandPayload,
  TeacherSubscribePayload,
  PcCommandAckPayload,
  PcActivityPayload,
  assertRegisterPcPayload,
  assertTeacherCommandPayload,
  assertPcCommandAckPayload,
  assertPcActivityPayload,
} from './dto/pcs.dto';

/*
 * ============================================================
 * AUTHENTICATED SOCKET
 * ============================================================
 */

interface AuthedSocket extends Socket {
  data: {
    user?: {
      sub: string;
      role:
        | 'STUDENT'
        | 'TEACHER'
        | 'ADMIN';
      username: string;
    };

    hostname?: string;
  };
}

/*
 * ============================================================
 * PENDING COMMAND
 * ============================================================
 */

interface PendingCommand {
  commandId: string;
  sessionId: string;
  issuedBy: string;
  issuedAt: number;
  targetHostname:
    | string
    | 'ALL';
}

/*
 * ============================================================
 * PC GATEWAY
 * ============================================================
 */

@WebSocketGateway({
  namespace: '/realtime',

  cors: {
    origin: '*',
  },
})
export class PcsGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger =
    new Logger(
      PcsGateway.name,
    );

  /*
   * Temporary command tracker.
   *
   * Later, when multiple backend instances
   * are deployed, this should move to Redis.
   */

  private readonly pendingCommands =
    new Map<
      string,
      PendingCommand
    >();

  constructor(
    private readonly jwt:
      JwtService,

    private readonly prisma:
      PrismaService,

    private readonly pcsService:
      PcsService,

    private readonly sessionRealtimeService:
      SessionRealtimeService,
  ) {}

  /*
   * ==========================================================
   * GATEWAY INITIALIZATION
   * ==========================================================
   *
   * Makes the Socket.IO server available to
   * SessionRealtimeService.
   *
   * SessionsService will later use that service
   * to emit events such as:
   *
   * session:ended
   */

  afterInit(
    server: Server,
  ): void {
    this.sessionRealtimeService
      .setServer(server);

    this.logger.log(
      'Realtime gateway initialized.',
    );
  }

  /*
   * ==========================================================
   * CONNECTION
   * ==========================================================
   */

  async handleConnection(
    client: AuthedSocket,
  ) {
    const token =
      (
        client.handshake.auth
          ?.token as string
      ) ||
      (
        client.handshake.query
          ?.token as string
      );

    if (!token) {
      this.logger.warn(
        `Rejected socket ${client.id}: no token`,
      );

      client.disconnect(true);

      return;
    }

    try {
      const payload =
        await this.jwt
          .verifyAsync(token);

      client.data.user =
        payload;
    } catch {
      this.logger.warn(
        `Rejected socket ${client.id}: invalid token`,
      );

      client.disconnect(true);
    }
  }

  /*
   * ==========================================================
   * DISCONNECT
   * ==========================================================
   */

  async handleDisconnect(
    client: AuthedSocket,
  ) {
    const hostname =
      client.data?.hostname;

    if (!hostname) {
      return;
    }

    const pc =
      await this.prisma.pc
        .findUnique({
          where: {
            hostname,
          },
        });

    await this.pcsService
      .markOffline(
        hostname,
      );

    if (
      pc?.currentSessionId
    ) {
      this.server
        .to(
          `session:${pc.currentSessionId}`,
        )
        .emit(
          'pc:status-update',
          {
            hostname,

            status:
              'OFFLINE',
          },
        );
    }
  }

  /*
   * ==========================================================
   * PC REGISTRATION
   * ==========================================================
   */

  @SubscribeMessage(
    'pc:register',
  )
  async onRegisterPc(
    @ConnectedSocket()
    client: AuthedSocket,

    @MessageBody()
    payload:
      RegisterPcPayload,
  ) {
    try {
      assertRegisterPcPayload(
        payload,
      );
    } catch (error) {
      client.emit(
        'error',
        {
          message:
            error
              instanceof Error
              ? error.message
              : 'Invalid PC registration payload',
        },
      );

      return;
    }

    /*
     * Only Student PC clients
     * can register a PC.
     */

    if (
      client.data.user
        ?.role !==
      'STUDENT'
    ) {
      client.emit(
        'error',
        {
          message:
            'Only student clients can register a PC',
        },
      );

      return;
    }

    const hostname =
      payload.hostname
        .trim();

    client.data.hostname =
      hostname;

    /*
     * Register PC as ONLINE.
     */

    await this.pcsService
      .markOnline(
        hostname,
        payload.labName,
        payload.sessionId,
        client.data.user.sub,
      );

    /*
     * Every PC gets its
     * own private room.
     */

    await client.join(
      `pc:${hostname}`,
    );

    /*
     * Agent can register without
     * an active Session.
     */

    if (
      !payload.sessionId
    ) {
      client.emit(
        'pc:registered',
        {
          ok: true,

          hostname,

          status:
            'ONLINE',

          sessionActive:
            false,
        },
      );

      return;
    }

    /*
     * Accept:
     *
     * - Internal Session UUID
     * - Public Session Code
     */

    const sessionIdentifier =
      payload.sessionId
        .trim();

    const session =
      await this.prisma
        .classSession
        .findFirst({
          where: {
            OR: [
              {
                id:
                  sessionIdentifier,
              },

              {
                sessionCode:
                  sessionIdentifier
                    .toUpperCase(),
              },
            ],
          },
        });

    if (!session) {
      client.emit(
        'error',
        {
          message:
            'Session not found for PC registration',
        },
      );

      return;
    }

    if (
      session.status !==
      'ACTIVE'
    ) {
      client.emit(
        'error',
        {
          message:
            'Session is not active',
        },
      );

      return;
    }

    /*
     * Always use internal UUID
     * for realtime Session rooms.
     */

    const sessionRoom =
      `session:${session.id}`;

    await client.join(
      sessionRoom,
    );

    /*
     * Notify Teacher/Admin dashboards.
     */

    this.server
      .to(sessionRoom)
      .emit(
        'pc:status-update',
        {
          hostname,

          status:
            'ONLINE',

          studentId:
            client.data.user
              .sub,

          sessionId:
            session.id,

          sessionCode:
            session.sessionCode,
        },
      );

    /*
     * ==========================================================
     * LOAD SESSION SECURITY POLICY
     * ==========================================================
     */

    const sessionWithPolicy =
      await this.prisma.classSession.findUnique({
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

    if (!sessionWithPolicy) {
      client.emit('error', {
        message: 'Unable to load session policy.',
      });

      return;
    }

    /*
     * ==========================================================
     * BUILD POLICY OBJECT
     * ==========================================================
     */

    const allowedWebsites =
      sessionWithPolicy.allowedWebsites.map(
        site => site.domain,
      );

    const blockedWebsites =
      sessionWithPolicy.blockedWebsites.map(
        site => site.domain,
      );

    const allowedApplications =
      sessionWithPolicy.allowedApplications.map(
        app => app.processName,
      );

    const blockedApplications =
      sessionWithPolicy.blockedApplications.map(
        app => app.processName,
      );

    const policy = {
      allowInternet:
        sessionWithPolicy.allowInternet,

      allowClipboard:
        sessionWithPolicy.allowClipboard,

      allowUsb:
        sessionWithPolicy.allowUsb,

      allowTaskManager:
        sessionWithPolicy.allowTaskManager,

      allowAltTab:
        sessionWithPolicy.allowAltTab,

      allowWindowsKey:
        sessionWithPolicy.allowWindowsKey,

      allowPrintScreen:
        sessionWithPolicy.allowPrintScreen,

      allowOffline:
        sessionWithPolicy.allowOffline,

      restrictExistingFiles:
        sessionWithPolicy.restrictExistingFiles,

      restrictUnauthorizedApps:
        sessionWithPolicy.restrictUnauthorizedApps,

      freezeOnEnd:
        sessionWithPolicy.freezeOnEnd,

      warningMinutes:
        sessionWithPolicy.warningMinutes,

      screenshotInterval:
        sessionWithPolicy.screenshotInterval,

      sessionMode:
        sessionWithPolicy.sessionMode,

      questionMode:
        sessionWithPolicy.questionMode,

      instructions:
        sessionWithPolicy.instructions,

      allowedWebsites,

      blockedWebsites,

      allowedApplications,

      blockedApplications,
    };

    client.emit(
      'pc:registered',
      {
        ok: true,

        hostname,

        status:
          'ONLINE',

        sessionActive:
          true,

        sessionId:
          session.id,

        sessionCode:
          session.sessionCode,

        ...policy,
      },
    );

    /*
     * ==========================================================
     * SESSION POLICY SYNC
     * ==========================================================
     */

    client.emit(
      'session:policy',
      {
        sessionId:
          session.id,

        sessionCode:
          session.sessionCode,

        classTitle:
          session.classTitle,

        status:
          session.status,

        durationMinutes:
          session.durationMinutes,

        joinWindowMinutes:
          session.joinWindowMinutes,

        createdAt:
          session.createdAt,

        endsAt:
          session.endsAt,

        ...policy,

        localPersistence:
          session.allowOffline,

        syncedAt:
          new Date()
            .toISOString(),
      },
    );

    this.logger.log(
      `PC ${hostname} registered for session ${session.sessionCode}`,
    );
  }

  /*
   * ==========================================================
   * PC HEARTBEAT
   * ==========================================================
   */

  @SubscribeMessage(
    'pc:heartbeat',
  )
  async onHeartbeat(
    @MessageBody()
    payload:
      HeartbeatPayload,
  ) {
    if (
      payload?.hostname
    ) {
      await this.pcsService
        .touchHeartbeat(
          payload.hostname,
        );
    }
  }

  /*
   * ==========================================================
   * PC ACTIVITY REPORT
   * ==========================================================
   */

  @SubscribeMessage(
    'pc:activity',
  )
  async onPcActivity(
    @ConnectedSocket()
    client: AuthedSocket,

    @MessageBody()
    payload:
      PcActivityPayload,
  ) {
    const user =
      client.data.user;

    if (
      !user ||
      user.role !==
        'STUDENT'
    ) {
      client.emit(
        'error',
        {
          message:
            'Only Student PC clients can report activity.',
        },
      );

      return;
    }

    try {
      assertPcActivityPayload(
        payload,
      );
    } catch (error) {
      client.emit(
        'error',
        {
          message:
            error
              instanceof Error
              ? error.message
              : 'Invalid PC activity payload.',
        },
      );

      return;
    }

    const hostname =
      payload.hostname
        .trim();

    if (
      !client.data.hostname
    ) {
      client.emit(
        'error',
        {
          message:
            'PC must be registered before reporting activity.',
        },
      );

      return;
    }

    if (
      client.data.hostname !==
      hostname
    ) {
      client.emit(
        'error',
        {
          message:
            'Activity hostname does not match registered PC.',
        },
      );

      return;
    }

    try {
      const activity =
        await this.pcsService
          .recordActivity(
            hostname,

            payload.sessionId,

            user.sub,

            payload.active,

            payload.sampleSeconds,
          );

      client.emit(
        'pc:activity-update',
        activity,
      );

      this.server
        .to(
          `session:${activity.sessionId}`,
        )
        .emit(
          'pc:activity-update',
          activity,
        );

      this.logger.debug(
        `Activity update from ${hostname}: ${activity.activityPercentage}%`,
      );
    } catch (error) {
      this.logger.warn(
        `Activity report rejected from ${hostname}: ${
          error instanceof Error
            ? error.message
            : 'Unknown error'
        }`,
      );

      client.emit(
        'error',
        {
          message:
            error
              instanceof Error
              ? error.message
              : 'Unable to process PC activity.',
        },
      );
    }
  }

  /*
   * ==========================================================
   * ADMIN / TEACHER SUBSCRIBE
   * ==========================================================
   */

  @SubscribeMessage(
    'teacher:subscribe',
  )
  async onTeacherSubscribe(
    @ConnectedSocket()
    client: AuthedSocket,

    @MessageBody()
    payload: TeacherSubscribePayload,
  ) {
    // Implementation placeholder matching existing file structure
  }

@SubscribeMessage("pc:system-info")
async handleSystemInfo(
    client:Socket,
    payload:PcSystemInfoPayload
){

    await this.pcsService.updateSystemInfo(
        payload.hostname,
        payload
    );

    this.server.emit(
        "pc:system-info",
        payload
    );

}  

}