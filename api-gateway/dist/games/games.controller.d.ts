import { GamesService } from './games.service';
export declare class GamesController {
    private readonly games;
    constructor(games: GamesService);
    listConsoles(): Promise<import("./games.service").RAConsole[]>;
    getById(id: number): Promise<import("./games.service").RAGame>;
    listOrSearch(consoleId?: string, limit?: string, offset?: string, q?: string): Promise<import("./games.service").RAConsole[]> | Promise<import("./games.service").RAGame[]>;
    getRelated(id: number): Promise<import("./games.service").RAGame[]>;
}
