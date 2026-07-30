import {
  Module,
} from '@nestjs/common';

import {
  ConfigModule,
} from '@nestjs/config';

import {
  NotificationsController,
} from './notifications.controller';

import {
  NotificationsService,
} from './notifications.service';

import {
  NotificationStorageService,
} from './notification-storage.service';

@Module({
  imports: [
    ConfigModule,
  ],

  controllers: [
    NotificationsController,
  ],

  providers: [
    NotificationsService,
    NotificationStorageService,
  ],

  exports: [
    NotificationsService,
    NotificationStorageService,
  ],
})
export class NotificationsModule {}