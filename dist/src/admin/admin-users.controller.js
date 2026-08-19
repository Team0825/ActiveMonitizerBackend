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
exports.TeacherStudentsController = exports.AdminUsersController = void 0;
const common_1 = require("@nestjs/common");
const roles_guard_1 = require("../auth/roles.guard");
const admin_users_service_1 = require("./admin-users.service");
const users_dto_1 = require("./dto/users.dto");
let AdminUsersController = class AdminUsersController {
    constructor(usersService) {
        this.usersService = usersService;
    }
    createStudent(req, dto) {
        return this.usersService.createStudent(req.user.sub, dto);
    }
    createTeacher(req, dto) {
        return this.usersService.createTeacher(req.user.sub, dto);
    }
    createAdmin(req, dto) {
        return this.usersService.createAdmin(req.user.sub, dto);
    }
    list(req, role, classId, institutionId, departmentId) {
        return this.usersService.listUsers(role, classId, institutionId, departmentId);
    }
    update(req, id, dto) {
        return this.usersService.updateUser(id, dto, req.user.sub);
    }
    remove(req, id, hard) {
        return this.usersService.deleteUser(id, hard === 'true', req.user.sub);
    }
};
exports.AdminUsersController = AdminUsersController;
__decorate([
    (0, common_1.Post)('students'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, users_dto_1.CreateStudentDto]),
    __metadata("design:returntype", void 0)
], AdminUsersController.prototype, "createStudent", null);
__decorate([
    (0, common_1.Post)('teachers'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, users_dto_1.CreateTeacherDto]),
    __metadata("design:returntype", void 0)
], AdminUsersController.prototype, "createTeacher", null);
__decorate([
    (0, common_1.Post)('admins'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AdminUsersController.prototype, "createAdmin", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('role')),
    __param(2, (0, common_1.Query)('classId')),
    __param(3, (0, common_1.Query)('institutionId')),
    __param(4, (0, common_1.Query)('departmentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", void 0)
], AdminUsersController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, users_dto_1.UpdateUserDto]),
    __metadata("design:returntype", void 0)
], AdminUsersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('hard')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], AdminUsersController.prototype, "remove", null);
exports.AdminUsersController = AdminUsersController = __decorate([
    (0, common_1.Controller)('admin/users'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)('ADMIN'),
    __metadata("design:paramtypes", [admin_users_service_1.AdminUsersService])
], AdminUsersController);
let TeacherStudentsController = class TeacherStudentsController {
    constructor(usersService) {
        this.usersService = usersService;
    }
    listStudents(classId) {
        return this.usersService.listUsers('STUDENT', classId);
    }
};
exports.TeacherStudentsController = TeacherStudentsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('classId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TeacherStudentsController.prototype, "listStudents", null);
exports.TeacherStudentsController = TeacherStudentsController = __decorate([
    (0, common_1.Controller)('teacher/students'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)('TEACHER'),
    __metadata("design:paramtypes", [admin_users_service_1.AdminUsersService])
], TeacherStudentsController);
//# sourceMappingURL=admin-users.controller.js.map