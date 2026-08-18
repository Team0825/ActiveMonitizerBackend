import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtPayload } from '../auth/jwt.strategy';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { ChatbotService } from './chatbot.service';
import { AskChatbotDto } from './dto/ask-chatbot.dto';

type AuthenticatedRequest = Request & { user?: JwtPayload };

@Controller('chatbot')
@UseGuards(RolesGuard)
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('ask')
  @Roles('STUDENT', 'TEACHER', 'ADMIN')
  ask(@Req() req: AuthenticatedRequest, @Body() dto: AskChatbotDto) {
    const studentId = req.user?.sub || 'STUDENT';
    return this.chatbotService.ask(studentId, dto);
  }

  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('guide')
  @Roles('STUDENT', 'TEACHER', 'ADMIN')
  guide(
    @Req() req: AuthenticatedRequest,
    @Body() dto: { question: string; instruction?: string },
  ) {
    const studentId = req.user?.sub || 'STUDENT';
    return this.chatbotService.getGuidance(studentId, dto.question, dto.instruction);
  }
}
