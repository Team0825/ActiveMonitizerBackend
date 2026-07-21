import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AskChatbotDto } from './dto/ask-chatbot.dto';
export declare class ChatbotService {
    private readonly config;
    private readonly prisma;
    private readonly apiKey;
    private readonly model;
    constructor(config: ConfigService, prisma: PrismaService);
    ask(studentId: string, dto: AskChatbotDto): Promise<{
        reply: any;
    }>;
}
