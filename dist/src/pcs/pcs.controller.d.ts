import { PcsService } from './pcs.service';
export declare class PcsController {
    private readonly pcsService;
    constructor(pcsService: PcsService);
    getHealth(): Promise<{
        hostname: string;
        status: string;
        labName: string | null;
        lastSeen: Date | null;
        sessionId: string | null;
        studentId: string | null;
        online: boolean;
        heartbeatAgeSeconds: number;
    }[]>;
}
