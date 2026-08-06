export interface PcSystemInfoPayload {
  hostname: string;

  agentVersion: string;

  osName: string;

  osVersion: string;

  osArchitecture: string;

  processArchitecture: string;

  processorCount: number;

  dotNetVersion: string;

  ramUsage: number;

  totalMemoryMb: number;

  freeMemoryMb: number;

  diskUsage: number;

  totalDiskGb: number;

  freeDiskGb: number;

  internetConnected: boolean;

  collectedAt: string;
}