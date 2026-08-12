import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module';

import {
  AdminUsersController,
  TeacherStudentsController,
} from './admin-users.controller';

import {
  AdminUsersService,
} from './admin-users.service';

import {
  AdminAttendanceController,
} from './admin-attendance.controller';

import {
  TeacherAttendanceController,
} from './teacher-attendance.controller';

import {
  AdminAttendanceService,
} from './admin-attendance.service';

import {
  DataManagementController,
} from './data-management.controller';

import {
  DataManagementService,
} from './data-management.service';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    AdminUsersController,
    TeacherStudentsController,
    AdminAttendanceController,
    TeacherAttendanceController,
    DataManagementController,
  ],

  providers: [
    AdminUsersService,
    AdminAttendanceService,
    DataManagementService,
  ],
})
export class AdminModule {}