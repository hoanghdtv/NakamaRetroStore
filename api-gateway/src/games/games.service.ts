import { Injectable } from '@nestjs/common';
import { NakamaService } from '../nakama/nakama.service';

export interface RAConsole {
  id: number;
  name: string;
  iconUrl: string;
  active: boolean;
  isGameSystem: boolean;
}

export interface RAGame {
  rank: number;
  id: number;
  title: string;
  consoleName: string;
  consoleId: number;
  totalPlayers: number;
  numAchievements: number;
  points: number;
  genre: string | null;
  developer: string | null;
  publisher: string | null;
  released: string | null;
  description: string | null;
  icon: string | null;
  boxArt: string | null;
  titleScreen: string | null;
  screenshot: string | null;
  rating: number;
}

@Injectable()
export class GamesService {
  constructor(private readonly nakama: NakamaService) {}

  listConsoles(): Promise<RAConsole[]> {
    return this.nakama.rpc<RAConsole[]>('games-consoles');
  }

  getGameById(gameId: number): Promise<RAGame> {
    return this.nakama.rpc<RAGame>('games-by-id', { game_id: gameId });
  }

  listGamesByConsole(
    consoleId: number,
    limit = 50,
    offset = 0,
  ): Promise<RAGame[]> {
    return this.nakama.rpc<RAGame[]>('games-by-console', {
      console_id: consoleId,
      limit,
      offset,
    });
  }

  searchGames(
    query: string,
    consoleId?: number,
    limit = 20,
  ): Promise<RAGame[]> {
    return this.nakama.rpc<RAGame[]>('games-search', {
      query,
      ...(consoleId !== undefined && { console_id: consoleId }),
      limit,
    });
  }

  getRelatedGames(gameId: number): Promise<RAGame[]> {
    return this.nakama.rpc<RAGame[]>('games-related', { game_id: gameId });
  }
}
