import { Server } from 'socket.io';
export declare class SessionRealtimeService {
    private readonly logger;
    private server?;
    setServer(server: Server): void;
    emitSessionEnded(sessionId: string, payload: {
        sessionId: string;
        sessionCode: string;
        classTitle: string;
        endedAt: string;
        endedById: string;
        endedByRole: 'ADMIN' | 'TEACHER';
        reason: 'ADMIN_TERMINATED' | 'COMPLETED';
    }): void;
    emitToPc(hostname: string, eventName: string, payload: unknown): void;
}
