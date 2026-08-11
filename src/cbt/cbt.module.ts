import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CbtController } from './cbt.controller';
import { CbtService } from './cbt.service';

@Module({
  imports: [PrismaModule],
  controllers: [CbtController],
  providers: [CbtService],
  exports: [CbtService],
})
export class CbtModule {}
