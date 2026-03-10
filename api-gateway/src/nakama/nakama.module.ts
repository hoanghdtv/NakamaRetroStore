import { Module } from '@nestjs/common';
import { NakamaService } from './nakama.service';

@Module({
  providers: [NakamaService],
  exports: [NakamaService],
})
export class NakamaModule {}
