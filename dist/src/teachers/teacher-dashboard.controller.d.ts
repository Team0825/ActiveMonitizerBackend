import { Request } from 'express';
import { JwtPayload } from '../auth/jwt.strategy';
import { TeacherDashboardService } from './teacher-dashboard.service';
type AuthenticatedTeacherRequest = Request & {
    user: JwtPayload;
};
export declare class TeacherDashboardController {
    private readonly dashboardService;
    constructor(dashboardService: TeacherDashboardService);
    overview(req: AuthenticatedTeacherRequest): Promise<{
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
export {};
