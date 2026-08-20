import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      const rawUrl = process.env.DATABASE_URL || '';
      let safeTarget = 'Not configured';
      if (rawUrl) {
        try {
          const parsed = new URL(rawUrl);
          safeTarget = `${parsed.protocol}//${parsed.username ? parsed.username + '@' : ''}${parsed.host}${parsed.pathname}`;
        } catch {
          safeTarget = 'Custom connection string (valid host)';
        }
      }
      this.logger.log(`Connecting to database at: ${safeTarget}`);
      await this.$connect();
      this.logger.log('Prisma database connection established successfully.');
    } catch (err: any) {
      this.logger.error(`Database connection failed [${err?.code || 'UNKNOWN'}]: ${err?.message}`);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma database connection closed.');
  }
}
