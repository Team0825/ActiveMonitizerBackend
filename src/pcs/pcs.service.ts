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

    const hasSession =
      typeof sessionId === 'string' &&
      !!sessionId.trim();

    /*
     * Resolve Session Code / UUID
     * into the internal database Session UUID.
     */

    if (hasSession) {
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
          hasSession
            ? internalSessionId
            : undefined,

        currentStudentId:
          hasSession
            ? studentId ?? null
            : undefined,

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

  async markPresenceOffline(
    hostname: string,
  ) {
    const normalizedHostname =
      hostname.trim();

    return this.prisma.pc
      .updateMany({
        where: {
          hostname:
            normalizedHostname,

          currentSessionId:
            null,
        },

        data: {
          status:
            'OFFLINE',
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

    const participants =
      await this.prisma
        .sessionParticipant
        .findMany({
          where: {
            sessionId:
              session.id,

            pcHostname: {
              not:
                null,
            },
          },

          select: {
            pcHostname:
              true,
          },
        });

    const participantHostnames =
      participants
        .map(
          participant =>
            participant.pcHostname
              ?.trim(),
        )
        .filter(
          (
            hostname,
          ): hostname is string =>
            !!hostname,
        );

    return this.prisma.pc.findMany({
      where: {
        status:
          'ONLINE',

        OR: [
          {
            currentSessionId:
              session.id,
          },

          {
            hostname: {
              in:
                participantHostnames,
            },
          },
        ],
      },

      orderBy: {
        hostname:
          'asc',
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
    hostname: string,
    info: PcSystemInfoPayload
) {
    const healthStatus =
    (
        info.cpuUsage > 90 ||
        info.ramUsagePercent > 90 ||
        info.diskUsagePercent > 95
    )
        ? "CRITICAL"
        : (
            info.cpuUsage >= 80 ||
            info.ramUsagePercent >= 80 ||
            info.diskUsagePercent >= 90
        )
            ? "WARNING"
            : "GOOD";

    const internetStatus =
        info.internetConnected
            ? "ONLINE"
            : "OFFLINE";

    const pc = await this.prisma.pc.update({

        where: {
            hostname
        },

        data: {
            agentVersion: info.agentVersion,

            cpuName: info.processorName,

            osName: info.osName,

            osVersion: info.osVersion,

            osArchitecture: info.osArchitecture,

            totalMemoryMb: info.totalMemoryMb,

            availableMemoryMb: info.freeMemoryMb,

            totalDiskMb: info.totalDiskGb * 1024,

            availableDiskMb: info.freeDiskGb * 1024,

            healthStatus,

            internetStatus,

            lastHealthCheck: new Date(),

            lastSyncAt: new Date()
        }
    });

    await this.prisma.pcHealthReport.create({

        data: {

          gpuName: info.gpuName,

gpuDriverVersion: info.gpuDriverVersion,

uptimeSeconds: info.uptimeSeconds,

restartRequired: info.restartRequired,

firewallEnabled: info.firewallEnabled,

antivirusEnabled: info.antivirusEnabled,
            pcId: pc.id,

            agentVersion: info.agentVersion,

            osName: info.osName,

            osVersion: info.osVersion,

            osArchitecture: info.osArchitecture,

            processArchitecture:
                info.processArchitecture,

            processorCount:
                info.processorCount,

            dotNetVersion:
                info.dotNetVersion,

            ramUsage:
                info.ramUsage,

            totalMemoryMb:
                info.totalMemoryMb,

            freeMemoryMb:
                info.freeMemoryMb,

            diskUsage:
                info.diskUsage,

            totalDiskGb:
                info.totalDiskGb,

            freeDiskGb:
                info.freeDiskGb,

            internetConnected:
                info.internetConnected,

            cpuUsagePercent:
                info.cpuUsage,

            memoryUsagePercent:
                info.ramUsagePercent,

            diskUsagePercent:
                info.diskUsagePercent,

            availableMemoryMb:
    info.freeMemoryMb,

availableDiskMb:
    info.freeDiskGb * 1024,

healthStatus,

            internetStatus,

            lastSystemReport:
                new Date()
        }
    });

    return pc;
}

async getHealth() {
  /*
   * ============================================================
   * LIVE PC HEALTH
   * ============================================================
   *
   * Only PCs that have sent a heartbeat recently are returned.
   *
   * Old database records are NOT shown in Live Health.
   */

  const LIVE_HEARTBEAT_SECONDS = 15;

  const liveSince = new Date(
    Date.now() -
      LIVE_HEARTBEAT_SECONDS * 1000,
  );

  const pcs = await this.prisma.pc.findMany({
    where: {
      status: 'ONLINE',

      lastSeen: {
        gte: liveSince,
      },
    },

    orderBy: {
      hostname: 'asc',
    },

    include: {
      healthReports: {
        orderBy: {
          reportedAt: 'desc',
        },

        take: 1,
      },
    },
  });
  return pcs.map(pc => {
    const health = pc.healthReports[0] ?? null;

    return {
      // ============================================================
      // BASIC PC STATUS
      // ============================================================

      hostname: pc.hostname,
      displayName: pc.displayName,
      labName: pc.labName,

      status: pc.status,

      online: pc.status === 'ONLINE',

      lastSeen: pc.lastSeen,

      heartbeatAgeSeconds:
        pc.lastSeen
          ? Math.floor(
              (Date.now() - pc.lastSeen.getTime()) / 1000,
            )
          : null,

      // ============================================================
      // SESSION
      // ============================================================

      sessionId: pc.currentSessionId,
      studentId: pc.currentStudentId,

      // ============================================================
      // OPERATING SYSTEM
      // ============================================================

      os: {
        name: pc.osName,
        version: pc.osVersion,
        architecture: pc.osArchitecture,
      },

      // ============================================================
      // CPU
      // ============================================================

      cpu: {
        name: pc.cpuName,

        usagePercent:
          health?.cpuUsagePercent ?? null,

        processorCount:
          health?.processorCount ?? null,
      },

            // ============================================================
      // GPU
      // ============================================================

      gpu: {
        name:
          health?.gpuName ??
          pc.gpuName ??
          null,

        driverVersion:
          health?.gpuDriverVersion ??
          pc.gpuDriverVersion ??
          null,
      },

      // ============================================================
      // MEMORY
      // ============================================================

      memory: {
        totalMb:
          health?.totalMemoryMb ??
          pc.totalMemoryMb,

        availableMb:
          health?.availableMemoryMb ??
          pc.availableMemoryMb,

        usedMb:
          health?.totalMemoryMb != null &&
          health?.availableMemoryMb != null
            ? health.totalMemoryMb -
              health.availableMemoryMb
            : pc.totalMemoryMb != null &&
              pc.availableMemoryMb != null
              ? pc.totalMemoryMb -
                pc.availableMemoryMb
              : null,

        usagePercent:
          health?.memoryUsagePercent ?? null,
      },

      // ============================================================
      // STORAGE
      // ============================================================

      disk: {
  totalMb:
    health?.totalDiskGb != null
      ? health.totalDiskGb * 1024
      : pc.totalDiskMb,

  availableMb:
    health?.freeDiskGb != null
      ? health.freeDiskGb * 1024
      : pc.availableDiskMb,

  usedMb:
    health?.totalDiskGb != null &&
    health?.freeDiskGb != null
      ? (health.totalDiskGb * 1024) -
        (health.freeDiskGb * 1024)
      : pc.totalDiskMb != null &&
        pc.availableDiskMb != null
        ? pc.totalDiskMb -
          pc.availableDiskMb
        : null,

  usagePercent:
    health?.diskUsagePercent ?? null,
},

      // ============================================================
      // AGENT
      // ============================================================

      agent: {
        version:
          health?.agentVersion ??
          pc.agentVersion,

        clientVersion:
          pc.clientVersion,

        dotNetVersion:
          health?.dotNetVersion ?? null,

        processArchitecture:
          health?.processArchitecture ?? null,
      },

            // ============================================================
      // SYSTEM
      // ============================================================

      system: {
        uptimeSeconds:
          health?.uptimeSeconds ??
          pc.uptimeSeconds ??
          null,

        restartRequired:
          health?.restartRequired ??
          pc.restartRequired ??
          null,
      },

      // ============================================================
      // SECURITY
      // ============================================================

      security: {
        firewallEnabled:
          health?.firewallEnabled ??
          pc.firewallEnabled ??
          null,

        antivirusEnabled:
          health?.antivirusEnabled ??
          pc.antivirusEnabled ??
          null,
      },

      // ============================================================
      // HEALTH / UPDATE STATUS
      // ============================================================

      healthStatus:
        health?.healthStatus ??
        pc.healthStatus,

      updateStatus:
        pc.updateStatus,

      // ============================================================
      // NETWORK
      // ============================================================

      internetStatus:
        health?.internetStatus ??
        pc.internetStatus,

      internetConnected:
        health?.internetConnected ?? null,

      latencyMs:
        health?.latencyMs ??
        pc.latencyMs,

      // ============================================================
      // HEALTH REPORT
      // ============================================================

      lastHealthCheck:
        pc.lastHealthCheck,

      lastSystemReport:
        health?.lastSystemReport ?? null,

      lastSyncAt:
        pc.lastSyncAt,

      // ============================================================
      // TIMESTAMPS
      // ============================================================

      registeredAt:
        pc.registeredAt,

      updatedAt:
        pc.updatedAt,
    };
  });
}


}
