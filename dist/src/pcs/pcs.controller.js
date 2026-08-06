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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PcsController = void 0;
const common_1 = require("@nestjs/common");
const pcs_service_1 = require("./pcs.service");
let PcsController = class PcsController {
    constructor(pcsService) {
        this.pcsService = pcsService;
    }
    async getHealth() {
        return this.pcsService.getHealth();
    }
};
exports.PcsController = PcsController;
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PcsController.prototype, "getHealth", null);
exports.PcsController = PcsController = __decorate([
    (0, common_1.Controller)('pcs'),
    __metadata("design:paramtypes", [pcs_service_1.PcsService])
], PcsController);
//# sourceMappingURL=pcs.controller.js.map