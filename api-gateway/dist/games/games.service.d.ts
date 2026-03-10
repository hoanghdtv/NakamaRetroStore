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
export declare class GamesService {
    private readonly nakama;
    constructor(nakama: NakamaService);
    listConsoles(): Promise<RAConsole[]>;
    getGameById(gameId: number): Promise<RAGame>;
    listGamesByConsole(consoleId: number, limit?: number, offset?: number): Promise<RAGame[]>;
    searchGames(query: string, consoleId?: number, limit?: number): Promise<RAGame[]>;
    getRelatedGames(gameId: number): Promise<RAGame[]>;
}
