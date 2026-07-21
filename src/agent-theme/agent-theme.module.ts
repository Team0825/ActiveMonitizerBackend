import { Module } from '@nestjs/common';
import { AgentThemeService } from './agent-theme.service';
import { AgentThemeController } from './agent-theme.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AgentThemeController],
  providers: [AgentThemeService],
})
export class AgentThemeModule {}