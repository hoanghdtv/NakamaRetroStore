import { Module } from '@nestjs/common';
import { NakamaModule } from '../nakama/nakama.module';
import { AchievementsService } from './achievements.service';
import { AchievementsController } from './achievements.controller';

@Module({
  imports: [NakamaModule],
  providers: [AchievementsService],
  controllers: [AchievementsController],
})
export class AchievementsModule {}
