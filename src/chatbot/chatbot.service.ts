import { BadGatewayException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AskChatbotDto } from './dto/ask-chatbot.dto';

const SYSTEM_PROMPT = `You are a coding tutor embedded in a student lab's practice environment.
A student will show you code and, usually, an error message or a question.

Your job is to help them learn to fix it themselves, not to just hand over corrected code:
- Explain what's actually going wrong, in plain terms, before anything else.
- Point at the specific line(s) or concept responsible.
- Give a small hint or the general shape of the fix (e.g. "you need to initialize the
  variable before the loop" rather than a full rewritten block).
- Only provide a complete corrected snippet if the student's message indicates they've
  already tried to fix it themselves and are still stuck, or if the fix is a single small
  line-level change that would be pedagogically odd to withhold.
- Keep the tone encouraging and concise — this is a lab session, not an essay.`;

@Injectable()
export class ChatbotService {
  private readonly apiKey: string | undefined;
  private readonly model: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.model = this.config.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-5';
  }

  async ask(studentId: string, dto: AskChatbotDto) {
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'ANTHROPIC_API_KEY is not configured on the server',
      );
    }

    const userMessage = [
      dto.language ? `Language: ${dto.language}` : null,
      dto.question ? `Student's question: ${dto.question}` : null,
      dto.errorMessage ? `Error message:\n${dto.errorMessage}` : null,
      `Code:\n\`\`\`\n${dto.code}\n\`\`\``,
    ]
      .filter(Boolean)
      .join('\n\n');

    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });
    } catch {
      throw new BadGatewayException('Could not reach the AI service');
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new BadGatewayException(`AI service error (${response.status}): ${body}`);
    }

    const data = await response.json();
    const reply = (data.content ?? [])
      .filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('\n');

    // Light-touch audit only — we log that a query happened, not the code
    // itself, to keep student submissions out of long-term storage.
    await this.prisma.auditLog.create({
      data: {
        actorId: studentId,
        action: 'CHATBOT_QUERY',
        metadata: JSON.stringify({ codeLength: dto.code.length, language: dto.language ?? null }),
      },
    });

    return { reply };
  }
}
