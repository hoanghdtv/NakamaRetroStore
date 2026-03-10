import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AchievementsService } from './achievements.service';

@ApiTags('achievements')
@Controller()
export class AchievementsController {
  constructor(private readonly svc: AchievementsService) {}

  // ── RetroAchievements ─────────────────────────────────────────────────────

  // GET /ra-achievements/:id
  @Get('ra-achievements/:id')
  @ApiOperation({ summary: 'Get a RetroAchievement by numeric ID' })
  async getRaById(@Param('id', ParseIntPipe) id: number) {
    const ach = await this.svc.getRAAchievementById(id);
    if (!ach) throw new NotFoundException('Achievement not found');
    return ach;
  }

  // GET /ra-achievements?game_id=1446&console_id=7
  @Get('ra-achievements')
  @ApiOperation({ summary: 'List RetroAchievements for a game' })
  @ApiQuery({ name: 'game_id', required: true, type: Number })
  @ApiQuery({ name: 'console_id', required: false, type: Number })
  listRaByGame(
    @Query('game_id') gameId: string,
    @Query('console_id') consoleId?: string,
  ) {
    return this.svc.listRAAchievementsByGame(
      parseInt(gameId, 10),
      consoleId !== undefined ? parseInt(consoleId, 10) : undefined,
    );
  }

  // ── Custom achievements (Nakama storage) ──────────────────────────────────

  // GET /achievements/:id
  @Get('achievements/:id')
  @ApiOperation({ summary: 'Get a custom achievement by UUID' })
  async getCustomById(@Param('id') id: string) {
    const ach = await this.svc.getCustomAchievementById(id);
    if (!ach) throw new NotFoundException('Achievement not found');
    return ach;
  }

  // GET /achievements?game_id=<uuid>
  @Get('achievements')
  @ApiOperation({ summary: 'List custom achievements for a game' })
  @ApiQuery({ name: 'game_id', required: true, type: String })
  listCustomByGame(@Query('game_id') gameId: string) {
    return this.svc.listCustomAchievementsByGame(gameId);
  }
}
