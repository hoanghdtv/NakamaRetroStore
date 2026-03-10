import { NakamaService } from '../nakama/nakama.service';
export interface RAAchievement {
    gameId: number;
    gameTitle: string;
    achievementId: number;
    title: string;
    description: string;
    points: number;
    trueRatio: number;
    type: string | null;
    author: string | null;
    badgeUrl: string | null;
    numAwarded: number;
    numAwardedHardcore: number;
    displayOrder: number;
    memAddr: string;
}
export interface CustomAchievement {
    id: string;
    game_id: string;
    title: string;
    description: string;
    points: number;
    icon: string;
    created_at: number;
}
export declare class AchievementsService {
    private readonly nakama;
    constructor(nakama: NakamaService);
    getRAAchievementById(achievementId: number): Promise<RAAchievement>;
    listRAAchievementsByGame(gameId: number, consoleId?: number): Promise<RAAchievement[]>;
    getCustomAchievementById(achievementId: string): Promise<CustomAchievement>;
    listCustomAchievementsByGame(gameId: string): Promise<CustomAchievement[]>;
}
