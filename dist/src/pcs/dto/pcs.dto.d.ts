export type PcCommandAction = 'LOCK' | 'UNLOCK' | 'FREEZE' | 'UNFREEZE' | 'SHUTDOWN' | 'RESTART' | 'MESSAGE' | 'WARNING' | 'CAPTURE' | 'SIMULATION_START' | 'SIMULATION_STOP' | 'CHATBOT_ENABLE' | 'CHATBOT_DISABLE';
export interface RegisterPcPayload {
    hostname: string;
    labName?: string;
    sessionId?: string;
    studentId?: string;
}
export interface HeartbeatPayload {
    hostname: string;
}
export interface TeacherSubscribePayload {
    sessionId: string;
}
export interface TeacherCommandPayload {
    sessionId: string;
    targetHostname?: string | 'ALL';
    action: PcCommandAction;
    message?: string;
}
export interface PcExecuteCommandPayload {
    commandId: string;
    sessionId: string;
    action: PcCommandAction;
    message?: string;
    issuedBy: string;
    issuedAt: string;
}
export interface PcCommandAckPayload {
    commandId: string;
    hostname: string;
    success: boolean;
    action: PcCommandAction;
    executedAt: string;
    error?: string;
    imageUrl?: string;
}
export interface PcCommandResultPayload extends PcCommandAckPayload {
    latencyMs?: number;
}
export declare function assertRegisterPcPayload(p: any): asserts p is RegisterPcPayload;
export declare function assertTeacherCommandPayload(p: any): asserts p is TeacherCommandPayload;
export declare function assertPcCommandAckPayload(p: any): asserts p is PcCommandAckPayload;
export interface PcActivityPayload {
    hostname: string;
    sessionId: string;
    active: boolean;
    sampleSeconds: number;
    activityPercentage?: number;
    activeApp?: string;
    idleSeconds?: number;
    recordedAt?: string;
}
export declare function assertPcActivityPayload(p: any): asserts p is PcActivityPayload;
