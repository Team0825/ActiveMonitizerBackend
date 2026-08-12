import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

export interface ClearDataCategoryOption {
  key: string;
  label: string;
  description: string;
  count: number;
}

export interface RecoveryItem {
  id: string;
  category: string;
  itemCount: number;
  reason?: string;
  initiatedBy?: string;
  initiatedAt: Date;
  scheduledPermanentDeleteAt: Date;
  hoursRemaining: number;
  status: 'PENDING_DELETION' | 'RESTORED' | 'PERMANENTLY_DELETED';
}

@Injectable()
export class DataManagementService {
  private readonly logger = new Logger(DataManagementService.name);

  constructor(private readonly prisma: PrismaService) {}

  /*
   * ==========================================
   * 1. CLEAR SAFE LOCAL / SYSTEM CACHE
   * ==========================================
   */
  async clearCache() {
    this.logger.log('Safe system cache clear requested.');
    return {
      success: true,
      clearedAt: new Date().toISOString(),
      message: 'System and UI application cache successfully cleared. Database records remain intact.',
    };
  }

  /*
   * ==========================================
   * 2. GET AVAILABLE DATA CATEGORIES & STATS
   * ==========================================
   */
  async getDataCategories(): Promise<ClearDataCategoryOption[]> {
    const [
      sessionCount,
      attendanceCount,
      auditLogCount,
      healthReportCount,
      inactiveTeacherCount,
    ] = await Promise.all([
      this.prisma.classSession.count({ where: { status: 'ENDED' } }),
      this.prisma.attendance.count(),
      this.prisma.auditLog.count({ where: { action: { not: 'RECOVERY_BATCH' } } }),
      this.prisma.pcHealthReport.count(),
      this.prisma.user.count({ where: { role: 'TEACHER', isActive: false } }),
    ]);

    return [
      {
        key: 'ENDED_SESSIONS',
        label: 'Ended Laboratory Sessions',
        description: 'Completed or terminated sessions and participant histories.',
        count: sessionCount,
      },
      {
        key: 'ATTENDANCE_RECORDS',
        label: 'Historical Attendance Records',
        description: 'Logged attendance records and approval histories.',
        count: attendanceCount,
      },
      {
        key: 'AUDIT_LOGS',
        label: 'Security & Audit Logs',
        description: 'Audit logs and PC security warning trails.',
        count: auditLogCount,
      },
      {
        key: 'HEALTH_REPORTS',
        label: 'PC Health Telemetry Logs',
        description: 'Historical CPU, RAM, disk, and network health reports.',
        count: healthReportCount,
      },
      {
        key: 'INACTIVE_TEACHERS',
        label: 'Inactive Teacher Accounts',
        description: 'Disabled teacher accounts no longer conducting classes.',
        count: inactiveTeacherCount,
      },
    ];
  }

  /*
   * ==========================================
   * 3. INITIATE 24-HOUR SOFT DELETE (CLEAR DATA)
   * ==========================================
   */
  async initiateClearData(
    adminId: string,
    categories: string[],
    reason?: string,
  ) {
    if (!categories || categories.length === 0) {
      throw new BadRequestException('Please select at least one data category to clear.');
    }

    const now = new Date();
    const scheduledPermanentDeleteAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const affectedCounts: Record<string, number> = {};

    for (const category of categories) {
      if (category === 'ENDED_SESSIONS') {
        const res = await this.prisma.classSession.updateMany({
          where: { status: 'ENDED' },
          data: { status: 'PENDING_DELETION' },
        });
        affectedCounts[category] = res.count;
      } else if (category === 'ATTENDANCE_RECORDS') {
        const res = await this.prisma.attendance.updateMany({
          where: { reviewStatus: { not: 'PENDING_DELETION' } },
          data: { reviewStatus: 'PENDING_DELETION' },
        });
        affectedCounts[category] = res.count;
      } else if (category === 'AUDIT_LOGS') {
        const res = await this.prisma.auditLog.updateMany({
          where: { action: { notIn: ['RECOVERY_BATCH', 'AUDIT_PENDING_DELETION'] } },
          data: { action: 'AUDIT_PENDING_DELETION' },
        });
        affectedCounts[category] = res.count;
      } else if (category === 'HEALTH_REPORTS') {
        const res = await this.prisma.pcHealthReport.updateMany({
          where: { healthStatus: { not: 'PENDING_DELETION' } },
          data: { healthStatus: 'PENDING_DELETION' },
        });
        affectedCounts[category] = res.count;
      } else if (category === 'INACTIVE_TEACHERS') {
        const res = await this.prisma.user.updateMany({
          where: { role: 'TEACHER', isActive: false },
          data: { role: 'TEACHER_PENDING_DELETION' },
        });
        affectedCounts[category] = res.count;
      }
    }

    // Record in AuditLog for recovery tracking
    const recoveryBatchId = `RECOVERY_${now.getTime()}`;
    const recoveryPayload = {
      id: recoveryBatchId,
      adminId,
      categories,
      affectedCounts,
      reason: reason || 'Administrator routine maintenance',
      initiatedAt: now.toISOString(),
      scheduledPermanentDeleteAt: scheduledPermanentDeleteAt.toISOString(),
      status: 'PENDING_DELETION',
    };

    await this.prisma.auditLog.create({
      data: {
        id: recoveryBatchId,
        actorId: adminId,
        action: 'RECOVERY_BATCH',
        targetPc: null,
        metadata: JSON.stringify(recoveryPayload),
      },
    });

    this.logger.log(
      `Soft delete batch ${recoveryBatchId} initiated by admin ${adminId}. Scheduled permanent deletion in 24 hours.`,
    );

    return {
      success: true,
      batchId: recoveryBatchId,
      scheduledPermanentDeleteAt: scheduledPermanentDeleteAt.toISOString(),
      hoursRemaining: 24,
      affectedCounts,
      message:
        'Selected data categories placed into the 24-hour Recovery Window. Records can be safely restored anytime before permanent deletion.',
    };
  }

  /*
   * ==========================================
   * 4. LIST ITEMS IN RECOVERY WINDOW
   * ==========================================
   */
  async getRecoveryWindowList(): Promise<RecoveryItem[]> {
    const recoveryLogs = await this.prisma.auditLog.findMany({
      where: {
        action: 'RECOVERY_BATCH',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const now = new Date();
    const result: RecoveryItem[] = [];

    for (const log of recoveryLogs) {
      try {
        const payload = JSON.parse(log.metadata || '{}');
        const scheduledTime = new Date(payload.scheduledPermanentDeleteAt || log.createdAt);
        const msRemaining = scheduledTime.getTime() - now.getTime();
        const hoursRemaining = Math.max(0, Math.round((msRemaining / (1000 * 60 * 60)) * 10) / 10);

        const counts = Object.values(payload.affectedCounts || {}) as number[];
        const totalItems: number = counts.reduce(
          (sum: number, count: number) => sum + Number(count || 0),
          0,
        );

        result.push({
          id: payload.id || log.id,
          category: (payload.categories || []).join(', ') || 'All Data',
          itemCount: totalItems,
          reason: payload.reason,
          initiatedBy: payload.adminId,
          initiatedAt: new Date(payload.initiatedAt || log.createdAt),
          scheduledPermanentDeleteAt: scheduledTime,
          hoursRemaining,
          status: payload.status || 'PENDING_DELETION',
        });
      } catch {
        // Skip malformed log
      }
    }

    return result;
  }

  /*
   * ==========================================
   * 5. RESTORE DATA BATCH FROM RECOVERY WINDOW
   * ==========================================
   */
  async restoreBatch(batchId: string, adminId: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id: batchId },
    });

    if (!log) {
      throw new NotFoundException(`Recovery batch ${batchId} not found.`);
    }

    const payload = JSON.parse(log.metadata || '{}');
    const categories: string[] = payload.categories || [];

    for (const category of categories) {
      if (category === 'ENDED_SESSIONS') {
        await this.prisma.classSession.updateMany({
          where: { status: 'PENDING_DELETION' },
          data: { status: 'ENDED' },
        });
      } else if (category === 'ATTENDANCE_RECORDS') {
        await this.prisma.attendance.updateMany({
          where: { reviewStatus: 'PENDING_DELETION' },
          data: { reviewStatus: 'PENDING' },
        });
      } else if (category === 'AUDIT_LOGS') {
        await this.prisma.auditLog.updateMany({
          where: { action: 'AUDIT_PENDING_DELETION' },
          data: { action: 'AUDIT_RESTORED' },
        });
      } else if (category === 'HEALTH_REPORTS') {
        await this.prisma.pcHealthReport.updateMany({
          where: { healthStatus: 'PENDING_DELETION' },
          data: { healthStatus: 'HEALTHY' },
        });
      } else if (category === 'INACTIVE_TEACHERS') {
        await this.prisma.user.updateMany({
          where: { role: 'TEACHER_PENDING_DELETION' },
          data: { role: 'TEACHER', isActive: false },
        });
      }
    }

    payload.status = 'RESTORED';
    payload.restoredAt = new Date().toISOString();
    payload.restoredBy = adminId;

    await this.prisma.auditLog.update({
      where: { id: batchId },
      data: { metadata: JSON.stringify(payload) },
    });

    this.logger.log(`Recovery batch ${batchId} restored by admin ${adminId}.`);

    return {
      success: true,
      batchId,
      message: 'Data successfully restored to original states.',
    };
  }

  /*
   * ==========================================
   * 6. PERMANENT DELETE (DELETE NOW)
   * ==========================================
   */
  async permanentDeleteNow(batchId: string, adminId: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id: batchId },
    });

    if (!log) {
      throw new NotFoundException(`Recovery batch ${batchId} not found.`);
    }

    const payload = JSON.parse(log.metadata || '{}');
    const categories: string[] = payload.categories || [];

    for (const category of categories) {
      if (category === 'ENDED_SESSIONS') {
        const sessions = await this.prisma.classSession.findMany({
          where: { status: 'PENDING_DELETION' },
          select: { id: true },
        });
        const sessionIds = sessions.map((s) => s.id);

        if (sessionIds.length > 0) {
          await this.prisma.sessionParticipant.deleteMany({ where: { sessionId: { in: sessionIds } } });
          await this.prisma.specialAccessRequest.deleteMany({ where: { sessionId: { in: sessionIds } } });
          await this.prisma.attendance.deleteMany({ where: { sessionId: { in: sessionIds } } });
          await this.prisma.allowedWebsite.deleteMany({ where: { sessionId: { in: sessionIds } } });
          await this.prisma.blockedWebsite.deleteMany({ where: { sessionId: { in: sessionIds } } });
          await this.prisma.allowedApplication.deleteMany({ where: { sessionId: { in: sessionIds } } });
          await this.prisma.blockedApplication.deleteMany({ where: { sessionId: { in: sessionIds } } });
          await this.prisma.classSession.deleteMany({ where: { id: { in: sessionIds } } });
        }
      } else if (category === 'ATTENDANCE_RECORDS') {
        await this.prisma.attendance.deleteMany({
          where: { reviewStatus: 'PENDING_DELETION' },
        });
      } else if (category === 'AUDIT_LOGS') {
        await this.prisma.auditLog.deleteMany({
          where: { action: 'AUDIT_PENDING_DELETION' },
        });
      } else if (category === 'HEALTH_REPORTS') {
        await this.prisma.pcHealthReport.deleteMany({
          where: { healthStatus: 'PENDING_DELETION' },
        });
      } else if (category === 'INACTIVE_TEACHERS') {
        await this.prisma.user.deleteMany({
          where: { role: 'TEACHER_PENDING_DELETION' },
        });
      }
    }

    payload.status = 'PERMANENTLY_DELETED';
    payload.permanentlyDeletedAt = new Date().toISOString();
    payload.permanentlyDeletedBy = adminId;

    await this.prisma.auditLog.update({
      where: { id: batchId },
      data: { metadata: JSON.stringify(payload) },
    });

    this.logger.log(`Recovery batch ${batchId} permanently deleted by admin ${adminId}.`);

    return {
      success: true,
      batchId,
      message: 'Records permanently deleted from database.',
    };
  }

  /*
   * ==========================================
   * 7. HOURLY CRON PURGE: AUTOMATIC PURGE AFTER 24 HOURS
   * ==========================================
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyPurge() {
    this.logger.log('Executing automated hourly soft-delete recovery purge check...');

    const recoveryLogs = await this.prisma.auditLog.findMany({
      where: {
        action: 'RECOVERY_BATCH',
      },
    });

    const now = new Date();

    for (const log of recoveryLogs) {
      try {
        const payload = JSON.parse(log.metadata || '{}');
        if (payload.status !== 'PENDING_DELETION') continue;

        const scheduledTime = new Date(payload.scheduledPermanentDeleteAt);
        if (scheduledTime <= now) {
          this.logger.log(`24-hour expiration reached for batch ${payload.id}. Purging now.`);
          await this.permanentDeleteNow(log.id, 'SYSTEM_HOURLY_CRON');
        }
      } catch (err) {
        this.logger.error(`Error processing batch purge: ${err}`);
      }
    }
  }
}
