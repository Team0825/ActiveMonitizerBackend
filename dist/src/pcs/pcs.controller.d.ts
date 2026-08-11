import { PcsService } from './pcs.service';
export declare class PcsController {
    private readonly pcsService;
    constructor(pcsService: PcsService);
    getHealth(): Promise<{
        hostname: string;
        displayName: string | null;
        labName: string | null;
        status: string;
        online: boolean;
        lastSeen: Date | null;
        heartbeatAgeSeconds: number | null;
        sessionId: string | null;
        studentId: string | null;
        os: {
            name: string | null;
            version: string | null;
            architecture: string | null;
        };
        cpu: {
            name: string | null;
            usagePercent: number | null;
            processorCount: number | null;
        };
        gpu: {
            name: string | null;
            driverVersion: string | null;
        };
        memory: {
            totalMb: number | null;
            availableMb: number | null;
            usedMb: number | null;
            usagePercent: number | null;
        };
        disk: {
            totalMb: number | null;
            availableMb: number | null;
            usedMb: number | null;
            usagePercent: number | null;
        };
        agent: {
            version: string | null;
            clientVersion: string | null;
            dotNetVersion: string | null;
            processArchitecture: string | null;
        };
        system: {
            uptimeSeconds: number | null;
            restartRequired: boolean | null;
        };
        security: {
            firewallEnabled: boolean | null;
            antivirusEnabled: boolean | null;
        };
        healthStatus: string;
        updateStatus: string;
        internetStatus: string;
        internetConnected: boolean | null;
        latencyMs: number | null;
        lastHealthCheck: Date | null;
        lastSystemReport: Date;
        lastSyncAt: Date | null;
        registeredAt: Date;
        updatedAt: Date;
    }[]>;
    getViolations(sessionId?: string): Promise<any[]>;
}
