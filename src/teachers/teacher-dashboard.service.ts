import {
  Injectable,
} from '@nestjs/common';

import {
  PrismaService,
} from '../prisma/prisma.service';

@Injectable()
export class TeacherDashboardService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  /*
   * ==========================================================
   * TEACHER DASHBOARD OVERVIEW
   * ==========================================================
   *
   * Returns dashboard information specifically for
   * the currently logged-in Teacher.
   *
   * teacherId comes from:
   *
   * req.user.sub
   *
   * Therefore a Teacher can only receive dashboard
   * information related to their own account.
   * ==========================================================
   */

  async overview(
    teacherId: string,
  ) {
    /*
     * --------------------------------------------------------
     * TOTAL STUDENTS
     * --------------------------------------------------------
     *
     * Currently counts all active Students.
     *
     * Later we can restrict this to only Students belonging
     * to classes/sessions managed by this Teacher.
     */

    const totalStudents =
      await this.prisma.user.count({
        where: {
          role: 'STUDENT',
          isActive: true,
        },
      });

    /*
     * --------------------------------------------------------
     * TEACHER'S ACTIVE SESSIONS
     * --------------------------------------------------------
     */

    const activeSessions =
      await this.prisma.classSession.count({
        where: {
          teacherId,
          status: 'ACTIVE',
        },
      });

    /*
     * --------------------------------------------------------
     * TEACHER'S TOTAL SESSIONS
     * --------------------------------------------------------
     */

    const totalSessions =
      await this.prisma.classSession.count({
        where: {
          teacherId,
        },
      });

    /*
     * --------------------------------------------------------
     * TEACHER'S SESSION IDS
     * --------------------------------------------------------
     *
     * Used to find attendance records belonging only
     * to Sessions created/managed by this Teacher.
     */

    const teacherSessions =
      await this.prisma.classSession.findMany({
        where: {
          teacherId,
        },

        select: {
          id: true,
        },
      });

    const teacherSessionIds =
      teacherSessions.map(
        (session) =>
          session.id,
      );

    /*
     * --------------------------------------------------------
     * PENDING ATTENDANCE
     * --------------------------------------------------------
     */

    const pendingAttendance =
      teacherSessionIds.length > 0
        ? await this.prisma.attendance.count({
            where: {
              sessionId: {
                in: teacherSessionIds,
              },

              reviewStatus:
                'PENDING',
            },
          })
        : 0;

    /*
     * --------------------------------------------------------
     * ONLINE PCS
     * --------------------------------------------------------
     *
     * For now this counts all ONLINE PCs.
     *
     * Later, when the Windows PC Agent is connected,
     * we can filter these by Teacher Session.
     */

    const onlinePcs =
      await this.prisma.pc.count({
        where: {
          status: 'ONLINE',
        },
      });

    /*
     * --------------------------------------------------------
     * RECENT TEACHER SESSIONS
     * --------------------------------------------------------
     */

    const recentSessions =
      await this.prisma.classSession.findMany({
        where: {
          teacherId,
        },

        orderBy: {
          createdAt: 'desc',
        },

        take: 5,

        select: {
          id: true,
          sessionCode: true,
          classTitle: true,
          status: true,
          createdAt: true,
          endsAt: true,
          durationMinutes: true,

          _count: {
            select: {
              participants: true,
            },
          },
        },
      });

    /*
     * --------------------------------------------------------
     * RESPONSE
     * --------------------------------------------------------
     */

    return {
      totalStudents,
      activeSessions,
      totalSessions,
      pendingAttendance,
      onlinePcs,
      recentSessions,
    };
  }
}