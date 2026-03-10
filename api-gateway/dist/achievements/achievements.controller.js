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
exports.AchievementsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const achievements_service_1 = require("./achievements.service");
let AchievementsController = class AchievementsController {
    constructor(svc) {
        this.svc = svc;
    }
    async getRaById(id) {
        const ach = await this.svc.getRAAchievementById(id);
        if (!ach)
            throw new common_1.NotFoundException('Achievement not found');
        return ach;
    }
    listRaByGame(gameId, consoleId) {
        return this.svc.listRAAchievementsByGame(parseInt(gameId, 10), consoleId !== undefined ? parseInt(consoleId, 10) : undefined);
    }
    async getCustomById(id) {
        const ach = await this.svc.getCustomAchievementById(id);
        if (!ach)
            throw new common_1.NotFoundException('Achievement not found');
        return ach;
    }
    listCustomByGame(gameId) {
        return this.svc.listCustomAchievementsByGame(gameId);
    }
};
exports.AchievementsController = AchievementsController;
__decorate([
    (0, common_1.Get)('ra-achievements/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a RetroAchievement by numeric ID' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AchievementsController.prototype, "getRaById", null);
__decorate([
    (0, common_1.Get)('ra-achievements'),
    (0, swagger_1.ApiOperation)({ summary: 'List RetroAchievements for a game' }),
    (0, swagger_1.ApiQuery)({ name: 'game_id', required: true, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'console_id', required: false, type: Number }),
    __param(0, (0, common_1.Query)('game_id')),
    __param(1, (0, common_1.Query)('console_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AchievementsController.prototype, "listRaByGame", null);
__decorate([
    (0, common_1.Get)('achievements/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a custom achievement by UUID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AchievementsController.prototype, "getCustomById", null);
__decorate([
    (0, common_1.Get)('achievements'),
    (0, swagger_1.ApiOperation)({ summary: 'List custom achievements for a game' }),
    (0, swagger_1.ApiQuery)({ name: 'game_id', required: true, type: String }),
    __param(0, (0, common_1.Query)('game_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AchievementsController.prototype, "listCustomByGame", null);
exports.AchievementsController = AchievementsController = __decorate([
    (0, swagger_1.ApiTags)('achievements'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [achievements_service_1.AchievementsService])
], AchievementsController);
//# sourceMappingURL=achievements.controller.js.map