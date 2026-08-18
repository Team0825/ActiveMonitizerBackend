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
var ChatbotService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatbotService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
const SYSTEM_PROMPT = `You are an educational AI coding tutor embedded in the Activity Monetizer laboratory and examination environment.
A student will show you code, an error message, or a programming question.

Your educational guidelines:
1. Explain what is actually going wrong in clear, conceptual terms.
2. Give up to approximately three (3) most likely causes or reasons for the problem.
3. Provide step-by-step troubleshooting guidance and concepts to check.
4. Encourage the student to think through the solution: Avoid directly writing the complete final examination answer or full solution code when testing understanding.
5. Keep your response concise, structured with bullet points, encouraging, and easy to read.`;
let ChatbotService = ChatbotService_1 = class ChatbotService {
    constructor(config, prisma) {
        this.config = config;
        this.prisma = prisma;
        this.logger = new common_1.Logger(ChatbotService_1.name);
        this.apiKey =
            this.config.get('AI_API_KEY') ||
                this.config.get('ANTHROPIC_API_KEY') ||
                this.config.get('OPENAI_API_KEY');
        this.model =
            this.config.get('AI_API_MODEL') ||
                this.config.get('ANTHROPIC_MODEL') ||
                (this.apiKey?.startsWith('nvapi-') ? 'meta/llama-3.1-70b-instruct' : 'claude-sonnet-5');
        this.baseUrl = this.config.get('AI_API_BASE_URL');
    }
    async ask(studentId, dto) {
        if (!this.apiKey) {
            throw new common_1.InternalServerErrorException('AI_API_KEY is not configured on the server. Please set AI_API_KEY in the environment.');
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
        }
        catch {
        }
        return { reply };
    }
    async getGuidance(studentId, question, instruction) {
        if (!this.apiKey) {
            throw new common_1.InternalServerErrorException('AI_API_KEY is not configured on the server. Please set AI_API_KEY in the environment.');
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
        }
        catch {
        }
        return { guidance };
    }
    async callAiProvider(promptText) {
        const key = this.apiKey;
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
                    throw new common_1.BadGatewayException(`AI service error (${response.status}): ${body}`);
                }
                const data = await response.json();
                return (data.content ?? [])
                    .filter((block) => block.type === 'text')
                    .map((block) => block.text)
                    .join('\n');
            }
            catch (err) {
                this.logger.error('Anthropic API call failed:', err?.message);
                throw new common_1.BadGatewayException('Could not reach the AI service');
            }
        }
        const endpoint = this.baseUrl ||
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
                throw new common_1.BadGatewayException(`AI service error (${response.status})`);
            }
            const data = await response.json();
            const choice = data.choices?.[0];
            const content = choice?.message?.content || choice?.text || '';
            return content.trim();
        }
        catch (err) {
            this.logger.error('AI provider call error:', err?.message);
            if (err instanceof common_1.BadGatewayException)
                throw err;
            throw new common_1.BadGatewayException('Could not reach the AI service');
        }
    }
};
exports.ChatbotService = ChatbotService;
exports.ChatbotService = ChatbotService = ChatbotService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], ChatbotService);
//# sourceMappingURL=chatbot.service.js.map