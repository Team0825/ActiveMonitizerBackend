import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtPayload } from '../auth/jwt.strategy';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { ChatbotService } from './chatbot.service';
import { AskChatbotDto } from './dto/ask-chatbot.dto';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('chatbot')
@UseGuards(RolesGuard)
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  // Each call costs real money against the Anthropic API, so this is
  // rate-limited per student on top of the global throttle.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('ask')
  @Roles('STUDENT')
  ask(@Req() req: AuthenticatedRequest, @Body() dto: AskChatbotDto) {
    return this.chatbotService.ask(req.user.sub, dto);
  }
}
