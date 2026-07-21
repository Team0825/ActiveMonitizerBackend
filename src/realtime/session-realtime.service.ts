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
   *
   * Called by PcsGateway once
   * Socket.IO server is ready.
   */

  setServer(
    server: Server,
  ): void {
    this.server =
      server;

    this.logger.log(
      'Realtime Socket.IO server registered.',
    );
  }

  /*
   * ============================================================
   * SESSION ENDED
   * ============================================================
   *
   * Sends:
   *
   * session:ended
   *
   * To every connected client inside:
   *
   * session:<internal-session-uuid>
   *
   * Used by:
   *
   * Student Agent
   * Teacher Dashboard
   * Admin Dashboard
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
    /*
     * Socket.IO server has not
     * initialized yet.
     */

    if (!this.server) {
      this.logger.warn(
        `Unable to emit session:ended for ${sessionId}: Socket.IO server is not ready.`,
      );

      return;
    }

    /*
     * Realtime Session rooms always
     * use the INTERNAL Session UUID.
     */

    const room =
      `session:${sessionId}`;

    this.server
      .to(room)
      .emit(
        'session:ended',
        payload,
      );

    this.logger.log(
      `session:ended emitted to ${room}. Reason: ${payload.reason}`,
    );
  }

  /*
   * ============================================================
   * EMIT EVENT TO SPECIFIC PC
   * ============================================================
   *
   * Every Student PC registered through
   * PcsGateway joins its own private room:
   *
   * pc:<hostname>
   *
   * Example:
   *
   * pc:DESKTOP-ABC123
   *
   * This allows other backend services,
   * such as NotificationsService,
   * to send realtime events directly
   * to one Student PC.
   *
   * Example event:
   *
   * student:message
   */

  emitToPc(
    hostname: string,

    eventName: string,

    payload: unknown,
  ): void {
    /*
     * Socket.IO server has not
     * initialized yet.
     */

    if (!this.server) {
      this.logger.warn(
        `Unable to emit ${eventName} to PC ${hostname}: Socket.IO server is not ready.`,
      );

      return;
    }

    /*
     * Normalize hostname so it matches
     * the PC room created by PcsGateway.
     */

    const normalizedHostname =
      hostname.trim();

    if (!normalizedHostname) {
      this.logger.warn(
        `Unable to emit ${eventName}: PC hostname is empty.`,
      );

      return;
    }

    /*
     * PcsGateway registers PCs into:
     *
     * pc:<hostname>
     */

    const room =
      `pc:${normalizedHostname}`;

    /*
     * Send realtime event directly
     * to the target PC.
     */

    this.server
      .to(room)
      .emit(
        eventName,
        payload,
      );

    this.logger.log(
      `${eventName} emitted to ${room}.`,
    );
  }
}