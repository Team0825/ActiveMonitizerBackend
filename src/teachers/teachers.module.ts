import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module';

import {
  TeachersController,
} from './teachers.controller';

import {
  TeachersService,
} from './teachers.service';

import {
  TeacherDashboardController,
} from './teacher-dashboard.controller';

import {
  TeacherDashboardService,
} from './teacher-dashboard.service';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    TeachersController,
    TeacherDashboardController,
  ],

  providers: [
    TeachersService,
    TeacherDashboardService,
  ],
})
export class TeachersModule {}