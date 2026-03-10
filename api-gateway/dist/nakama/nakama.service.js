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
exports.NakamaService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
let NakamaService = class NakamaService {
    constructor(config) {
        this.config = config;
        const baseURL = config.get('NAKAMA_URL', 'http://nakama:7350');
        this.httpKey = config.get('NAKAMA_HTTP_KEY', 'retro_server_http_key');
        this.client = axios_1.default.create({
            baseURL,
            timeout: 10_000,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    async rpc(id, body = {}) {
        const resp = await this.client.post(`/v2/rpc/${id}`, JSON.stringify(body), { params: { http_key: this.httpKey } });
        return JSON.parse(resp.data.payload);
    }
};
exports.NakamaService = NakamaService;
exports.NakamaService = NakamaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], NakamaService);
//# sourceMappingURL=nakama.service.js.map