import { PrismaService } from '../prisma/prisma.service';
export declare class AdminAttendanceService {
    private readonly prisma;
    constructor(prisma: PrismaService);
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
            status: string;
            sessionCode: string;
            classTitle: string;
            teacherId: string;
            endsAt: Date;
        };
        student: {
            id: string;
            name: string | null;
            isActive: boolean;
            username: string;
            regNumber: string | null;
            email: string | null;
            mobile: string | null;
            classId: string | null;
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
            name: string | null;
            isActive: boolean;
            username: string;
            regNumber: string | null;
            email: string | null;
            role: string;
            mobile: string | null;
            classId: string | null;
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
                status: string;
                sessionCode: string;
                classTitle: string;
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
    approveAttendance(attendanceId: string, adminId: string, reason?: string): Promise<{
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
    rejectAttendance(attendanceId: string, adminId: string, reason?: string): Promise<{
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
    private attendanceSettings;
    getSettings(): Promise<{
        minAttendancePercent: number;
        minActivityPercent: number;
        autoReviewEnabled: boolean;
        unreviewedHoursThreshold: number;
        reviewWindowHours: number;
    }>;
    updateSettings(dto: {
        minAttendancePercent?: number;
        minActivityPercent?: number;
        autoReviewEnabled?: boolean;
        unreviewedHoursThreshold?: number;
        reviewWindowHours?: number;
    }): Promise<{
        success: boolean;
        settings: {
            minAttendancePercent: number;
            minActivityPercent: number;
            autoReviewEnabled: boolean;
            unreviewedHoursThreshold: number;
            reviewWindowHours: number;
        };
    }>;
    runAutoAttendanceReview(): Promise<{
        evaluatedCount: number;
        autoApprovedCount: number;
        autoRejectedCount: number;
        timestamp: string;
    }>;
    getAutoGeneratedAttendance(): Promise<{
        reviewWindowHours: number;
        totalAutoGenerated: number;
        records: {
            id: string;
            studentId: string;
            studentName: string;
            regNumber: string;
            sessionId: string;
            sessionCode: string;
            classTitle: string;
            isPresent: boolean;
            reviewStatus: string;
            attendancePercent: number;
            activityPercent: number;
            overallPercent: number;
            autoReviewed: boolean;
            reviewReason: string | null;
            generatedAt: Date | null;
            windowExpiresAt: Date | null;
        }[];
    }>;
}
