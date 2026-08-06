import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PcCommandAction } from './dto/pcs.dto';
import { PcSystemInfoPayload } from "./dto/system-info.dto";

@Injectable()
export class PcsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /*
   * ============================================================
   * MARK PC ONLINE
   * ============================================================
   *
   * sessionId may be:
   *
   * 1. Internal Session UUID
   * 2. Public 8-character Session Code
   *
   * The PC database record always stores the
   * INTERNAL Session UUID in currentSessionId.
   */

  async markOnline(
    hostname: string,
    labName?: string,
    sessionId?: string,
    studentId?: string,
  ) {
    const normalizedHostname = hostname.trim();

    let internalSessionId: string | null = null;

    /*
     * Resolve Session Code / UUID
     * into the internal database Session UUID.
     */

    if (sessionId) {
      const sessionIdentifier = sessionId.trim();

      const session =
        await this.prisma.classSession.findFirst({
          where: {
            OR: [
              {
                id: sessionIdentifier,
              },
              {
                sessionCode:
                  sessionIdentifier.toUpperCase(),
              },
            ],
          },

          select: {
            id: true,
          },
        });

      /*
       * Only store a Session ID if
       * a valid Session was found.
       */

      if (session) {
        internalSessionId = session.id;
      }
    }

    /*
     * Create the PC if it does not exist,
     * otherwise update the existing PC.
     */

    return this.prisma.pc.upsert({
      where: {
        hostname: normalizedHostname,
      },

      create: {
        hostname: normalizedHostname,

        labName,

        status: 'ONLINE',

        currentSessionId:
          internalSessionId,

        currentStudentId:
          studentId,

        lastSeen:
          new Date(),
      },

      update: {
        status: 'ONLINE',

        labName:
          labName ?? undefined,

        currentSessionId:
          internalSessionId,

        currentStudentId:
          studentId ?? null,

        lastSeen:
          new Date(),
      },
    });
  }

  /*
   * ============================================================
   * MARK PC OFFLINE
   * ============================================================
   *
   * Called when the PC Agent disconnects.
   *
   * Clears:
   *
   * currentSessionId
   * currentStudentId
   */

  async markOffline(
    hostname: string,
  ) {
    const normalizedHostname =
      hostname.trim();

    return this.prisma.pc
      .update({
        where: {
          hostname:
            normalizedHostname,
        },

        data: {
          status:
            'OFFLINE',

          currentSessionId:
            null,

          currentStudentId:
            null,
        },
      })
      .catch(() => null);
  }

  /*
   * ============================================================
   * HEARTBEAT
   * ============================================================
   *
   * Updates the lastSeen timestamp.
   *
   * The Windows PC Agent should periodically
   * send a heartbeat through WebSocket.
   */

  async touchHeartbeat(
  hostname: string,
) {
  const normalizedHostname =
    hostname.trim();

  return this.prisma.pc
    .update({
      where: {
        hostname:
          normalizedHostname,
      },

      data: {
        lastSeen:
          new Date(),

        status:
          'ONLINE',
      },
    })
    .catch(() => null);
}

  /*
   * ============================================================
   * SET PC STATUS
   * ============================================================
   *
   * Used after Teacher/Admin commands.
   *
   * Possible states:
   *
   * ONLINE
   * OFFLINE
   * LOCKED
   * FROZEN
   */

  async setStatus(
    hostname: string,

    status:
      | 'ONLINE'
      | 'OFFLINE'
      | 'LOCKED'
      | 'FROZEN',
  ) {
    const normalizedHostname =
      hostname.trim();

    return this.prisma.pc
      .update({
        where: {
          hostname:
            normalizedHostname,
        },

        data: {
          status,
        },
      })
      .catch(() => null);
  }

  /*
   * ============================================================
   * LIST PCs FOR SESSION
   * ============================================================
   *
   * IMPORTANT:
   *
   * sessionId should normally be the INTERNAL
   * database Session UUID.
   *
   * However, this method also accepts a public
   * Session Code for compatibility.
   */

  async listPcsForSession(
    sessionId: string,
  ) {
    const sessionIdentifier =
      sessionId.trim();

    /*
     * First resolve the supplied value
     * to the internal Session UUID.
     */

    const session =
      await this.prisma.classSession.findFirst({
        where: {
          OR: [
            {
              id:
                sessionIdentifier,
            },

            {
              sessionCode:
                sessionIdentifier.toUpperCase(),
            },
          ],
        },

        select: {
          id: true,
        },
      });

    /*
     * Session does not exist.
     */

    if (!session) {
      return [];
    }

    /*
     * PC.currentSessionId always stores
     * the internal Session UUID.
     */

    return this.prisma.pc.findMany({
      where: {
        currentSessionId:
          session.id,
      },
    });
  }

  /*
   * ============================================================
   * AUDIT COMMAND
   * ============================================================
   *
   * Stores Teacher/Admin PC commands.
   *
   * Examples:
   *
   * LOCK
   * UNLOCK
   * FREEZE
   * UNFREEZE
   * SHUTDOWN
   * MESSAGE
   */

  async logCommand(
    actorId: string,

    action:
      PcCommandAction,

    targetPc: string,

    metadata?:
      Record<
        string,
        unknown
      >,
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorId,

        action,

        targetPc,

        metadata:
          metadata
            ? JSON.stringify(
                metadata,
              )
            : null,
      },
    });
  }
  /*
   * ============================================================
   * RECORD PC ACTIVITY
   * ============================================================
   *
   * Called by the realtime Gateway when the
   * Student Windows Agent sends:
   *
   * pc:activity
   *
   * The Agent reports whether activity was detected
   * during a sampling interval.
   *
   * Example:
   *
   * active: true
   * sampleSeconds: 10
   *
   * The backend calculates the live activity percentage.
   */

  async recordActivity(
    hostname: string,
    sessionId: string,
    studentId: string,
    active: boolean,
    sampleSeconds: number,
  ) {
    const normalizedHostname =
      hostname.trim();

    /*
     * Resolve Session UUID or Session Code.
     */

    const session =
      await this.prisma.classSession.findFirst({
        where: {
          OR: [
            {
              id:
                sessionId.trim(),
            },
            {
              sessionCode:
                sessionId
                  .trim()
                  .toUpperCase(),
            },
          ],
        },
      });

    if (!session) {
      throw new Error(
        'Session not found.',
      );
    }

    if (
      session.status !==
      'ACTIVE'
    ) {
      throw new Error(
        'Session is not active.',
      );
    }

    /*
     * Verify that this PC actually belongs
     * to this Student and Session.
     */

    const pc =
      await this.prisma.pc.findUnique({
        where: {
          hostname:
            normalizedHostname,
        },
      });

    if (!pc) {
      throw new Error(
        'PC is not registered.',
      );
    }

    if (
      pc.currentSessionId !==
      session.id
    ) {
      throw new Error(
        'PC is not registered to this session.',
      );
    }

    if (
      pc.currentStudentId !==
      studentId
    ) {
      throw new Error(
        'PC is not registered to this student.',
      );
    }

    /*
     * Find the Student's Session participant record.
     */

    const participant =
      await this.prisma.sessionParticipant.findUnique({
        where: {
          sessionId_studentId: {
            sessionId:
              session.id,

            studentId,
          },
        },
      });

    if (!participant) {
      throw new Error(
        'Student is not a participant of this session.',
      );
    }

    /*
     * Calculate how long the Student has been
     * connected to this Session.
     */

    const now =
      new Date();

    const elapsedSeconds =
      Math.max(
        1,
        Math.floor(
          (
            now.getTime() -
            participant.joinedAt.getTime()
          ) / 1000,
        ),
      );

    /*
     * Read current attendance information.
     */

    const attendance =
      await this.prisma.attendance.findUnique({
        where: {
          sessionId_studentId: {
            sessionId:
              session.id,

            studentId,
          },
        },
      });

    if (!attendance) {
      throw new Error(
        'Attendance record not found.',
      );
    }

    /*
     * For now, presentSeconds is used as the
     * accumulated ACTIVE PC interaction time.
     *
     * Only active samples increase it.
     */

    const currentActiveSeconds =
      attendance.presentSeconds ??
      0;

    const additionalActiveSeconds =
      active
        ? Math.floor(
            sampleSeconds,
          )
        : 0;

    /*
     * Prevent active time from exceeding
     * the actual elapsed Session time.
     */

    const updatedActiveSeconds =
      Math.min(
        elapsedSeconds,
        currentActiveSeconds +
          additionalActiveSeconds,
      );

    /*
     * Calculate live PC activity percentage.
     */

    const activityPercentage =
      Math.min(
        100,
        Math.max(
          0,
          Math.round(
            (
              updatedActiveSeconds /
              elapsedSeconds
            ) *
              100,
          ),
        ),
      );

    /*
     * Update attendance with the latest
     * accumulated activity time.
     *
     * Final attendance approval still happens
     * when the Session ends.
     */

    await this.prisma.attendance.update({
      where: {
        sessionId_studentId: {
          sessionId:
            session.id,

          studentId,
        },
      },

      data: {
        presentSeconds:
          updatedActiveSeconds,

        activityPercent:
          activityPercentage,
      },
    });

    /*
     * Update PC heartbeat as activity itself
     * confirms that the Agent is alive.
     */

    await this.touchHeartbeat(
      normalizedHostname,
    );

    /*
     * Return realtime activity information.
     *
     * The Gateway will broadcast this to:
     *
     * - Student Agent
     * - Teacher Dashboard
     * - Admin Dashboard
     */

    return {
      hostname:
        normalizedHostname,

      sessionId:
        session.id,

      sessionCode:
        session.sessionCode,

      studentId,

      active,

      sampleSeconds,

      activeSeconds:
        updatedActiveSeconds,

      elapsedSeconds,

      activityPercentage,

      updatedAt:
        now.toISOString(),
    };
  }
  /*
 * ============================================================
 * DEVICE HEALTH
 * ============================================================
 */
async updateSystemInfo(
    hostname:string,
    info:PcSystemInfoPayload
){
    return this.prisma.pc.update({

        where:{
            hostname
        },

        data: {

    agentVersion: info.agentVersion,

    osName: info.osName,

    osVersion: info.osVersion,

    osArchitecture: info.osArchitecture,

    totalMemoryMb: info.totalMemoryMb,

    availableMemoryMb: info.freeMemoryMb,

    totalDiskMb: info.totalDiskGb * 1024,

    availableDiskMb: info.freeDiskGb * 1024,

    lastSyncAt: new Date()

}

    });

}

async getHealth() {
  const pcs = await this.prisma.pc.findMany({
    orderBy: {
      hostname: 'asc',
    },
  });

  return pcs.map(pc => ({
    hostname: pc.hostname,

    status: pc.status,

    labName: pc.labName,

    lastSeen: pc.lastSeen,

    sessionId: pc.currentSessionId,

    studentId: pc.currentStudentId,

    online: pc.status === 'ONLINE',

    heartbeatAgeSeconds:
    pc.lastSeen
        ? Math.floor(
            (Date.now() - new Date(pc.lastSeen).getTime()) / 1000
          )
        : -1,
  }));
}


}
