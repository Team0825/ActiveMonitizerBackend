"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var PrismaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let PrismaService = PrismaService_1 = class PrismaService extends client_1.PrismaClient {
    constructor() {
        super(...arguments);
        this.logger = new common_1.Logger(PrismaService_1.name);
    }
    async onModuleInit() {
        try {
            const rawUrl = process.env.DATABASE_URL || '';
            let safeTarget = 'Not configured';
            if (rawUrl) {
                try {
                    const parsed = new URL(rawUrl);
                    safeTarget = `${parsed.protocol}//${parsed.username ? parsed.username + '@' : ''}${parsed.host}${parsed.pathname}`;
                }
                catch {
                    safeTarget = 'Custom connection string (valid host)';
                }
            }
            this.logger.log(`Connecting to database at: ${safeTarget}`);
            await this.$connect();
            this.logger.log('Prisma database connection established successfully.');
        }
        catch (err) {
            this.logger.error(`Database connection failed [${err?.code || 'UNKNOWN'}]: ${err?.message}`);
            throw err;
        }
    }
    async onModuleDestroy() {
        await this.$disconnect();
        this.logger.log('Prisma database connection closed.');
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = PrismaService_1 = __decorate([
    (0, common_1.Injectable)()
], PrismaService);
//# sourceMappingURL=prisma.service.js.map