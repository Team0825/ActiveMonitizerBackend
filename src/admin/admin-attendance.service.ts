import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminAttendanceService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /*
   * ============================================================
   * OVERALL ATTENDANCE OVERVIEW
   * ============================================================
   *
   * Used by:
   *
   * GET /admin/attendance/overview
   *
   * Returns:
   *
   * - Present
   * - Absent
   * - Total
   * - Pending review
   * - Approved
   * - Rejected
   *
   * Used for Admin Dashboard / Attendance Pie Charts.
   * ============================================================
   */

  async overview() {
    const [
      present,
      absent,
      pending,
      approved,
      rejected,
    ] = await Promise.all([
      this.prisma.attendance.count({
        where: {
          isPresent: true,
          computedAt: {
            not: null,
          },
        },
      }),

      this.prisma.attendance.count({
        where: {
          isPresent: false,
          computedAt: {
            not: null,
          },
        },
      }),

      this.prisma.attendance.count({
        where: {
          reviewStatus: 'PENDING',
        },
      }),

      this.prisma.attendance.count({
        where: {
          reviewStatus: {
            in: [
              'APPROVED',
              'AUTO_APPROVED',
            ],
          },
        },
      }),

      this.prisma.attendance.count({
        where: {
          reviewStatus: {
            in: [
              'REJECTED',
              'AUTO_REJECTED',
            ],
          },
        },
      }),
    ]);

    return {
      present,
      absent,

      total:
        present +
        absent,

      pending,
      approved,
      rejected,
    };
  }

  /*
   * ============================================================
   * FULL ATTENDANCE DIRECTORY
   * ============================================================
   *
   * Used by:
   *
   * GET /admin/attendance
   *
   * Optional filters:
   *
   * ?classId=CSE
   * ?search=RAJ
   *
   * Search supports:
   *
   * - Username
   * - Name
   * - Registration Number
   *
   * This data will be used by the Admin Attendance table.
   * ============================================================
   */

  async listAttendance(
    classId?: string,
    search?: string,
  ) {
    const cleanSearch =
      search?.trim();

    const records =
      await this.prisma.attendance.findMany({
        where: {
          student: {
            role: 'STUDENT',

            ...(classId
              ? {
                  classId,
                }
              : {}),

            ...(cleanSearch
              ? {
                  OR: [
                    {
                      username: {
                        contains:
                          cleanSearch,
                      },
                    },

                    {
                      name: {
                        contains:
                          cleanSearch,
                      },
                    },

                    {
                      regNumber: {
                        contains:
                          cleanSearch,
                      },
                    },
                  ],
                }
              : {}),
          },
        },

        include: {
          student: {
            select: {
              id: true,
              username: true,
              name: true,
              regNumber: true,
              mobile: true,
              email: true,
              classId: true,
              isActive: true,
            },
          },

          session: {
            select: {
              id: true,
              sessionCode: true,
              classTitle: true,
              teacherId: true,
              status: true,
              createdAt: true,
              endsAt: true,
            },
          },
        },

        orderBy: {
          computedAt:
            'desc',
        },
      });

    return records;
  }

  /*
   * ============================================================
   * ATTENDANCE BY CLASS / DEPARTMENT
   * ============================================================
   *
   * Used by:
   *
   * GET /admin/attendance/class/:classId
   *
   * Returns summary information for one class.
   * ============================================================
   */

  async byClass(
    classId: string,
  ) {
    const students =
      await this.prisma.user.findMany({
        where: {
          role: 'STUDENT',
          classId,
        },

        select: {
          id: true,
        },
      });

    const studentIds =
      students.map(
        (student) =>
          student.id,
      );

    const [
      present,
      absent,
      pending,
    ] =
      await Promise.all([
        this.prisma.attendance.count(
          {
            where: {
              studentId: {
                in: studentIds,
              },

              isPresent: true,

              computedAt: {
                not: null,
              },
            },
          },
        ),

        this.prisma.attendance.count(
          {
            where: {
              studentId: {
                in: studentIds,
              },

              isPresent: false,

              computedAt: {
                not: null,
              },
            },
          },
        ),

        this.prisma.attendance.count(
          {
            where: {
              studentId: {
                in: studentIds,
              },

              reviewStatus:
                'PENDING',
            },
          },
        ),
      ]);

    const total =
      present +
      absent;

    const attendancePercent =
      total > 0
        ? Math.round(
            (present /
              total) *
              100,
          )
        : 0;

    return {
      classId,

      students:
        studentIds.length,

      present,

      absent,

      total,

      pending,

      attendancePercent,
    };
  }

  /*
   * ============================================================
   * ATTENDANCE BY STUDENT
   * ============================================================
   *
   * Used by:
   *
   * GET /admin/attendance/student/:studentId
   *
   * Returns:
   *
   * - Student details
   * - Attendance history
   * - Overall attendance %
   * - Average PC activity %
   * - Average activity score
   * - Total warnings
   * ============================================================
   */

  async byStudent(
    studentId: string,
  ) {
    const student =
      await this.prisma.user.findUnique({
        where: {
          id: studentId,
        },

        select: {
          id: true,
          role: true,
          username: true,
          name: true,
          regNumber: true,
          mobile: true,
          email: true,
          classId: true,
          isActive: true,
        },
      });

    if (
      !student ||
      student.role !==
        'STUDENT'
    ) {
      throw new NotFoundException(
        'Student not found',
      );
    }

    const records =
      await this.prisma.attendance.findMany({
        where: {
          studentId,
        },

        include: {
          session: {
            select: {
              id: true,
              sessionCode: true,
              classTitle: true,
              status: true,
              createdAt: true,
              endsAt: true,
            },
          },
        },

        orderBy: {
          computedAt:
            'desc',
        },
      });

    /*
     * Count completed attendance records.
     */

    const computedRecords =
      records.filter(
        (record) =>
          record.computedAt !==
          null,
      );

    const present =
      computedRecords.filter(
        (record) =>
          record.isPresent,
      ).length;

    const absent =
      computedRecords.length -
      present;

    const total =
      computedRecords.length;

    /*
     * Attendance percentage.
     */

    const attendancePercent =
      total > 0
        ? Math.round(
            (present /
              total) *
              100,
          )
        : 0;

   /*
 * ============================================================
 * AVERAGE PC / STUDENT ACTIVITY
 * ============================================================
 *
 * The Prisma Attendance model currently uses:
 *
 * activityPercent
 *
 * This represents the detected PC/student activity
 * percentage during the session.
 * ============================================================
 */

const recordsWithActivity =
  records.filter(
    (record) =>
      record.activityPercent !== null,
  );

const averageActivityPercent =
  recordsWithActivity.length > 0
    ? Math.round(
        recordsWithActivity.reduce(
          (sum, record) =>
            sum +
            (record.activityPercent ?? 0),
          0,
        ) /
          recordsWithActivity.length,
      )
    : 0;

/*
 * ============================================================
 * TOTAL WARNINGS
 * ============================================================
 */

const totalWarnings =
  records.reduce(
    (sum, record) =>
      sum +
      record.warningCount,
    0,
  );

    return {
      student,

  summary: {
  present,
  absent,
  total,

  /*
   * Overall attendance percentage
   * calculated from Present / Total.
   */
  attendancePercent,

  /*
   * Average PC/student activity
   * across all session records.
   */
  averageActivityPercent,

  /*
   * Total warnings accumulated
   * across all sessions.
   */
  totalWarnings,
},
      records,
    };
  }

  /*
   * ============================================================
   * MANUALLY APPROVE ATTENDANCE
   * ============================================================
   *
   * Used by:
   *
   * PATCH /admin/attendance/:attendanceId/approve
   *
   * Admin manually approves the attendance.
   * ============================================================
   */

  async approveAttendance(
    attendanceId: string,
    adminId: string,
    reason?: string,
  ) {
    const attendance =
      await this.prisma.attendance.findUnique({
        where: {
          id: attendanceId,
        },
      });

    if (!attendance) {
      throw new NotFoundException(
        'Attendance record not found',
      );
    }

    return this.prisma.attendance.update({
      where: {
        id: attendanceId,
      },

      data: {
        /*
         * Final attendance becomes present.
         */

        isPresent: true,

        /*
         * Manual review result.
         */

        reviewStatus:
          'APPROVED',

        /*
         * Admin who approved it.
         */

        reviewedById:
          adminId,

        /*
         * Decision timestamp.
         */

        reviewedAt:
          new Date(),

        /*
         * Manual decision.
         */

        autoReviewed:
          false,

        /*
         * Optional reason.
         */

        reviewReason:
          reason?.trim() ||
          'Approved manually by Admin',
      },
    });
  }

  /*
   * ============================================================
   * MANUALLY REJECT ATTENDANCE
   * ============================================================
   *
   * Used by:
   *
   * PATCH /admin/attendance/:attendanceId/reject
   *
   * Admin manually rejects the attendance.
   * ============================================================
   */

  async rejectAttendance(
    attendanceId: string,
    adminId: string,
    reason?: string,
  ) {
    const attendance =
      await this.prisma.attendance.findUnique({
        where: {
          id: attendanceId,
        },
      });

    if (!attendance) {
      throw new NotFoundException(
        'Attendance record not found',
      );
    }

    return this.prisma.attendance.update({
      where: {
        id: attendanceId,
      },

      data: {
        /*
         * Final attendance becomes absent.
         */

        isPresent: false,

        /*
         * Manual review result.
         */

        reviewStatus:
          'REJECTED',

        /*
         * Admin who rejected it.
         */

        reviewedById:
          adminId,

        /*
         * Decision timestamp.
         */

        reviewedAt:
          new Date(),

        /*
         * Manual decision.
         */

        autoReviewed:
          false,

        /*
         * Optional reason.
         */

        reviewReason:
          reason?.trim() ||
          'Rejected manually by Admin',
      },
    });
  }

  /*
   * ============================================================
   * 8. ATTENDANCE AUTO APPROVAL & SETTINGS (ITEM 23)
   * ============================================================
   */

  private attendanceSettings = {
    minAttendancePercent: 75,
    minActivityPercent: 50,
    autoReviewEnabled: true,
    unreviewedHoursThreshold: 48,
    reviewWindowHours: 24,
  };

  async getSettings() {
    return { ...this.attendanceSettings };
  }

  async updateSettings(dto: {
    minAttendancePercent?: number;
    minActivityPercent?: number;
    autoReviewEnabled?: boolean;
    unreviewedHoursThreshold?: number;
    reviewWindowHours?: number;
  }) {
    if (dto.minAttendancePercent !== undefined) {
      this.attendanceSettings.minAttendancePercent = Math.max(1, Math.min(100, dto.minAttendancePercent));
    }
    if (dto.minActivityPercent !== undefined) {
      this.attendanceSettings.minActivityPercent = Math.max(1, Math.min(100, dto.minActivityPercent));
    }
    if (dto.autoReviewEnabled !== undefined) {
      this.attendanceSettings.autoReviewEnabled = Boolean(dto.autoReviewEnabled);
    }
    return { success: true, settings: this.attendanceSettings };
  }

  async runAutoAttendanceReview() {
    const cutoffDate = new Date(Date.now() - this.attendanceSettings.unreviewedHoursThreshold * 60 * 60 * 1000);

    const pendingRecords = await this.prisma.attendance.findMany({
      where: {
        reviewStatus: 'PENDING',
        OR: [
          { computedAt: { lte: cutoffDate } },
          { autoReviewAt: { lte: new Date() } },
        ],
      },
      include: {
        student: { select: { id: true, name: true, username: true, regNumber: true } },
        session: { select: { id: true, sessionCode: true, classTitle: true } },
      },
    });

    let autoApprovedCount = 0;
    let autoRejectedCount = 0;

    for (const record of pendingRecords) {
      const attPct = record.attendancePercent ?? 0;
      const actPct = record.activityPercent ?? 0;
      const qualifies =
        attPct >= this.attendanceSettings.minAttendancePercent &&
        actPct >= this.attendanceSettings.minActivityPercent;

      const newStatus = qualifies ? 'AUTO_APPROVED' : 'AUTO_REJECTED';
      const reason = qualifies
        ? `Auto-approved after 48h unreviewed. Criteria met: Attendance ${attPct}% (>=${this.attendanceSettings.minAttendancePercent}%), Activity ${actPct}% (>=${this.attendanceSettings.minActivityPercent}%).`
        : `Auto-rejected after 48h unreviewed. Below criteria: Attendance ${attPct}% / Activity ${actPct}%.`;

      await this.prisma.attendance.update({
        where: { id: record.id },
        data: {
          isPresent: qualifies,
          reviewStatus: newStatus,
          autoReviewed: true,
          reviewReason: reason,
          reviewedAt: new Date(),
          reviewedById: 'SYSTEM_AUTOMATION',
        },
      });

      await this.prisma.auditLog.create({
        data: {
          actorId: 'SYSTEM_AUTOMATION',
          action: newStatus,
          targetPc: record.student?.username || record.studentId,
          metadata: JSON.stringify({
            attendanceId: record.id,
            studentId: record.studentId,
            sessionId: record.sessionId,
            rule: `48H_UNREVIEWED_THRESHOLD_${this.attendanceSettings.minAttendancePercent}%`,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      if (qualifies) autoApprovedCount++;
      else autoRejectedCount++;
    }

    return {
      evaluatedCount: pendingRecords.length,
      autoApprovedCount,
      autoRejectedCount,
      timestamp: new Date().toISOString(),
    };
  }

  async getAutoGeneratedAttendance() {
    const reviewWindowCutoff = new Date(
      Date.now() - this.attendanceSettings.reviewWindowHours * 60 * 60 * 1000,
    );

    const records = await this.prisma.attendance.findMany({
      where: {
        autoReviewed: true,
        reviewedAt: { gte: reviewWindowCutoff },
      },
      include: {
        student: { select: { id: true, name: true, username: true, regNumber: true } },
        session: { select: { id: true, sessionCode: true, classTitle: true } },
      },
      orderBy: { reviewedAt: 'desc' },
    });

    return {
      reviewWindowHours: this.attendanceSettings.reviewWindowHours,
      totalAutoGenerated: records.length,
      records: records.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        studentName: r.student.name || r.student.username,
        regNumber: r.student.regNumber || '—',
        sessionId: r.sessionId,
        sessionCode: r.session?.sessionCode || '—',
        classTitle: r.session?.classTitle || '—',
        isPresent: r.isPresent,
        reviewStatus: r.reviewStatus,
        attendancePercent: r.attendancePercent,
        activityPercent: r.activityPercent,
        overallPercent: r.overallPercent,
        autoReviewed: true,
        reviewReason: r.reviewReason,
        generatedAt: r.reviewedAt,
        windowExpiresAt: r.reviewedAt
          ? new Date(r.reviewedAt.getTime() + this.attendanceSettings.reviewWindowHours * 60 * 60 * 1000)
          : null,
      })),
    };
  }
}