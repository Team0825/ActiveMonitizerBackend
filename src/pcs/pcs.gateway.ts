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
  PcExecuteCommandPayload,
  PcCommandResultPayload,
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
      sessionId?: string;
      sessionCode?: string;
    };

    hostname?: string;

    /*
     * Machine-level PC presence connection.
     *
     * This is independent of student login.
     */
    pcPresence?: boolean;
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
  const auth =
    client.handshake.auth ?? {};

  /*
   * ============================================================
   * PC PRESENCE CONNECTION
   * ============================================================
   *
   * This connection is created by the Windows Agent itself.
   *
   * It does NOT require student login.
   *
   * PC hostname is the machine identity.
   */

  const presenceMode =
    auth.mode === 'pc-presence';

  const presenceHostname =
    typeof auth.hostname === 'string'
      ? auth.hostname.trim()
      : '';

  
  if (presenceMode) {
  if (!presenceHostname) {
    this.logger.warn(
      `Rejected PC presence socket ${client.id}: hostname missing`,
    );

    client.disconnect(true);

    return;
  }

  client.data.hostname =
  presenceHostname;

client.data.pcPresence =
  true;

/*
 * Register physical PC as ONLINE.
 *
 * No student/session is attached here.
 * Hostname is the machine identity.
 */
await this.pcsService.markOnline(
  presenceHostname,
);

this.logger.log(
  `PC presence connected: ${client.id} | ${presenceHostname}`,
);

return;
}

  /*
   * ============================================================
   * NORMAL AUTHENTICATED CONNECTION
   * ============================================================
   *
   * Existing Student / Teacher / Admin
   * realtime authentication remains unchanged.
   */

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
      await this.jwt.verifyAsync(token);

    client.data.user =
      payload;

    this.logger.log(
      `Socket connected: ${client.id} | ${payload.username} | ${payload.role}`,
    );
  } catch (error) {
    this.logger.error(error);

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

    if (
      client.data.pcPresence
    ) {
      await this.pcsService
        .markPresenceOffline(
          hostname,
        );

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
 * ==========================================================
 * PC REGISTRATION AUTHORIZATION
 * ==========================================================
 *
 * Two types of clients can register:
 *
 * 1. ActivityMonAgent
 *    - Can register without a user JWT.
 *    - Used to keep the physical PC LIVE.
 *
 * 2. Authenticated Student
 *    - Can register a PC together with a session.
 *    - Used for Student ↔ PC ↔ Session allocation.
 *
 * Teacher/Admin clients cannot register PCs.
 */

const user = client.data.user;

const isAgent =
  !user;

const isStudent =
  user?.role === 'STUDENT';

if (!isAgent && !isStudent) {
  client.emit(
    'error',
    {
      message:
        'Only ActivityMonAgent or Student clients can register a PC',
    },
  );

  return;
}
    const hostname =
      payload.hostname
        .trim();

    client.data.hostname =
      hostname;

    const registrationSessionId =
      typeof payload.sessionId ===
        'string' &&
      payload.sessionId.trim()
        ? payload.sessionId.trim()
        : user?.sessionId;

    /*
     * Register PC as ONLINE.
     */

    await this.pcsService.markOnline(
  hostname,
  payload.labName,
  registrationSessionId,
  client.data.user?.sub,
);

    this.logger.log(
      `[PC-CONTROL] Agent registered hostname/session ${hostname} ${registrationSessionId ?? 'NO_SESSION'}`,
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
      !registrationSessionId
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
      registrationSessionId
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
  client.data.user?.sub ?? null,

sessionId:
  session.id,

          sessionCode:
            session.sessionCode,
        },
      );

      /*
 * ==========================================================
 * SEND INITIAL SESSION POLICY TO NEWLY REGISTERED AGENT
 * ==========================================================
 */

this.sessionRealtimeService.emitPolicyUpdated(
  session.id,
  {
    sessionId: session.id,
    sessionCode: session.sessionCode,

    allowInternet: session.allowInternet,
    allowClipboard: session.allowClipboard,
    allowUsb: session.allowUsb,
    allowTaskManager: session.allowTaskManager,
    allowAltTab: session.allowAltTab,
    allowWindowsKey: session.allowWindowsKey,
    allowPrintScreen: session.allowPrintScreen,
    allowOffline: session.allowOffline,

    freezeOnEnd: session.freezeOnEnd,

    warningMinutes: session.warningMinutes,
    screenshotInterval: session.screenshotInterval,

    instructions: session.instructions,
    sessionMode: session.sessionMode,
    questionMode: session.questionMode,

    startupUrl: session.startupUrl,

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

      startupUrl:
        sessionWithPolicy.startupUrl,

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
            'Only Teacher or Admin clients can subscribe to PC sessions.',
        },
      );

      return;
    }

    if (
      !payload ||
      typeof payload.sessionId !==
        'string' ||
      !payload.sessionId.trim()
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

    const session =
      await this.prisma
        .classSession
        .findFirst({
          where: {
            OR: [
              {
                id:
                  payload.sessionId
                    .trim(),
              },

              {
                sessionCode:
                  payload.sessionId
                    .trim()
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

    const sessionRoom =
      `session:${session.id}`;

    await client.join(
      sessionRoom,
    );

    this.logger.log(
      `[PC-CONTROL] Teacher subscribed session ${session.id}`,
    );

    const pcs =
      await this.pcsService
        .listPcsForSession(
          session.id,
        );

    this.logger.log(
      `[PC-CONTROL] PCs found for session ${session.id}: ${pcs.length}`,
    );

    client.emit(
      'teacher:subscribed',
      {
        sessionId:
          session.id,

        sessionCode:
          session.sessionCode,
      },
    );

    client.emit(
      'pc:list',
      pcs,
    );

    this.logger.log(
      `[PC-CONTROL] pc:list emitted count ${pcs.length}`,
    );

  }

  /*
   * ==========================================================
   * TEACHER / ADMIN PC COMMAND
   * ==========================================================
   */

  @SubscribeMessage(
    'teacher:command',
  )
  async onTeacherCommand(
    @ConnectedSocket()
    client: AuthedSocket,

    @MessageBody()
    payload: TeacherCommandPayload,
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
            'Only Teacher or Admin clients can send PC commands.',
        },
      );

      return;
    }

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
              : 'Invalid PC command payload.',
        },
      );

      return;
    }

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
            'Session not found',
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

    const pcs =
      await this.pcsService
        .listPcsForSession(
          session.id,
        );

    const targetHostname =
      payload.targetHostname
        ?.trim() ||
      'ALL';

    const targetPcs =
      targetHostname ===
      'ALL'
        ? pcs
        : pcs.filter(
            pc =>
              pc.hostname ===
              targetHostname,
          );

    if (
      targetPcs.length ===
      0
    ) {
      client.emit(
        'error',
        {
          message:
            targetHostname ===
            'ALL'
              ? 'No connected PCs found for this session'
              : 'Target PC is not connected to this session',
        },
      );

      return;
    }

    const issuedAt =
      new Date();

    for (const pc of targetPcs) {
      const commandId =
        randomUUID();

      const command:
        PcExecuteCommandPayload = {
          commandId,

          sessionId:
            session.id,

          action:
            payload.action,

          ...(payload.action ===
            'MESSAGE'
            ? {
                message:
                  payload.message
                    ?.trim(),
              }
            : {}),

          issuedBy:
            user.sub,

          issuedAt:
            issuedAt
              .toISOString(),
        };

      this.pendingCommands
        .set(
          commandId,
          {
            commandId,

            sessionId:
              session.id,

            issuedBy:
              user.sub,

            issuedAt:
              issuedAt
                .getTime(),

            targetHostname:
              pc.hostname,
          },
        );

      this.server
        .to(
          `pc:${pc.hostname}`,
        )
        .emit(
          'command:execute',
          command,
        );

      this.server
        .to(
          `session:${session.id}`,
        )
        .emit(
          'command:sent',
          {
            commandId,

            sessionId:
              session.id,

            sessionCode:
              session.sessionCode,

            targetHostname:
              pc.hostname,

            requestedTargetHostname:
              targetHostname,

            action:
              payload.action,

            issuedBy:
              user.sub,

            issuedAt:
              command.issuedAt,
          },
        );

      await this.pcsService
        .logCommand(
          user.sub,
          payload.action,
          pc.hostname,
          {
            commandId,
            sessionId:
              session.id,
            targetHostname:
              pc.hostname,
            requestedTargetHostname:
              targetHostname,
          },
        );
    }
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
    payload: PcCommandAckPayload,
  ) {
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
              : 'Invalid command acknowledgement payload.',
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

    if (
      pending.targetHostname !==
        'ALL' &&
      pending.targetHostname !==
        payload.hostname
    ) {
      client.emit(
        'error',
        {
          message:
            'Command acknowledgement hostname does not match the pending command.',
        },
      );

      return;
    }

    const latencyMs =
      Date.now() -
      pending.issuedAt;

    const result:
      PcCommandResultPayload = {
        ...payload,

        latencyMs,
      };

    this.server
      .to(
        `session:${pending.sessionId}`,
      )
      .emit(
        'command:result',
        result,
      );

    if (
      payload.success
    ) {
      const nextStatus =
        payload.action ===
          'LOCK'
          ? 'LOCKED'
          : payload.action ===
              'FREEZE'
            ? 'FROZEN'
            : (
                payload.action ===
                  'UNLOCK' ||
                payload.action ===
                  'UNFREEZE'
              )
              ? 'ONLINE'
              : null;

      if (nextStatus) {
        await this.pcsService
          .setStatus(
            payload.hostname,
            nextStatus,
          );

        this.server
          .to(
            `session:${pending.sessionId}`,
          )
          .emit(
            'pc:status-update',
            {
              hostname:
                payload.hostname,

              status:
                nextStatus,
            },
          );
      }
    }

    this.pendingCommands
      .delete(
        payload.commandId,
      );
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
