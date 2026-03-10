import { AchievementsService } from './achievements.service';
export declare class AchievementsController {
    private readonly svc;
    constructor(svc: AchievementsService);
    getRaById(id: number): Promise<import("./achievements.service").RAAchievement>;
    listRaByGame(gameId: string, consoleId?: string): Promise<import("./achievements.service").RAAchievement[]>;
    getCustomById(id: string): Promise<import("./achievements.service").CustomAchievement>;
    listCustomByGame(gameId: string): Promise<import("./achievements.service").CustomAchievement[]>;
}
