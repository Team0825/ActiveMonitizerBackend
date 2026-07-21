"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatbotService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
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
let ChatbotService = class ChatbotService {
    constructor(config, prisma) {
        this.config = config;
        this.prisma = prisma;
        this.apiKey = this.config.get('ANTHROPIC_API_KEY');
        this.model = this.config.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-5';
    }
    async ask(studentId, dto) {
        if (!this.apiKey) {
            throw new common_1.InternalServerErrorException('ANTHROPIC_API_KEY is not configured on the server');
        }
        const userMessage = [
            dto.language ? `Language: ${dto.language}` : null,
            dto.question ? `Student's question: ${dto.question}` : null,
            dto.errorMessage ? `Error message:\n${dto.errorMessage}` : null,
            `Code:\n\`\`\`\n${dto.code}\n\`\`\``,
        ]
            .filter(Boolean)
            .join('\n\n');
        let response;
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
        }
        catch {
            throw new common_1.BadGatewayException('Could not reach the AI service');
        }
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new common_1.BadGatewayException(`AI service error (${response.status}): ${body}`);
        }
        const data = await response.json();
        const reply = (data.content ?? [])
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('\n');
        await this.prisma.auditLog.create({
            data: {
                actorId: studentId,
                action: 'CHATBOT_QUERY',
                metadata: JSON.stringify({ codeLength: dto.code.length, language: dto.language ?? null }),
            },
        });
        return { reply };
    }
};
exports.ChatbotService = ChatbotService;
exports.ChatbotService = ChatbotService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], ChatbotService);
//# sourceMappingURL=chatbot.service.js.map