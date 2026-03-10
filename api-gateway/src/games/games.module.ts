import { Module } from '@nestjs/common';
import { NakamaModule } from '../nakama/nakama.module';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';

@Module({
  imports: [NakamaModule],
  providers: [GamesService],
  controllers: [GamesController],
})
export class GamesModule {}
