import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import {
  PassportModule,
} from '@nestjs/passport';
import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { PcsModule } from '../pcs/pcs.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    ConfigModule,

    PassportModule.register({
      defaultStrategy: 'jwt',
      session: false,
    }),

    JwtModule.registerAsync({
      imports: [
        ConfigModule,
      ],

      inject: [
        ConfigService,
      ],

      useFactory: (
        configService: ConfigService,
      ) => {
        const secret =
          configService.get<string>(
            'JWT_SECRET',
          );

        if (!secret) {
          throw new Error(
            'JWT_SECRET is not configured in .env',
          );
        }

        return {
          secret,

          signOptions: {
            expiresIn:
              configService.get(
                'JWT_EXPIRES_IN',
              ) || '8h',
          },
        };
      },
    }),
    PcsModule,
    RealtimeModule,
  ],

  controllers: [
    AuthController,
  ],

  providers: [
    AuthService,
    JwtStrategy,
    RolesGuard,
  ],

  exports: [
    JwtModule,
    PassportModule,
    JwtStrategy,
    RolesGuard,
  ],
})
export class AuthModule {}