"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminAttendanceController = void 0;
const common_1 = require("@nestjs/common");
const roles_guard_1 = require("../auth/roles.guard");
const admin_attendance_service_1 = require("./admin-attendance.service");
let AdminAttendanceController = class AdminAttendanceController {
    constructor(attendanceService) {
        this.attendanceService = attendanceService;
    }
    overview() {
        return this.attendanceService.overview();
    }
    listAttendance(classId, search) {
        return this.attendanceService.listAttendance(classId, search);
    }
    byClass(classId) {
        return this.attendanceService.byClass(classId);
    }
    byStudent(studentId) {
        return this.attendanceService.byStudent(studentId);
    }
    approveAttendance(req, attendanceId, dto) {
        return this.attendanceService.approveAttendance(attendanceId, req.user.sub, dto.reason);
    }
    rejectAttendance(req, attendanceId, dto) {
        return this.attendanceService.rejectAttendance(attendanceId, req.user.sub, dto.reason);
    }
};
exports.AdminAttendanceController = AdminAttendanceController;
__decorate([
    (0, common_1.Get)('overview'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminAttendanceController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('classId')),
    __param(1, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminAttendanceController.prototype, "listAttendance", null);
__decorate([
    (0, common_1.Get)('class/:classId'),
    __param(0, (0, common_1.Param)('classId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminAttendanceController.prototype, "byClass", null);
__decorate([
    (0, common_1.Get)('student/:studentId'),
    __param(0, (0, common_1.Param)('studentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminAttendanceController.prototype, "byStudent", null);
__decorate([
    (0, common_1.Patch)(':attendanceId/approve'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('attendanceId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AdminAttendanceController.prototype, "approveAttendance", null);
__decorate([
    (0, common_1.Patch)(':attendanceId/reject'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('attendanceId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AdminAttendanceController.prototype, "rejectAttendance", null);
exports.AdminAttendanceController = AdminAttendanceController = __decorate([
    (0, common_1.Controller)('admin/attendance'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)('ADMIN'),
    __metadata("design:paramtypes", [admin_attendance_service_1.AdminAttendanceService])
], AdminAttendanceController);
//# sourceMappingURL=admin-attendance.controller.js.map