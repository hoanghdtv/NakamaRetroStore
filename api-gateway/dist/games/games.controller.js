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
exports.GamesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const games_service_1 = require("./games.service");
let GamesController = class GamesController {
    constructor(games) {
        this.games = games;
    }
    listConsoles() {
        return this.games.listConsoles();
    }
    async getById(id) {
        const game = await this.games.getGameById(id);
        if (!game)
            throw new common_1.NotFoundException('Game not found');
        return game;
    }
    listOrSearch(consoleId, limit, offset, q) {
        const limitNum = limit ? parseInt(limit, 10) : 50;
        const offsetNum = offset ? parseInt(offset, 10) : 0;
        const consoleIdNum = consoleId ? parseInt(consoleId, 10) : undefined;
        if (q) {
            return this.games.searchGames(q, consoleIdNum, limitNum);
        }
        if (consoleIdNum !== undefined) {
            return this.games.listGamesByConsole(consoleIdNum, limitNum, offsetNum);
        }
        return this.games.listConsoles();
    }
    getRelated(id) {
        return this.games.getRelatedGames(id);
    }
};
exports.GamesController = GamesController;
__decorate([
    (0, common_1.Get)('consoles'),
    (0, swagger_1.ApiOperation)({ summary: 'List all supported consoles' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], GamesController.prototype, "listConsoles", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a game by ID' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List games by console or search by title' }),
    (0, swagger_1.ApiQuery)({ name: 'console_id', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: false, type: String, description: 'Search query' }),
    __param(0, (0, common_1.Query)('console_id')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __param(3, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], GamesController.prototype, "listOrSearch", null);
__decorate([
    (0, common_1.Get)(':id/related'),
    (0, swagger_1.ApiOperation)({ summary: 'Get games related to a given game' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], GamesController.prototype, "getRelated", null);
exports.GamesController = GamesController = __decorate([
    (0, swagger_1.ApiTags)('games'),
    (0, common_1.Controller)('games'),
    __metadata("design:paramtypes", [games_service_1.GamesService])
], GamesController);
//# sourceMappingURL=games.controller.js.map