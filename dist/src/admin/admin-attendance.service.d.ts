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
}
