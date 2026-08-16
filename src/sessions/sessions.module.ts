import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import {
  SessionsController,
  StudentSessionController,
} from './sessions.controller';

import { SessionsService } from './sessions.service';

import { PcsModule } from '../pcs/pcs.module';

@Module({
  imports: [
    AuthModule,
    PcsModule,
  ],

  controllers: [
    SessionsController,
    StudentSessionController,
  ],

  providers: [
    SessionsService,
  ],

  exports: [
    SessionsService,
  ],
})
export class SessionsModule {}