import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NakamaModule } from './nakama/nakama.module';
import { GamesModule } from './games/games.module';
import { AchievementsModule } from './achievements/achievements.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    NakamaModule,
    GamesModule,
    AchievementsModule,
    LeaderboardModule,
  ],
})
export class AppModule {}
