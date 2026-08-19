import { Module } from '@nestjs/common';
import { LicensingController } from './licensing.controller';
import { LicensingService } from './licensing.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LicensingController],
  providers: [LicensingService],
  exports: [LicensingService],
})
export class LicensingModule {}
