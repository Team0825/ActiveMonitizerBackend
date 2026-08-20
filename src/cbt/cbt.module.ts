import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PcsModule } from '../pcs/pcs.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CbtController } from './cbt.controller';
import { StudentCbtController } from './student-cbt.controller';
import { CbtService } from './cbt.service';

@Module({
  imports: [PrismaModule, PcsModule, RealtimeModule],
  controllers: [CbtController, StudentCbtController],
  providers: [CbtService],
  exports: [CbtService],
})
export class CbtModule {}
