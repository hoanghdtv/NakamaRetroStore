import { Injectable } from '@nestjs/common';
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

@Injectable()
export class AchievementsService {
  constructor(private readonly nakama: NakamaService) {}

  // ── RetroAchievements (from SQL dumps) ────────────────────────────────────

  getRAAchievementById(achievementId: number): Promise<RAAchievement> {
    return this.nakama.rpc<RAAchievement>('ra-achievements-by-id', {
      achievement_id: achievementId,
    });
  }

  listRAAchievementsByGame(
    gameId: number,
    consoleId?: number,
  ): Promise<RAAchievement[]> {
    return this.nakama.rpc<RAAchievement[]>('ra-achievements-by-game', {
      game_id: gameId,
      ...(consoleId !== undefined && { console_id: consoleId }),
    });
  }

  // ── Custom achievements (Nakama storage) ──────────────────────────────────

  getCustomAchievementById(achievementId: string): Promise<CustomAchievement> {
    return this.nakama.rpc<CustomAchievement>('achievements-by-id', {
      achievement_id: achievementId,
    });
  }

  listCustomAchievementsByGame(gameId: string): Promise<CustomAchievement[]> {
    return this.nakama.rpc<CustomAchievement[]>('achievements-by-game', {
      game_id: gameId,
    });
  }
}
