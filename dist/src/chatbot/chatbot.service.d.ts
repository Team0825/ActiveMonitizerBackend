import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AskChatbotDto } from './dto/ask-chatbot.dto';
export declare class ChatbotService {
    private readonly config;
    private readonly prisma;
    private readonly logger;
    private readonly apiKey;
    private readonly model;
    private readonly baseUrl;
    constructor(config: ConfigService, prisma: PrismaService);
    ask(studentId: string, dto: AskChatbotDto): Promise<{
        reply: string;
        timestamp: string;
    }>;
    getGuidance(studentId: string, question: string, instruction?: string): Promise<{
        guidance: string;
        reply: string;
        timestamp: string;
    }>;
    private generateOfflineEducationalGuidance;
    private callAiProvider;
}
