import { NakamaService } from '../nakama/nakama.service';
export interface LeaderboardEntry {
    rank: number;
    user_id: string;
    username: string;
    total_points: number;
}
export declare class LeaderboardService {
    private readonly nakama;
    constructor(nakama: NakamaService);
    getLeaderboard(limit?: number): Promise<LeaderboardEntry[]>;
}
