import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SessionRealtimeService } from '../realtime/session-realtime.service';
import { CreateSessionDto, HandleAccessRequestDto, JoinSessionDto, RequestSpecialAccessDto } from './dto/session.dto';
export declare class SessionsService {
    private readonly prisma;
    private readonly jwt;
    private readonly sessionRealtimeService;
    constructor(prisma: PrismaService, jwt: JwtService, sessionRealtimeService: SessionRealtimeService);
    private generateSessionCode;
    private generateUniqueSessionCode;
    createSession(teacherId: string, dto: CreateSessionDto): Promise<{
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
    joinSession(studentId: string, dto: JoinSessionDto): Promise<{
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
    requestSpecialAccess(studentId: string, dto: RequestSpecialAccessDto): Promise<{
        id: string;
        sessionId: string;
        status: string;
        studentId: string;
        requestedAt: Date;
        handledById: string | null;
        handledAt: Date | null;
    }>;
    handleAccessRequest(actorId: string, actorRole: 'TEACHER' | 'ADMIN', dto: HandleAccessRequestDto): Promise<{
        id: string;
        sessionId: string;
        status: string;
        studentId: string;
        requestedAt: Date;
        handledById: string | null;
        handledAt: Date | null;
    }>;
    getSessions(actorId: string, actorRole: 'TEACHER' | 'ADMIN'): Promise<{
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
    getOnlineParticipants(sessionId: string): Promise<({
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
    endSession(actorId: string, actorRole: 'TEACHER' | 'ADMIN', sessionId: string): Promise<{
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
    handleExpiredSessions(): Promise<void>;
}
