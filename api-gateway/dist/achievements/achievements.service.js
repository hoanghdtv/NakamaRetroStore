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
exports.AchievementsService = void 0;
const common_1 = require("@nestjs/common");
const nakama_service_1 = require("../nakama/nakama.service");
let AchievementsService = class AchievementsService {
    constructor(nakama) {
        this.nakama = nakama;
    }
    getRAAchievementById(achievementId) {
        return this.nakama.rpc('ra-achievements-by-id', {
            achievement_id: achievementId,
        });
    }
    listRAAchievementsByGame(gameId, consoleId) {
        return this.nakama.rpc('ra-achievements-by-game', {
            game_id: gameId,
            ...(consoleId !== undefined && { console_id: consoleId }),
        });
    }
    getCustomAchievementById(achievementId) {
        return this.nakama.rpc('achievements-by-id', {
            achievement_id: achievementId,
        });
    }
    listCustomAchievementsByGame(gameId) {
        return this.nakama.rpc('achievements-by-game', {
            game_id: gameId,
        });
    }
};
exports.AchievementsService = AchievementsService;
exports.AchievementsService = AchievementsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [nakama_service_1.NakamaService])
], AchievementsService);
//# sourceMappingURL=achievements.service.js.map