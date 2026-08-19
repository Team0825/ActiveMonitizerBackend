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
            status: string;
            sessionCode: string;
            classTitle: string;
            durationMinutes: number;
            endsAt: Date;
            _count: {
                participants: number;
            };
        }[];
    }>;
}
