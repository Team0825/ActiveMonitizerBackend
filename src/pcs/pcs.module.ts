import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PcsGateway } from './pcs.gateway';
import { PcsService } from './pcs.service';
import { PcsController } from './pcs.controller';

@Module({
   controllers: [PcsController],
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [PcsGateway, PcsService],
})
export class PcsModule {}
