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
  targetHostname: string | 'ALL';
  action?: string;
  status?: 'PENDING' | 'SENT' | 'ACKNOWLEDGED' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  payload?: PcExecuteCommandPayload;
  timeoutTimer?: NodeJS.Timeout;
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
   * Reliable per-PC sequential command queues & in-flight tracker.
   */
  private readonly pendingCommands = new Map<string, PendingCommand>();
  private readonly pcCommandQueues = new Map<string, PendingCommand[]>();
  private readonly pcInFlightCommand = new Map<string, PendingCommand>();

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
   * RELIABLE COMMAND QUEUE ENGINE
   * ==========================================================
   */

  private enqueuePcCommand(command: PendingCommand) {
    this.pendingCommands.set(command.commandId, command);

    const target = command.targetHostname;
    if (target === 'ALL') {
      // Broadcast commands are sent directly
      if (command.payload) {
        this.server.emit('command:execute', command.payload);
      }
      return;
    }

    const queue = this.pcCommandQueues.get(target) || [];
    queue.push(command);
    this.pcCommandQueues.set(target, queue);

    this.processNextCommandForPc(target);
  }

  private processNextCommandForPc(hostname: string) {
    if (this.pcInFlightCommand.has(hostname)) {
      return; // Agent is busy executing current command
    }

    const queue = this.pcCommandQueues.get(hostname);
    if (!queue || queue.length === 0) {
      return;
    }

    const nextCommand = queue.shift()!;
    nextCommand.status = 'SENT';
    this.pcInFlightCommand.set(hostname, nextCommand);

    // 15-second command timeout safeguard
    nextCommand.timeoutTimer = setTimeout(() => {
      this.handleCommandTimeout(hostname, nextCommand.commandId);
    }, 15000);

    if (nextCommand.payload) {
      this.server.to(`pc:${hostname}`).emit('command:execute', nextCommand.payload);
    }
  }

  private handleCommandTimeout(hostname: string, commandId: string) {
    const currentInFlight = this.pcInFlightCommand.get(hostname);
    if (currentInFlight && currentInFlight.commandId === commandId) {
      currentInFlight.status = 'EXPIRED';
      this.pcInFlightCommand.delete(hostname);

      const timeoutResult: PcCommandResultPayload = {
        commandId,
        hostname,
        action: (currentInFlight.action as any) || 'LOCK',
        success: false,
        error: 'Command execution timed out after 15 seconds.',
        executedAt: new Date().toISOString(),
        latencyMs: 15000,
      };

      if (currentInFlight.sessionId && currentInFlight.sessionId !== 'DIRECT') {
        this.server.to(`session:${currentInFlight.sessionId}`).emit('command:result', timeoutResult);
      }
      this.server.emit('command:result', timeoutResult);

      this.logger.warn(
        `[COMMAND_TIMEOUT] Command ${commandId} (${currentInFlight.action}) timed out for ${hostname}. Unblocking queue.`,
      );

      // Process next queued command for this PC
      this.processNextCommandForPc(hostname);
    }
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
    // Clean up spectator tracking for this client
    for (const [host, set] of this.activeSpectators.entries()) {
      if (set.has(client.id)) {
        set.delete(client.id);
        const isStillWatched = set.size > 0;
        if (!isStillWatched) {
          this.activeSpectators.delete(host);
        }
        this.server.to(`pc:${host}`).emit('pc:spectator-update', {
          hostname: host,
          isBeingWatched: isStillWatched,
          spectatorCount: set.size,
        });
        this.server.emit('pc:spectator-update', {
          hostname: host,
          isBeingWatched: isStillWatched,
          spectatorCount: set.size,
        });
      }
    }

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

      // Check if the session is currently ACTIVE
      try {
        const activeSession = await this.prisma.classSession.findUnique({
          where: { id: pc.currentSessionId },
          select: { id: true, status: true, sessionCode: true },
        });

        if (activeSession && activeSession.status === 'ACTIVE') {
          const violationRecord = await this.pcsService.logViolation(
            hostname,
            activeSession.id,
            'AGENT_DISCONNECTED',
            `Workstation connection lost or PC restarted during active session ${activeSession.sessionCode} on ${hostname}. Marked for administrator review (Crash / Power loss).`,
            new Date().toISOString(),
            'HIGH',
          );

          this.server
            .to(`session:${pc.currentSessionId}`)
            .emit('pc:violation', violationRecord);

          this.server.emit('pc:violation', violationRecord);

          this.logger.warn(
            `[DISCONNECT] AGENT_DISCONNECTED recorded for ${hostname} in active session ${activeSession.sessionCode} (pending teacher/admin review)`,
          );
        }
      } catch (err) {
        this.logger.error('Error logging disconnect violation:', err);
      }
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

          labName:
            payload.labName ?? null,

          studentId:
            client.data.user?.sub ?? null,

          sessionId:
            session.id,

          sessionCode:
            session.sessionCode,

          lastSeen:
            new Date().toISOString(),
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
      sessionWithPolicy.allowedWebsites?.map(
        (site) => site.domain,
      ) ?? [];

    const blockedWebsites =
      sessionWithPolicy.blockedWebsites?.map(
        (site) => site.domain,
      ) ?? [];

    const allowedApplications =
      sessionWithPolicy.allowedApplications?.map(
        (app) => app.processName,
      ) ?? [];

    const blockedApplications =
      sessionWithPolicy.blockedApplications?.map(
        (app) => app.processName,
      ) ?? [];

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

            payload.activityPercentage,

            payload.activeApp,

            payload.idleSeconds,
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

      this.server.emit('pc:activity-update', activity);

      this.logger.debug(
        `Activity update from ${hostname}: ${activity.activityPercentage}% | App: ${activity.activeApp}`,
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

  /*
   * ==========================================================
   * PC VIOLATION
   * ==========================================================
   */

  @SubscribeMessage('pc:violation')
  async onPcViolation(
    @ConnectedSocket() _client: Socket,
    @MessageBody()
    payload: {
      hostname: string;
      sessionId: string;
      type: string;
      details: string;
      occurredAt?: string;
    },
  ) {
    if (!payload || !payload.hostname || !payload.sessionId) {
      return;
    }

    const recorded = await this.pcsService.logViolation(
      payload.hostname,
      payload.sessionId,
      payload.type,
      payload.details,
      payload.occurredAt,
    );

    this.server
      .to(`session:${recorded.sessionId}`)
      .emit('pc:violation', recorded);

    this.server.emit('pc:violation', recorded);

    this.logger.warn(
      `[VIOLATION] ${payload.type} on PC ${payload.hostname} in Session ${payload.sessionId}: ${payload.details}`,
    );
  }

  /*
   * ==========================================================
   * SCREEN STREAMING & LIVE VIEW
   * ==========================================================
   */

  @SubscribeMessage('pc:screen-update')
  async onScreenUpdate(
    @ConnectedSocket() _client: Socket,
    @MessageBody()
    payload: {
      hostname: string;
      captureUrl: string;
      cpuUsage?: number;
      memoryUsage?: number;
      timestamp?: number;
    },
  ) {
    if (!payload?.hostname || !payload?.captureUrl) return;
    this.server.emit('pc:screen-update', payload);
    this.server.emit('pc:screen_update', payload);
  }

  @SubscribeMessage('pc:screen_update')
  async onScreenUpdateAlt(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    return this.onScreenUpdate(client, payload);
  }

  private readonly activeSpectators = new Map<string, Set<string>>();

  @SubscribeMessage('pc:stream-start')
  async onStreamStart(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { hostname: string; fps?: number },
  ) {
    const user = client.data.user;
    if (!user || (user.role !== 'ADMIN' && user.role !== 'TEACHER')) return;
    if (!payload?.hostname) return;

    if (payload.hostname === 'ALL') {
      this.server.emit('pc:stream-start', payload);
    } else {
      const host = payload.hostname.toUpperCase();
      if (!this.activeSpectators.has(host)) {
        this.activeSpectators.set(host, new Set());
      }
      this.activeSpectators.get(host)!.add(client.id);

      this.server.to(`pc:${payload.hostname}`).emit('pc:stream-start', payload);
      this.server.to(`pc:${payload.hostname}`).emit('pc:spectator-update', {
        hostname: payload.hostname,
        isBeingWatched: true,
        spectatorCount: this.activeSpectators.get(host)!.size,
      });
      this.server.emit('pc:spectator-update', {
        hostname: payload.hostname,
        isBeingWatched: true,
        spectatorCount: this.activeSpectators.get(host)!.size,
      });
    }
  }

  @SubscribeMessage('pc:stream-stop')
  async onStreamStop(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { hostname: string },
  ) {
    const user = client.data.user;
    if (!user || (user.role !== 'ADMIN' && user.role !== 'TEACHER')) return;
    if (!payload?.hostname) return;

    if (payload.hostname === 'ALL') {
      this.activeSpectators.clear();
      this.server.emit('pc:stream-stop', payload);
    } else {
      const host = payload.hostname.toUpperCase();
      const set = this.activeSpectators.get(host);
      if (set) {
        set.delete(client.id);
        const isStillWatched = set.size > 0;
        if (!isStillWatched) {
          this.activeSpectators.delete(host);
        }
        this.server.to(`pc:${payload.hostname}`).emit('pc:stream-stop', payload);
        this.server.to(`pc:${payload.hostname}`).emit('pc:spectator-update', {
          hostname: payload.hostname,
          isBeingWatched: isStillWatched,
          spectatorCount: set.size,
        });
        this.server.emit('pc:spectator-update', {
          hostname: payload.hostname,
          isBeingWatched: isStillWatched,
          spectatorCount: set.size,
        });
      } else {
        this.server.to(`pc:${payload.hostname}`).emit('pc:stream-stop', payload);
      }
    }
  }

  /*
   * ==========================================================
   * REMOTE INPUT (TEACHER / ADMIN -> PC)
   * ==========================================================
   */

  @SubscribeMessage('teacher:remote-input')
  async onRemoteInput(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    payload: {
      hostname: string;
      type: string;
      xPercent?: number;
      yPercent?: number;
      button?: number;
      keyCode?: number;
      key?: string;
      text?: string;
      deltaY?: number;
    },
  ) {
    const user = client.data.user;
    if (!user || (user.role !== 'ADMIN' && user.role !== 'TEACHER')) return;
    if (!payload?.hostname) return;
    this.server.to(`pc:${payload.hostname}`).emit('pc:remote-input', payload);
  }

  /*
   * ==========================================================
   * DIRECT PC COMMAND (TEACHER / ADMIN -> PC WITHOUT SESSION)
   * ==========================================================
   */

  @SubscribeMessage('teacher:direct-command')
  async onTeacherDirectCommand(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    payload: {
      targetHostname: string;
      action: any;
      message?: string;
    },
  ) {
    const user = client.data.user;
    if (!user || (user.role !== 'ADMIN' && user.role !== 'TEACHER')) {
      client.emit('error', { message: 'Only Teacher or Admin clients can send direct PC commands.' });
      return;
    }
    if (!payload || !payload.targetHostname || !payload.action) {
      client.emit('error', { message: 'targetHostname and action are required.' });
      return;
    }

    const issuedAt = new Date();
    const commandId = randomUUID();
    const commandPayload: PcExecuteCommandPayload = {
      commandId,
      sessionId: 'DIRECT',
      action: payload.action,
      ...(payload.action === 'MESSAGE' || payload.action === 'WARNING'
        ? { message: payload.message?.trim() }
        : {}),
      issuedBy: user.sub,
      issuedAt: issuedAt.toISOString(),
    };

    const pendingCommand: PendingCommand = {
      commandId,
      sessionId: 'DIRECT',
      issuedBy: user.sub,
      issuedAt: issuedAt.getTime(),
      targetHostname: payload.targetHostname,
      action: payload.action,
      status: 'PENDING',
      payload: commandPayload,
    };

    this.enqueuePcCommand(pendingCommand);

    await this.pcsService.logCommand(user.sub, payload.action, payload.targetHostname, {
      commandId,
      isDirect: true,
      targetHostname: payload.targetHostname,
    });
  }
}
