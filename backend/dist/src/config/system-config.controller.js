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
exports.SystemConfigController = void 0;
const common_1 = require("@nestjs/common");
const system_config_service_1 = require("./system-config.service");
let SystemConfigController = class SystemConfigController {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    getCards() {
        return this.configService.getCards();
    }
    createCard(data) {
        return this.configService.createCard(data);
    }
    deleteCard(id) {
        return this.configService.deleteCard(id);
    }
    getKeys() {
        return this.configService.getKeys();
    }
    updateKey(data) {
        return this.configService.updateKey(data.key, data.value);
    }
    getSuggestions() {
        return this.configService.getSuppliersAndCardsSuggestions();
    }
};
exports.SystemConfigController = SystemConfigController;
__decorate([
    (0, common_1.Get)('cards'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemConfigController.prototype, "getCards", null);
__decorate([
    (0, common_1.Post)('cards'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SystemConfigController.prototype, "createCard", null);
__decorate([
    (0, common_1.Delete)('cards/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SystemConfigController.prototype, "deleteCard", null);
__decorate([
    (0, common_1.Get)('keys'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemConfigController.prototype, "getKeys", null);
__decorate([
    (0, common_1.Post)('keys'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SystemConfigController.prototype, "updateKey", null);
__decorate([
    (0, common_1.Get)('suggestions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemConfigController.prototype, "getSuggestions", null);
exports.SystemConfigController = SystemConfigController = __decorate([
    (0, common_1.Controller)('config'),
    __metadata("design:paramtypes", [system_config_service_1.SystemConfigService])
], SystemConfigController);
//# sourceMappingURL=system-config.controller.js.map