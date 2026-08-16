import { Request } from 'express';
import { JwtPayload } from '../auth/jwt.strategy';
import { AdminAttendanceService } from './admin-attendance.service';
type AuthenticatedRequest = Request & {
    user: JwtPayload;
};
type AttendanceDecisionDto = {
    reason?: string;
};
export declare class AdminAttendanceController {
    private readonly attendanceService;
    constructor(attendanceService: AdminAttendanceService);
    overview(): Promise<{
        present: number;
        absent: number;
        total: number;
        pending: number;
        approved: number;
        rejected: number;
    }>;
    listAttendance(classId?: string, search?: string): Promise<({
        session: {
            id: string;
            createdAt: Date;
            sessionCode: string;
            classTitle: string;
            teacherId: string;
            status: string;
            endsAt: Date;
        };
        student: {
            id: string;
            username: string;
            regNumber: string | null;
            email: string | null;
            name: string | null;
            mobile: string | null;
            classId: string | null;
            isActive: boolean;
        };
    } & {
        id: string;
        sessionId: string;
        studentId: string;
        presentSeconds: number;
        requiredSeconds: number;
        isPresent: boolean;
        attendancePercent: number;
        activityPercent: number;
        overallPercent: number;
        warningCount: number;
        reviewStatus: string;
        reviewedById: string | null;
        autoReviewAt: Date | null;
        reviewedAt: Date | null;
        autoReviewed: boolean;
        reviewReason: string | null;
        computedAt: Date | null;
    })[]>;
    byClass(classId: string): Promise<{
        classId: string;
        students: number;
        present: number;
        absent: number;
        total: number;
        pending: number;
        attendancePercent: number;
    }>;
    byStudent(studentId: string): Promise<{
        student: {
            id: string;
            username: string;
            regNumber: string | null;
            email: string | null;
            role: string;
            name: string | null;
            mobile: string | null;
            classId: string | null;
            isActive: boolean;
        };
        summary: {
            present: number;
            absent: number;
            total: number;
            attendancePercent: number;
            averageActivityPercent: number;
            totalWarnings: number;
        };
        records: ({
            session: {
                id: string;
                createdAt: Date;
                sessionCode: string;
                classTitle: string;
                status: string;
                endsAt: Date;
            };
        } & {
            id: string;
            sessionId: string;
            studentId: string;
            presentSeconds: number;
            requiredSeconds: number;
            isPresent: boolean;
            attendancePercent: number;
            activityPercent: number;
            overallPercent: number;
            warningCount: number;
            reviewStatus: string;
            reviewedById: string | null;
            autoReviewAt: Date | null;
            reviewedAt: Date | null;
            autoReviewed: boolean;
            reviewReason: string | null;
            computedAt: Date | null;
        })[];
    }>;
    approveAttendance(req: AuthenticatedRequest, attendanceId: string, dto: AttendanceDecisionDto): Promise<{
        id: string;
        sessionId: string;
        studentId: string;
        presentSeconds: number;
        requiredSeconds: number;
        isPresent: boolean;
        attendancePercent: number;
        activityPercent: number;
        overallPercent: number;
        warningCount: number;
        reviewStatus: string;
        reviewedById: string | null;
        autoReviewAt: Date | null;
        reviewedAt: Date | null;
        autoReviewed: boolean;
        reviewReason: string | null;
        computedAt: Date | null;
    }>;
    rejectAttendance(req: AuthenticatedRequest, attendanceId: string, dto: AttendanceDecisionDto): Promise<{
        id: string;
        sessionId: string;
        studentId: string;
        presentSeconds: number;
        requiredSeconds: number;
        isPresent: boolean;
        attendancePercent: number;
        activityPercent: number;
        overallPercent: number;
        warningCount: number;
        reviewStatus: string;
        reviewedById: string | null;
        autoReviewAt: Date | null;
        reviewedAt: Date | null;
        autoReviewed: boolean;
        reviewReason: string | null;
        computedAt: Date | null;
    }>;
}
export {};
