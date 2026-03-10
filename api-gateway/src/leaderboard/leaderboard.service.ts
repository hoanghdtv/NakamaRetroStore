import { Injectable } from '@nestjs/common';
import { NakamaService } from '../nakama/nakama.service';

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  total_points: number;
}

@Injectable()
export class LeaderboardService {
  constructor(private readonly nakama: NakamaService) {}

  getLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
    return this.nakama.rpc<LeaderboardEntry[]>('users-leaderboard', { limit });
  }
}
