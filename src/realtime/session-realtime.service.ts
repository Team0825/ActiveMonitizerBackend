import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  Server,
} from 'socket.io';

@Injectable()
export class SessionRealtimeService {
  private readonly logger =
    new Logger(
      SessionRealtimeService.name,
    );

  private server?: Server;

  /*
   * ============================================================
   * REGISTER SOCKET.IO SERVER
   * ============================================================
   */

  setServer(
    server: Server,
  ): void {
    this.server = server;

    this.logger.log(
      'Realtime Socket.IO server registered.',
    );
  }

  /*
   * ============================================================
   * GET SOCKET.IO SERVER
   * ============================================================
   */

  getServer():
    | Server
    | undefined {
    return this.server;
  }

  /*
   * ============================================================
   * SESSION ENDED
   * ============================================================
   */

  emitSessionEnded(
    sessionId: string,

    payload: {
      sessionId: string;

      sessionCode: string;

      classTitle: string;

      endedAt: string;

      endedById: string;

      endedByRole:
        | 'ADMIN'
        | 'TEACHER';

      reason:
        | 'ADMIN_TERMINATED'
        | 'COMPLETED';
    },
  ): void {
    if (!this.server) {
      this.logger.warn(
        `Unable to emit session:ended for ${sessionId}.`,
      );

      return;
    }

    const room =
      `session:${sessionId}`;

    this.server
      .to(room)
      .emit(
        'session:ended',
        payload,
      );

    this.logger.log(
      `session:ended -> ${room}`,
    );
  }

  /*
   * ============================================================
   * POLICY UPDATED
   * ============================================================
   */

  emitPolicyUpdated(
    sessionId: string,

    policy: unknown,
  ): void {
    if (!this.server) {
      this.logger.warn(
        `Unable to emit policy:update for ${sessionId}.`,
      );

      return;
    }

    const room =
      `session:${sessionId}`;

    this.server
      .to(room)
      .emit(
        'policy:update',
        policy,
      );

    this.logger.log(
      `policy:update -> ${room}`,
    );
  }

  /*
   * ============================================================
   * POLICY ACKNOWLEDGED
   * ============================================================
   */

  emitPolicyAcknowledged(
    sessionId: string,

    hostname: string,

    payload: unknown,
  ): void {
    if (!this.server) {
      return;
    }

    this.server
      .to(
        `session:${sessionId}`,
      )
      .emit(
        'policy:ack',
        {
          hostname,
          ...((payload ??
            {}) as object),
        },
      );
  }

  /*
   * ============================================================
   * SCREENSHOT READY
   * ============================================================
   */

  emitScreenshotReady(
    sessionId: string,

    payload: unknown,
  ): void {
    if (!this.server) {
      return;
    }

    this.server
      .to(
        `session:${sessionId}`,
      )
      .emit(
        'screenshot:ready',
        payload,
      );
  }

  /*
   * ============================================================
   * REMOTE CONTROL
   * ============================================================
   */

  emitRemoteCommand(
    hostname: string,

    payload: unknown,
  ): void {
    if (!this.server) {
      return;
    }

    this.server
      .to(
        `pc:${hostname}`,
      )
      .emit(
        'remote:command',
        payload,
      );
  }

  /*
   * ============================================================
   * ANNOUNCEMENT
   * ============================================================
   */

  emitAnnouncement(
    sessionId: string,

    payload: unknown,
  ): void {
    if (!this.server) {
      return;
    }

    this.server
      .to(
        `session:${sessionId}`,
      )
      .emit(
        'announcement',
        payload,
      );
  }

  /*
   * ============================================================
   * GENERIC SESSION EVENT
   * ============================================================
   */

  emitToSession(
    sessionId: string,

    eventName: string,

    payload: unknown,
  ): void {
    if (!this.server) {
      return;
    }

    this.server
      .to(
        `session:${sessionId}`,
      )
      .emit(
        eventName,
        payload,
      );
  }

  /*
   * ============================================================
   * EMIT TO SINGLE PC
   * ============================================================
   */

  emitToPc(
    hostname: string,

    eventName: string,

    payload: unknown,
  ): void {
    if (!this.server) {
      this.logger.warn(
        `Unable to emit ${eventName} to ${hostname}.`,
      );

      return;
    }

    const room =
      `pc:${hostname.trim()}`;

    this.server
      .to(room)
      .emit(
        eventName,
        payload,
      );

    this.logger.log(
      `${eventName} -> ${room}`,
    );
  }
}