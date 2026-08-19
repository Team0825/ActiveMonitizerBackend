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
    const rawQuestion = dto.message || dto.question || (dto.errorMessage ? `Error: ${dto.errorMessage}` : 'Help with code');
    const userMessage = [
      dto.language ? `Language: ${dto.language}` : null,
      rawQuestion ? `User's Question: ${rawQuestion}` : null,
      dto.errorMessage && dto.errorMessage !== rawQuestion ? `Error message:\n${dto.errorMessage}` : null,
      dto.code ? `Code:\n\`\`\`\n${dto.code}\n\`\`\`` : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    let reply = '';
    if (this.apiKey) {
      try {
        reply = await this.callAiProvider(userMessage);
      } catch (err: any) {
        this.logger.warn(`External AI provider failed (${err?.message}), falling back to built-in intelligence.`);
        reply = this.generateOfflineEducationalGuidance(rawQuestion, dto.code, dto.errorMessage, dto.language);
      }
    } else {
      reply = this.generateOfflineEducationalGuidance(rawQuestion, dto.code, dto.errorMessage, dto.language);
    }

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

    return { reply, timestamp: new Date().toISOString() };
  }

  async getGuidance(studentId: string, question: string, instruction?: string) {
    const prompt = [
      instruction ? `Instruction: ${instruction}` : null,
      `Student Question/Error:\n${question}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    let guidance = '';
    if (this.apiKey) {
      try {
        guidance = await this.callAiProvider(prompt);
      } catch (err: any) {
        guidance = this.generateOfflineEducationalGuidance(question);
      }
    } else {
      guidance = this.generateOfflineEducationalGuidance(question);
    }

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

    return { guidance, reply: guidance, timestamp: new Date().toISOString() };
  }

  private generateOfflineEducationalGuidance(
    question: string,
    code?: string,
    errorMsg?: string,
    language?: string,
  ): string {
    const qLower = (question || '').toLowerCase();
    const eLower = (errorMsg || '').toLowerCase();

    if (eLower.includes('nullpointer') || qLower.includes('null') || eLower.includes('undefined')) {
      return `### 💡 Null/Undefined Reference Analysis

**Key Concepts to Check:**
1. **Uninitialized Object/Variable**: Verify that the variable or reference is instantiated before accessing its properties or methods.
2. **Missing Return Value**: Check if a function or API call returned \`null\` or \`undefined\` unexpectedly.
3. **Safe Navigation / Null Check**: In languages like C#, Java, or TypeScript, add defensive checks (\`if (obj != null)\` or \`obj?.property\`).

*Next Step:* Place a breakpoint or debug log right before the error line to inspect the value of the target object.`;
    }

    if (eLower.includes('index') || eLower.includes('out of range') || eLower.includes('bound')) {
      return `### 🔍 Index Out of Bounds Troubleshooting

**Key Concepts to Check:**
1. **Zero-Based Indexing**: Most programming languages (C++, C#, Java, Python, JS) start array indexing at \`0\`. The last valid index is \`length - 1\`.
2. **Loop Boundary Condition**: Check your loop condition. Use \`i < array.length\` instead of \`i <= array.length\`.
3. **Empty Collection**: Ensure the collection is not empty before accessing elements at index \`0\`.

*Next Step:* Verify the size of the array using \`.length\` or \`.size()\` before indexing into it.`;
    }

    if (qLower.includes('pointer') || qLower.includes('c++') || qLower.includes('memory') || qLower.includes('segmentation')) {
      return `### ⚙️ C/C++ Memory & Pointer Guidance

**Key Concepts:**
1. **Memory Allocation**: Always match \`new\` with \`delete\`, or \`malloc()\` with \`free()\`.
2. **Dangling Pointers**: Avoid using pointers after the referenced memory is freed. Set freed pointers to \`nullptr\`.
3. **Pass by Reference**: Use \`&\` (e.g., \`void update(int& val)\`) when you want a function to modify the caller's variable without raw pointer arithmetic.`;
    }

    if (qLower.includes('attendance') || qLower.includes('session') || qLower.includes('exam') || qLower.includes('cbt')) {
      return `### 🎓 Activity Monetizer Examination & Lab Guidelines

1. **Active Participation**: Your keystrokes, active editor time, and periodic heartbeats are securely monitored to compute attendance and engagement percentages.
2. **Policy Compliance**: Keep unauthorized background applications closed during CBT and locked laboratory sessions to prevent security flags.
3. **Submission**: For CBT exams, your answers are autosaved regularly. Ensure you click **Submit Exam** when finished.`;
    }

    return `### 🤖 ActivityMon AI Assistant

Hello! I am your embedded laboratory and programming assistant.

**Quick Guidance for your question:**
- **Code Logic**: Review the input constraints, base conditions in recursion, and loop increments.
- **Syntax & Semantics**: Ensure matching brackets, semicolons, and correct parameter types for language \`${language || 'detected'}\`.
- **Testing**: Try tracing your code manually with a small sample input to verify each variable's value step-by-step.

Feel free to ask follow-up questions, paste specific error messages, or request clarification on programming concepts!`;
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
