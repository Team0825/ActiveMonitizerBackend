import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtPayload } from '../auth/jwt.strategy';
import { ChatbotService } from './chatbot.service';
import { AskChatbotDto } from './dto/ask-chatbot.dto';

type AuthenticatedRequest = Request & { user?: JwtPayload };

@Controller(['chatbot', 'ai'])
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(['ask', 'chat'])
  @HttpCode(200)
  ask(@Req() req: AuthenticatedRequest, @Body() dto: AskChatbotDto) {
    const studentId = req.user?.sub || dto.sessionId || 'AGENT_STUDENT';
    return this.chatbotService.ask(studentId, dto);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('guide')
  @HttpCode(200)
  guide(
    @Req() req: AuthenticatedRequest,
    @Body() dto: { question: string; instruction?: string; sessionId?: string },
  ) {
    const studentId = req.user?.sub || dto.sessionId || 'AGENT_STUDENT';
    return this.chatbotService.getGuidance(studentId, dto.question, dto.instruction);
  }
}
