import { PrismaService } from '../prisma/prisma.service';
export declare class TeacherDashboardService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    overview(teacherId: string): Promise<{
        totalStudents: number;
        activeSessions: number;
        totalSessions: number;
        pendingAttendance: number;
        onlinePcs: number;
        recentSessions: {
            id: string;
            createdAt: Date;
            classTitle: string;
            durationMinutes: number;
            sessionCode: string;
            status: string;
            endsAt: Date;
            _count: {
                participants: number;
            };
        }[];
    }>;
}
