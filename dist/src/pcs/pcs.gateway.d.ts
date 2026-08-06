import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { PcSystemInfoPayload } from "./dto/system-info.dto";
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { SessionRealtimeService } from '../realtime/session-realtime.service';
import { PcsService } from './pcs.service';
import { HeartbeatPayload, RegisterPcPayload, TeacherSubscribePayload, PcActivityPayload } from './dto/pcs.dto';
interface AuthedSocket extends Socket {
    data: {
        user?: {
            sub: string;
            role: 'STUDENT' | 'TEACHER' | 'ADMIN';
            username: string;
        };
        hostname?: string;
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
    handleSystemInfo(client: Socket, payload: PcSystemInfoPayload): Promise<void>;
}
export {};
