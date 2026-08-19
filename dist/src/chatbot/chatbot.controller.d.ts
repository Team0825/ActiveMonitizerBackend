import { Request } from 'express';
import { JwtPayload } from '../auth/jwt.strategy';
import { ChatbotService } from './chatbot.service';
import { AskChatbotDto } from './dto/ask-chatbot.dto';
type AuthenticatedRequest = Request & {
    user?: JwtPayload;
};
export declare class ChatbotController {
    private readonly chatbotService;
    constructor(chatbotService: ChatbotService);
    ask(req: AuthenticatedRequest, dto: AskChatbotDto): Promise<{
        reply: string;
        timestamp: string;
    }>;
    guide(req: AuthenticatedRequest, dto: {
        question: string;
        instruction?: string;
        sessionId?: string;
    }): Promise<{
        guidance: string;
        reply: string;
        timestamp: string;
    }>;
}
export {};
