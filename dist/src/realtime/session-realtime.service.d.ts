import { Server } from 'socket.io';
export declare class SessionRealtimeService {
    private readonly logger;
    private server?;
    setServer(server: Server): void;
    getServer(): Server | undefined;
    emitSessionEnded(sessionId: string, payload: {
        sessionId: string;
        sessionCode: string;
        classTitle: string;
        endedAt: string;
        endedById: string;
        endedByRole: 'ADMIN' | 'TEACHER';
        reason: 'ADMIN_TERMINATED' | 'COMPLETED';
    }): void;
    emitPolicyUpdated(sessionId: string, policy: unknown): void;
    emitPolicyAcknowledged(sessionId: string, hostname: string, payload: unknown): void;
    emitScreenshotReady(sessionId: string, payload: unknown): void;
    emitRemoteCommand(hostname: string, payload: unknown): void;
    emitAnnouncement(sessionId: string, payload: unknown): void;
    emitToSession(sessionId: string, eventName: string, payload: unknown): void;
    emitToPc(hostname: string, eventName: string, payload: unknown): void;
}
