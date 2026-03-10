import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GamesService } from './games.service';

@ApiTags('games')
@Controller('games')
export class GamesController {
  constructor(private readonly games: GamesService) {}

  // GET /games/consoles
  @Get('consoles')
  @ApiOperation({ summary: 'List all supported consoles' })
  listConsoles() {
    return this.games.listConsoles();
  }

  // GET /games/:id
  @Get(':id')
  @ApiOperation({ summary: 'Get a game by ID' })
  async getById(@Param('id', ParseIntPipe) id: number) {
    const game = await this.games.getGameById(id);
    if (!game) throw new NotFoundException('Game not found');
    return game;
  }

  // GET /games?console_id=7&limit=50&offset=0
  @Get()
  @ApiOperation({ summary: 'List games by console or search by title' })
  @ApiQuery({ name: 'console_id', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Search query' })
  listOrSearch(
    @Query('console_id') consoleId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('q') q?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const consoleIdNum = consoleId ? parseInt(consoleId, 10) : undefined;

    if (q) {
      return this.games.searchGames(q, consoleIdNum, limitNum);
    }

    if (consoleIdNum !== undefined) {
      return this.games.listGamesByConsole(consoleIdNum, limitNum, offsetNum);
    }

    return this.games.listConsoles();
  }

  // GET /games/:id/related
  @Get(':id/related')
  @ApiOperation({ summary: 'Get games related to a given game' })
  getRelated(@Param('id', ParseIntPipe) id: number) {
    return this.games.getRelatedGames(id);
  }
}
