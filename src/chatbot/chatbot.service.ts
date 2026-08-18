import { BadGatewayException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AskChatbotDto } from './dto/ask-chatbot.dto';

const SYSTEM_PROMPT = `You are an educational AI coding tutor embedded in the Activity Monetizer laboratory and examination environment.
A student will show you code, an error message, or a programming question.

Your educational guidelines:
1. Explain what is actually going wrong in clear, conceptual terms.
2. Give up to approximately three (3) most likely causes or reasons for the problem.
3. Provide step-by-step troubleshooting guidance and concepts to check.
4. Encourage the student to think through the solution: Avoid directly writing the complete final examination answer or full solution code when testing understanding.
5. Keep your response concise, structured with bullet points, encouraging, and easy to read.`;

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly baseUrl: string | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiKey =
      this.config.get<string>('AI_API_KEY') ||
      this.config.get<string>('ANTHROPIC_API_KEY') ||
      this.config.get<string>('OPENAI_API_KEY');

    this.model =
      this.config.get<string>('AI_API_MODEL') ||
      this.config.get<string>('ANTHROPIC_MODEL') ||
      (this.apiKey?.startsWith('nvapi-') ? 'meta/llama-3.1-70b-instruct' : 'claude-sonnet-5');

    this.baseUrl = this.config.get<string>('AI_API_BASE_URL');
  }

  async ask(studentId: string, dto: AskChatbotDto) {
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'AI_API_KEY is not configured on the server. Please set AI_API_KEY in the environment.',
      );
    }

    const userMessage = [
      dto.language ? `Language: ${dto.language}` : null,
      dto.question ? `Student's question: ${dto.question}` : null,
      dto.errorMessage ? `Error message:\n${dto.errorMessage}` : null,
      dto.code ? `Code:\n\`\`\`\n${dto.code}\n\`\`\`` : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    const reply = await this.callAiProvider(userMessage);

    // Light-touch audit log — log query event metadata without sensitive credentials
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: studentId || 'STUDENT',
          action: 'CHATBOT_QUERY',
          metadata: JSON.stringify({
            codeLength: dto.code?.length ?? 0,
            language: dto.language ?? null,
            hasError: Boolean(dto.errorMessage),
          }),
        },
      });
    } catch {
      // Non-blocking audit log
    }

    return { reply };
  }

  async getGuidance(studentId: string, question: string, instruction?: string) {
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'AI_API_KEY is not configured on the server. Please set AI_API_KEY in the environment.',
      );
    }

    const prompt = [
      instruction ? `Instruction: ${instruction}` : null,
      `Student Question/Error:\n${question}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const guidance = await this.callAiProvider(prompt);

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: studentId || 'STUDENT',
          action: 'AI_GUIDE_QUERY',
          metadata: JSON.stringify({ queryLength: question.length }),
        },
      });
    } catch {
      // Non-blocking audit log
    }

    return { guidance };
  }

  private async callAiProvider(promptText: string): Promise<string> {
    const key = this.apiKey!;

    // 1. Anthropic Claude API format
    if (key.startsWith('sk-ant-') && !this.baseUrl) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: promptText }],
          }),
        });

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new BadGatewayException(`AI service error (${response.status}): ${body}`);
        }

        const data = await response.json();
        return (data.content ?? [])
          .filter((block: { type: string }) => block.type === 'text')
          .map((block: { text: string }) => block.text)
          .join('\n');
      } catch (err: any) {
        this.logger.error('Anthropic API call failed:', err?.message);
        throw new BadGatewayException('Could not reach the AI service');
      }
    }

    // 2. OpenAI / NVIDIA / Compatible API format
    const endpoint =
      this.baseUrl ||
      (key.startsWith('nvapi-')
        ? 'https://integrate.api.nvidia.com/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: promptText },
          ],
          max_tokens: 1024,
          temperature: 0.5,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.error(`AI service responded with ${response.status}: ${body}`);
        throw new BadGatewayException(`AI service error (${response.status})`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const content = choice?.message?.content || choice?.text || '';
      return content.trim();
    } catch (err: any) {
      this.logger.error('AI provider call error:', err?.message);
      if (err instanceof BadGatewayException) throw err;
      throw new BadGatewayException('Could not reach the AI service');
    }
  }
}
