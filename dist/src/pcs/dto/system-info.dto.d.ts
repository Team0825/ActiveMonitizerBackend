export interface PcSystemInfoPayload {
    hostname: string;
    agentVersion: string;
    osName: string;
    osVersion: string;
    osArchitecture: string;
    processArchitecture: string;
    processorName: string;
    processorCount: number;
    dotNetVersion: string;
    ramUsage: number;
    ramUsagePercent: number;
    cpuUsage: number;
    totalMemoryMb: number;
    freeMemoryMb: number;
    diskUsage: number;
    diskUsagePercent: number;
    totalDiskGb: number;
    freeDiskGb: number;
    internetConnected: boolean;
    gpuName: string;
    gpuDriverVersion: string;
    uptimeSeconds: number;
    restartRequired: boolean;
    firewallEnabled: boolean;
    antivirusEnabled: boolean;
    collectedAt: string;
}
