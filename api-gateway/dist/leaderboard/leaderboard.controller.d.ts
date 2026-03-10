import { LeaderboardService } from './leaderboard.service';
export declare class LeaderboardController {
    private readonly svc;
    constructor(svc: LeaderboardService);
    getLeaderboard(limit?: string): Promise<import("./leaderboard.service").LeaderboardEntry[]>;
}
