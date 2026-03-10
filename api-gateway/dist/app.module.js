"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nakama_module_1 = require("./nakama/nakama.module");
const games_module_1 = require("./games/games.module");
const achievements_module_1 = require("./achievements/achievements.module");
const leaderboard_module_1 = require("./leaderboard/leaderboard.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            nakama_module_1.NakamaModule,
            games_module_1.GamesModule,
            achievements_module_1.AchievementsModule,
            leaderboard_module_1.LeaderboardModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map