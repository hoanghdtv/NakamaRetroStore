import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly svc: LeaderboardService) {}

  // GET /leaderboard?limit=20
  @Get()
  @ApiOperation({ summary: 'Get top users ranked by total achievement points' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results (default 20, max 100)' })
  getLeaderboard(@Query('limit') limit?: string) {
    const limitNum = limit ? Math.min(parseInt(limit, 10), 100) : 20;
    return this.svc.getLeaderboard(limitNum);
  }
}
