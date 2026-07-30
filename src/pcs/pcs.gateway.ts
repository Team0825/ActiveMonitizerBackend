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
     * Parse Session policy.
     */

    let allowedSites:
      string[] = [];

    let blockedSites:
      string[] = [];

    try {
      allowedSites =
        JSON.parse(
          session.allowedSites ||
            '[]',
        );
    } catch {
      allowedSites = [];
    }

    try {
      blockedSites =
        JSON.parse(
          session.blockedSites ||
            '[]',
        );
    } catch {
      blockedSites = [];
    }

    /*
     * Confirm PC registration.
     */

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

        allowedSites,

        blockedSites,

        sessionMode:
          session.sessionMode,

        allowOffline:
          session.allowOffline,

        restrictExistingFiles:
          session
            .restrictExistingFiles,

        restrictUnauthorizedApps:
          session
            .restrictUnauthorizedApps,

        freezeOnEnd:
          session.freezeOnEnd,

        warningMinutes:
          session.warningMinutes,

        instructions:
          session.instructions,

        questionMode:
          session.questionMode,

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
   *
   * Windows Student Agent sends:
   *
   * pc:activity
   *
   * Backend:
   *
   * 1. Validates the payload
   * 2. Validates Student socket
   * 3. Validates registered hostname
   * 4. Records active time
   * 5. Calculates activity percentage
   * 6. Sends result back to Student Agent
   * 7. Broadcasts result to Teacher/Admin dashboards
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
    /*
     * ------------------------------------------
     * ONLY STUDENT PC AGENTS
     * ------------------------------------------
     */

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

    /*
     * ------------------------------------------
     * VALIDATE PAYLOAD
     * ------------------------------------------
     */

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

    /*
     * ------------------------------------------
     * VERIFY REGISTERED HOSTNAME
     * ------------------------------------------
     *
     * A connected PC must not submit
     * activity for another PC.
     */

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
      /*
       * ----------------------------------------
       * RECORD ACTIVITY
       * ----------------------------------------
       *
       * PcsService validates:
       *
       * - Session
       * - Session status
       * - PC
       * - Student
       * - Session participant
       *
       * Then calculates the live percentage.
       */

      const activity =
        await this.pcsService
          .recordActivity(
            hostname,

            payload.sessionId,

            user.sub,

            payload.active,

            payload.sampleSeconds,
          );

      /*
       * ----------------------------------------
       * SEND UPDATE TO STUDENT AGENT
       * ----------------------------------------
       *
       * The Windows Agent listens for:
       *
       * pc:activity-update
       *
       * It can then update the Session Bubble.
       */

      client.emit(
        'pc:activity-update',
        activity,
      );

      /*
       * ----------------------------------------
       * BROADCAST TO SESSION
       * ----------------------------------------
       *
       * Teacher/Admin dashboards subscribed
       * to the Session room receive the same
       * live activity information.
       */

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
    payload:
      TeacherSubscribePayload,
  ) {
    const user =
      client.data.user;

    if (
      !user ||
      (
        user.role !==
          'TEACHER' &&
        user.role !==
          'ADMIN'
      )
    ) {
      client.emit(
        'error',
        {
          message:
            'Only teachers/admins can subscribe to a session',
        },
      );

      return;
    }

    if (
      !payload
        ?.sessionId ||
      typeof payload
        .sessionId !==
        'string' ||
      !payload
        .sessionId
        .trim()
    ) {
      client.emit(
        'error',
        {
          message:
            'sessionId is required',
        },
      );

      return;
    }

    const requestedSession =
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
                  requestedSession,
              },

              {
                sessionCode:
                  requestedSession
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
            'Session not found',
        },
      );

      return;
    }

    /*
     * Teacher can subscribe only
     * to their own Session.
     */

    if (
      user.role ===
        'TEACHER' &&
      session.teacherId !==
        user.sub
    ) {
      client.emit(
        'error',
        {
          message:
            'Not authorized for this session',
        },
      );

      return;
    }

    const internalSessionId =
      session.id;

    const roomName =
      `session:${internalSessionId}`;

    await client.join(
      roomName,
    );

    const pcs =
      await this.pcsService
        .listPcsForSession(
          internalSessionId,
        );

    client.emit(
      'pc:list',
      pcs,
    );

    client.emit(
      'teacher:subscribed',
      {
        success:
          true,

        sessionId:
          internalSessionId,

        sessionCode:
          session.sessionCode,

        room:
          roomName,

        pcCount:
          pcs.length,
      },
    );

    this.logger.debug(
      `${user.role} ${user.sub} subscribed to ${roomName}`,
    );
  }

  /*
   * ==========================================================
   * TEACHER / ADMIN COMMAND
   * ==========================================================
   */

  @SubscribeMessage(
    'teacher:command',
  )
  async onTeacherCommand(
    @ConnectedSocket()
    client: AuthedSocket,

    @MessageBody()
    payload:
      TeacherCommandPayload,
  ) {
    try {
      assertTeacherCommandPayload(
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
              : 'Invalid command',
        },
      );

      return;
    }

    const user =
      client.data.user;

    if (
      !user ||
      (
        user.role !==
          'TEACHER' &&
        user.role !==
          'ADMIN'
      )
    ) {
      client.emit(
        'error',
        {
          message:
            'Only teachers/admins can send commands',
        },
      );

      return;
    }

    const requestedSession =
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
                  requestedSession,
              },

              {
                sessionCode:
                  requestedSession
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
            'Session not found',
        },
      );

      return;
    }

    const internalSessionId =
      session.id;

    if (
      user.role ===
        'TEACHER' &&
      session.teacherId !==
        user.sub
    ) {
      client.emit(
        'error',
        {
          message:
            'Not authorized for this session',
        },
      );

      return;
    }

    const commandId =
      randomUUID();

    const issuedAt =
      Date.now();

    const targetHostname =
      payload
        .targetHostname ||
      'ALL';

    this.pendingCommands
      .set(
        commandId,
        {
          commandId,

          sessionId:
            internalSessionId,

          issuedBy:
            user.sub,

          issuedAt,

          targetHostname,
        },
      );

    const targetRoom =
      targetHostname !==
      'ALL'
        ? `pc:${targetHostname}`
        : `session:${internalSessionId}`;

       this.logger.log(
  `Sending ${payload.action} to room ${targetRoom}`,
); 

    this.server
      .to(targetRoom)
      .emit(
        'command:execute',
        {
          commandId,

          sessionId:
            internalSessionId,

          sessionCode:
            session.sessionCode,

          action:
            payload.action,

          message:
            payload.message,

          issuedBy:
            user.sub,

          issuedAt:
            new Date(
              issuedAt,
            ).toISOString(),
        },
      );
      this.logger.log(
  `Command emitted successfully. CommandId=${commandId}`,
);

    client.emit(
      'command:sent',
      {
        commandId,

        targetHostname,

        action:
          payload.action,

        issuedAt:
          new Date(
            issuedAt,
          ).toISOString(),
      },
    );

    /*
     * Update individual PC
     * visual status.
     */

    if (
      targetHostname !==
      'ALL'
    ) {
      if (
        payload.action ===
        'LOCK'
      ) {
        await this.pcsService
          .setStatus(
            targetHostname,
            'LOCKED',
          );
      }

      if (
        payload.action ===
        'FREEZE'
      ) {
        await this.pcsService
          .setStatus(
            targetHostname,
            'FROZEN',
          );
      }

      if (
        payload.action ===
        'SHUTDOWN'
      ) {
        await this.pcsService
          .setStatus(
            targetHostname,
            'OFFLINE',
          );
      }

      if (
        payload.action ===
          'UNLOCK' ||
        payload.action ===
          'UNFREEZE'
      ) {
        await this.pcsService
          .setStatus(
            targetHostname,
            'ONLINE',
          );
      }
    }

    /*
     * Audit command.
     */

    await this.pcsService
      .logCommand(
        user.sub,

        payload.action,

        targetHostname,

        {
          commandId,

          sessionId:
            internalSessionId,

          sessionCode:
            session.sessionCode,

          message:
            payload.message,
        },
      );
  }

  /*
   * ==========================================================
   * PC COMMAND ACKNOWLEDGEMENT
   * ==========================================================
   */

  @SubscribeMessage(
    'command:ack',
  )
  async onCommandAck(
    @ConnectedSocket()
    client: AuthedSocket,

    @MessageBody()
    payload:
      PcCommandAckPayload,
  ) {
    if (
      client.data.user
        ?.role !==
      'STUDENT'
    ) {
      client.emit(
        'error',
        {
          message:
            'Only PC clients can acknowledge commands',
        },
      );

      return;
    }

    try {
      assertPcCommandAckPayload(
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
              : 'Invalid command acknowledgement',
        },
      );

      return;
    }

    if (
      client.data
        .hostname &&
      client.data
        .hostname !==
        payload.hostname
    ) {
      client.emit(
        'error',
        {
          message:
            'PC hostname does not match registered client',
        },
      );

      return;
    }

    const pending =
      this.pendingCommands
        .get(
          payload.commandId,
        );

    if (!pending) {
      return;
    }

    const latencyMs =
      Date.now() -
      pending.issuedAt;

    this.server
      .to(
        `session:${pending.sessionId}`,
      )
      .emit(
        'command:result',
        {
          ...payload,

          latencyMs,
        },
      );

    if (
      pending
        .targetHostname !==
      'ALL'
    ) {
      this.pendingCommands
        .delete(
          payload.commandId,
        );
    } else {
      setTimeout(
        () => {
          this.pendingCommands
            .delete(
              payload.commandId,
            );
        },
        10_000,
      );
    }

    this.logger.debug(
      `Command ${payload.commandId} acknowledged by ${payload.hostname} in ${latencyMs}ms`,
    );
  }
}