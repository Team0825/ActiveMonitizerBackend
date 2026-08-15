import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { PcSystemInfoPayload } from "./dto/system-info.dto";
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { SessionRealtimeService } from '../realtime/session-realtime.service';
import { PcsService } from './pcs.service';
import { HeartbeatPayload, RegisterPcPayload, TeacherCommandPayload, TeacherSubscribePayload, PcCommandAckPayload, PcActivityPayload } from './dto/pcs.dto';
interface AuthedSocket extends Socket {
    data: {
        user?: {
            sub: string;
            role: 'STUDENT' | 'TEACHER' | 'ADMIN';
            username: string;
            sessionId?: string;
            sessionCode?: string;
        };
        hostname?: string;
        pcPresence?: boolean;
    };
}
export declare class PcsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly jwt;
    private readonly prisma;
    private readonly pcsService;
    private readonly sessionRealtimeService;
    server: Server;
    private readonly logger;
    private readonly pendingCommands;
    constructor(jwt: JwtService, prisma: PrismaService, pcsService: PcsService, sessionRealtimeService: SessionRealtimeService);
    afterInit(server: Server): void;
    handleConnection(client: AuthedSocket): Promise<void>;
    handleDisconnect(client: AuthedSocket): Promise<void>;
    onRegisterPc(client: AuthedSocket, payload: RegisterPcPayload): Promise<void>;
    onHeartbeat(payload: HeartbeatPayload): Promise<void>;
    onPcActivity(client: AuthedSocket, payload: PcActivityPayload): Promise<void>;
    onTeacherSubscribe(client: AuthedSocket, payload: TeacherSubscribePayload): Promise<void>;
    onTeacherCommand(client: AuthedSocket, payload: TeacherCommandPayload): Promise<void>;
    onCommandAck(client: AuthedSocket, payload: PcCommandAckPayload): Promise<void>;
    handleSystemInfo(client: Socket, payload: PcSystemInfoPayload): Promise<void>;
    onPcViolation(_client: Socket, payload: {
        hostname: string;
        sessionId: string;
        type: string;
        details: string;
        occurredAt?: string;
    }): Promise<void>;
    onScreenUpdate(_client: Socket, payload: {
        hostname: string;
        captureUrl: string;
        cpuUsage?: number;
        memoryUsage?: number;
        timestamp?: number;
    }): Promise<void>;
    onScreenUpdateAlt(client: Socket, payload: any): Promise<void>;
    private readonly activeSpectators;
    onStreamStart(client: AuthedSocket, payload: {
        hostname: string;
        fps?: number;
    }): Promise<void>;
    onStreamStop(client: AuthedSocket, payload: {
        hostname: string;
    }): Promise<void>;
    onRemoteInput(client: AuthedSocket, payload: {
        hostname: string;
        type: string;
        xPercent?: number;
        yPercent?: number;
        button?: number;
        keyCode?: number;
        key?: string;
        text?: string;
        deltaY?: number;
    }): Promise<void>;
    onTeacherDirectCommand(client: AuthedSocket, payload: {
        targetHostname: string;
        action: any;
        message?: string;
    }): Promise<void>;
}
export {};
