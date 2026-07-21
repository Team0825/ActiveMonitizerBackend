import { Request } from 'express';
import { JwtPayload } from '../auth/jwt.strategy';
import { SessionsService } from './sessions.service';
import { CreateSessionDto, HandleAccessRequestDto, JoinSessionDto, RequestSpecialAccessDto } from './dto/session.dto';
type AuthenticatedRequest = Request & {
    user: JwtPayload;
};
type TeacherAdminRequest = Request & {
    user: JwtPayload & {
        role: 'TEACHER' | 'ADMIN';
    };
};
export declare class StudentSessionController {
    private readonly sessionsService;
    constructor(sessionsService: SessionsService);
    studentLogin(dto: JoinSessionDto): Promise<{
        success: boolean;
        requiresSpecialAccess: boolean;
        message: string;
        accessRequest: {
            id: string;
            status: string;
        };
        student: {
            id: string;
            username: string;
            regNumber: string | null;
            classId: string | null;
        };
        session: {
            id: string;
            sessionCode: string;
            sessionId: string;
            classTitle: string;
            endsAt: Date;
        };
    } | {
        session: {
            id: string;
            sessionCode: string;
            sessionId: string;
            classTitle: string;
            durationMinutes: number;
            joinWindowMinutes: number;
            createdAt: Date;
            endsAt: Date;
            status: string;
            allowedSites: any;
            blockedSites: any;
        };
        participant: {
            id: string;
            sessionId: string;
            pcHostname: string | null;
            studentId: string;
            joinedAt: Date;
            leftAt: Date | null;
            approvedLate: boolean;
        };
        success: boolean;
        message: string;
        sessionAccessToken: string;
        student: {
            id: string;
            username: string;
            regNumber: string | null;
            classId: string | null;
        };
        requiresSpecialAccess?: undefined;
        accessRequest?: undefined;
    }>;
}
export declare class SessionsController {
    private readonly sessionsService;
    constructor(sessionsService: SessionsService);
    getSessions(req: TeacherAdminRequest): Promise<{
        id: string;
        sessionId: string;
        sessionCode: string;
        classTitle: string;
        durationMinutes: number;
        joinWindowMinutes: number;
        createdAt: Date;
        endsAt: Date;
        status: string;
        teacherId: string;
        participantCount: number;
        allowedSites: string[];
        blockedSites: string[];
    }[]>;
    create(req: TeacherAdminRequest, dto: CreateSessionDto): Promise<{
        sessionId: string;
        allowedSites: any;
        blockedSites: any;
        id: string;
        createdAt: Date;
        classTitle: string;
        durationMinutes: number;
        joinWindowMinutes: number;
        sessionMode: string;
        allowOffline: boolean;
        restrictExistingFiles: boolean;
        restrictUnauthorizedApps: boolean;
        freezeOnEnd: boolean;
        warningMinutes: number;
        instructions: string | null;
        questionMode: string;
        sessionCode: string;
        teacherId: string;
        status: string;
        endsAt: Date;
    }>;
    join(req: AuthenticatedRequest, dto: JoinSessionDto): Promise<{
        session: {
            id: string;
            sessionCode: string;
            sessionId: string;
            classTitle: string;
            durationMinutes: number;
            joinWindowMinutes: number;
            createdAt: Date;
            endsAt: Date;
            status: string;
            allowedSites: any;
            blockedSites: any;
        };
        participant: {
            id: string;
            sessionId: string;
            pcHostname: string | null;
            studentId: string;
            joinedAt: Date;
            leftAt: Date | null;
            approvedLate: boolean;
        };
    }>;
    requestAccess(req: AuthenticatedRequest, dto: RequestSpecialAccessDto): Promise<{
        id: string;
        sessionId: string;
        status: string;
        studentId: string;
        requestedAt: Date;
        handledById: string | null;
        handledAt: Date | null;
    }>;
    handleAccess(req: TeacherAdminRequest, dto: HandleAccessRequestDto): Promise<{
        id: string;
        sessionId: string;
        status: string;
        studentId: string;
        requestedAt: Date;
        handledById: string | null;
        handledAt: Date | null;
    }>;
    participants(id: string): Promise<({
        student: {
            id: string;
            username: string;
            regNumber: string | null;
        };
    } & {
        id: string;
        sessionId: string;
        pcHostname: string | null;
        studentId: string;
        joinedAt: Date;
        leftAt: Date | null;
        approvedLate: boolean;
    })[]>;
    end(req: TeacherAdminRequest, id: string): Promise<{
        id: string;
        sessionCode: string;
        sessionId: string;
        status: string;
        alreadyEnded: boolean;
        endedAt?: undefined;
        endedById?: undefined;
        endedByRole?: undefined;
        reason?: undefined;
    } | {
        id: string;
        sessionCode: string;
        sessionId: string;
        status: string;
        endedAt: Date;
        endedById: string;
        endedByRole: "ADMIN" | "TEACHER";
        reason: string;
        alreadyEnded?: undefined;
    }>;
}
export {};
