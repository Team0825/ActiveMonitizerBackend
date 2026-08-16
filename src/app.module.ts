import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';


import {
  ScheduleModule,
} from '@nestjs/schedule';

import {
  ThrottlerModule,
  ThrottlerGuard,
} from '@nestjs/throttler';

import {
  APP_GUARD,
} from '@nestjs/core';

import {
  PrismaModule,
} from './prisma/prisma.module';

import {
  AuthModule,
} from './auth/auth.module';

import {
  SessionsModule,
} from './sessions/sessions.module';

import {
  PcsModule,
} from './pcs/pcs.module';

import {
  AdminModule,
} from './admin/admin.module';

import {
  ChatbotModule,
} from './chatbot/chatbot.module';

import {
  TeachersModule,
} from './teachers/teachers.module';

import {
  NotificationsModule,
} from './notifications/notification.module';

import {
  RealtimeModule,
} from './realtime/realtime.module';

import {
  CbtModule,
} from './cbt/cbt.module';

import { AgentThemeModule } from './agent-theme/agent-theme.module';
import { CommonModule } from './common/common.module';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
  imports: [
    CommonModule,
    /*
     * ==========================================
     * GLOBAL CONFIGURATION
     * ==========================================
     */

    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ScheduleModule.forRoot(),

    /*
     * ==========================================
     * RATE LIMITING
     * ==========================================
     */

    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),

    /*
     * ==========================================
     * APPLICATION MODULES
     * ==========================================
     */

    PrismaModule,
    AuthModule,
    SessionsModule,
    PcsModule,
    AdminModule,
    ChatbotModule,
    TeachersModule,
    NotificationsModule,
    CbtModule,
    AgentThemeModule,

    /*
     * ==========================================
     * REALTIME SESSION EVENTS
     * ==========================================
     *
     * Provides the global
     * SessionRealtimeService.
     *
     * Used to send realtime events such as:
     *
     * - session:ended
     * - session warnings
     * - student messages
     * - teacher/admin notifications
     */

    RealtimeModule,
  ],

  /*
   * ==========================================
   * GLOBAL PROVIDERS
   * ==========================================
   */

  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}