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
}