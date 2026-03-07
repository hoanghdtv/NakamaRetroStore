// Games & RA-Achievements module — queries PostgreSQL tables populated from db/*.sql dumps

// ─── Console → table prefix mapping ──────────────────────────────────────────

/** Maps RetroAchievements consoleId → SQL table prefix */
const CONSOLE_PREFIX: Record<number, string> = {
    1:  'sega',
    2:  'n64',
    3:  'snes',
    5:  'gba',
    6:  'gbc',
    7:  'nes',
    12: 'psx',
    16: 'gamecube',
    18: 'nds',
    27: 'mame',
    41: 'psp',
};

/** All known prefixes (for cross-platform UNION queries) */
const ALL_PREFIXES: string[] = [1, 2, 3, 5, 6, 7, 12, 16, 18, 27, 41].map((id: number) => CONSOLE_PREFIX[id]);

/** Separate collection for RA unlocks — tránh lẫn với custom achievements */
const COLLECTION_RA_USER_ACHIEVEMENTS = 'ra_user_achievements';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RAConsole {
    id: number;
    name: string;
    iconUrl: string;
    active: boolean;
    isGameSystem: boolean;
}

interface RAGame {
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

interface RAAchievement {
    gameId: number;
    gameTitle: string;
    achievementId: number;
    title: string;
    description: string;
    points: number;
    trueRatio: number;
    type: string | null;
    author: string | null;
    badgeUrl: string | null;
    numAwarded: number;
    numAwardedHardcore: number;
    displayOrder: number;
    memAddr: string;
}

interface RARom {
    gameId: number;
    gameTitle: string;
    md5: string;
    romName: string;
    labels: string | null;
    patchUrl: string | null;
    region: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requirePrefix(consoleId: number): string {
    const p = CONSOLE_PREFIX[consoleId];
    if (!p) throw new Error(`Unsupported consoleId: ${consoleId}`);
    return p;
}

function rowToGame(r: {[k: string]: any}): RAGame {
    return {
        rank:           r['rank'] ?? 0,
        id:             r['id'],
        title:          r['title'],
        consoleName:    r['consolename'],
        consoleId:      r['consoleid'],
        totalPlayers:   r['totalplayers'] ?? 0,
        numAchievements:r['numachievements'] ?? 0,
        points:         r['points'] ?? 0,
        genre:          r['genre'],
        developer:      r['developer'],
        publisher:      r['publisher'],
        released:       r['released'],
        description:    r['description'],
        icon:           r['icon'],
        boxArt:         r['boxart'],
        titleScreen:    r['titlescreen'],
        screenshot:     r['screenshot'],
        rating:         r['rating'] ?? 0,
    };
}

function rowToAchievement(r: {[k: string]: any}): RAAchievement {
    return {
        gameId:             r['gameid'],
        gameTitle:          r['gametitle'],
        achievementId:      r['achievementid'],
        title:              r['title'],
        description:        r['description'],
        points:             r['points'] ?? 0,
        trueRatio:          r['trueratio'] ?? 0,
        type:               r['type'],
        author:             r['author'],
        badgeUrl:           r['badgeurl'],
        numAwarded:         r['numawarded'] ?? 0,
        numAwardedHardcore: r['numawardedhardcore'] ?? 0,
        displayOrder:       r['displayorder'] ?? 0,
        memAddr:            r['memaddr'] ?? '',
    };
}

function rowToRom(r: {[k: string]: any}): RARom {
    return {
        gameId:    r['gameid'],
        gameTitle: r['gametitle'],
        md5:       r['md5'],
        romName:   r['romname'],
        labels:    r['labels'],
        patchUrl:  r['patchurl'],
        region:    r['region'],
    };
}

// ─── RPC: List all consoles ───────────────────────────────────────────────────
// GET /v2/rpc/games-consoles?http_key=<key>
function rpcListConsoles(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    const ck = CK.consoles();
    const hit = cache.get<RAConsole[]>(ck);
    if (hit) return JSON.stringify(hit);

    const rows = nk.sqlQuery('SELECT id, name, "iconurl" AS iconurl, active, "isgamesystem" AS isgamesystem FROM ra_consoles ORDER BY id', []);
    const consoles: RAConsole[] = rows.map(r => ({
        id:           r['id'],
        name:         r['name'],
        iconUrl:      r['iconurl'],
        active:       r['active'],
        isGameSystem: r['isgamesystem'],
    }));
    cache.set(ck, consoles, TTL_CONSOLES);
    return JSON.stringify(consoles);
}

// ─── RPC: List games by console ───────────────────────────────────────────────
// POST /v2/rpc/games-by-console?http_key=<key>
// Payload: { "console_id": 7, "limit": 50, "offset": 0 }
function rpcListGamesByConsole(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    let req: { console_id: number; limit?: number; offset?: number };
    try { req = JSON.parse(payload); } catch (_) { throw new Error('Invalid JSON payload'); }
    if (!req.console_id) throw new Error('console_id is required');

    const prefix = requirePrefix(req.console_id);
    const limit  = Math.min(req.limit ?? 50, 200);
    const offset = req.offset ?? 0;

    const ck = CK.gamesByConsole(req.console_id, limit, offset);
    const hit = cache.get<RAGame[]>(ck);
    if (hit) return JSON.stringify(hit);

    const rows = nk.sqlQuery(
        `SELECT rank, id, title, consolename, consoleid, totalplayers, numachievements, points, genre, developer, publisher, released, icon, boxart, rating
         FROM ${prefix}_games
         ORDER BY rank
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );
    const result = rows.map(rowToGame);
    cache.set(ck, result, TTL_GAMES_BY_CONSOLE);
    return JSON.stringify(result);
}

// ─── RPC: Get game by ID (searches across all platforms) ─────────────────────
// POST /v2/rpc/games-by-id?http_key=<key>
// Payload: { "game_id": 1446 }
function rpcGetGameById(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    let req: { game_id: number };
    try { req = JSON.parse(payload); } catch (_) { throw new Error('Invalid JSON payload'); }
    if (!req.game_id) throw new Error('game_id is required');

    const ck = CK.gameById(req.game_id);
    const hit = cache.get<RAGame>(ck);
    if (hit) return JSON.stringify(hit);

    const unionParts = ALL_PREFIXES.map((p: string) =>
        `SELECT rank, id, title, consolename, consoleid, totalplayers, casualplayers, hardcoreplayers,
                numachievements, points, genre, developer, publisher, released, description,
                icon, boxart, titlescreen, screenshot, rating
         FROM ${p}_games WHERE id = $1`
    );
    const rows = nk.sqlQuery(unionParts.join(' UNION ALL ') + ' LIMIT 1', [req.game_id]);
    if (rows.length === 0) throw new Error('Game not found');

    const game = rowToGame(rows[0]);
    cache.set(ck, game, TTL_GAME_BY_ID);
    return JSON.stringify(game);
}

// ─── RPC: Search games by title ───────────────────────────────────────────────
// POST /v2/rpc/games-search?http_key=<key>
// Payload: { "query": "mario", "console_id": 7, "limit": 20 }
function rpcSearchGames(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    let req: { query: string; console_id?: number; limit?: number };
    try { req = JSON.parse(payload); } catch (_) { throw new Error('Invalid JSON payload'); }
    if (!req.query || req.query.trim() === '') throw new Error('query is required');

    const limit   = Math.min(req.limit ?? 20, 100);
    const q       = req.query.trim().toLowerCase();
    const pattern = `%${q}%`;

    const ck = CK.gamesSearch(q, req.console_id, limit);
    const hit = cache.get<RAGame[]>(ck);
    if (hit) return JSON.stringify(hit);

    let prefixes: string[];
    if (req.console_id) {
        prefixes = [requirePrefix(req.console_id)];
    } else {
        prefixes = ALL_PREFIXES;
    }

    const unionParts = prefixes.map((p: string) =>
        `SELECT rank, id, title, consolename, consoleid, totalplayers, numachievements, points,
                genre, developer, publisher, released, icon, boxart, rating
         FROM ${p}_games WHERE LOWER(title) LIKE LOWER($1)`
    );

    const rows = nk.sqlQuery(
        unionParts.join(' UNION ALL ') + ` ORDER BY rank LIMIT $2`,
        [pattern, limit]
    );
    const result = rows.map(rowToGame);
    cache.set(ck, result, TTL_GAMES_SEARCH);
    return JSON.stringify(result);
}

// ─── RPC: Get related games ───────────────────────────────────────────────────
// POST /v2/rpc/games-related?http_key=<key>
// Payload: { "game_id": 1446 }
function rpcGetRelatedGames(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    let req: { game_id: number };
    try { req = JSON.parse(payload); } catch (_) { throw new Error('Invalid JSON payload'); }
    if (!req.game_id) throw new Error('game_id is required');

    const ck = CK.gamesRelated(req.game_id);
    const hit = cache.get<RAGame[]>(ck);
    if (hit) return JSON.stringify(hit);

    const relRows = nk.sqlQuery('SELECT related FROM related_roms WHERE id = $1 LIMIT 1', [req.game_id]);
    if (relRows.length === 0 || !relRows[0]['related']) return JSON.stringify([]);

    const relatedIds: number[] = (relRows[0]['related'] as string)
        .split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n));

    if (relatedIds.length === 0) return JSON.stringify([]);

    const placeholders = relatedIds.map((_, i) => `$${i + 1}`).join(', ');
    const unionParts = ALL_PREFIXES.map((p: string) =>
        `SELECT rank, id, title, consolename, consoleid, totalplayers, numachievements, points,
                genre, developer, publisher, released, icon, boxart, rating
         FROM ${p}_games WHERE id IN (${placeholders})`
    );

    const rows = nk.sqlQuery(unionParts.join(' UNION ALL '), relatedIds);
    const result = rows.map(rowToGame);
    cache.set(ck, result, TTL_GAMES_RELATED);
    return JSON.stringify(result);
}

// ─── RPC: List RA achievements by game ───────────────────────────────────────
// POST /v2/rpc/ra-achievements-by-game?http_key=<key>
// Payload: { "game_id": 1446, "console_id": 7 }
function rpcListRAGAchievementsByGame(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    let req: { game_id: number; console_id: number };
    try { req = JSON.parse(payload); } catch (_) { throw new Error('Invalid JSON payload'); }
    if (!req.game_id)    throw new Error('game_id is required');
    if (!req.console_id) throw new Error('console_id is required');

    const prefix = requirePrefix(req.console_id);
    const rows = nk.sqlQuery(
        `SELECT gameid, gametitle, achievementid, title, description, points, trueratio,
                type, author, badgeurl, numawarded, numawardedhardcore, displayorder, memaddr
         FROM ${prefix}_achievements
         WHERE gameid = $1
         ORDER BY displayorder`,
        [req.game_id]
    );

    return JSON.stringify(rows.map(rowToAchievement));
}

// ─── RPC: Get single RA achievement by ID ────────────────────────────────────
// POST /v2/rpc/ra-achievements-by-id?http_key=<key>
// Payload: { "achievement_id": 3159 }
function rpcGetRAAchievementById(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    let req: { achievement_id: number };
    try { req = JSON.parse(payload); } catch (_) { throw new Error('Invalid JSON payload'); }
    if (!req.achievement_id) throw new Error('achievement_id is required');

    const ck = CK.achById(req.achievement_id);
    const hit = cache.get<RAAchievement>(ck);
    if (hit) return JSON.stringify(hit);

    const unionParts = ALL_PREFIXES.map((p: string) =>
        `SELECT gameid, gametitle, achievementid, title, description, points, trueratio,
                type, author, badgeurl, numawarded, numawardedhardcore, displayorder, memaddr
         FROM ${p}_achievements WHERE achievementid = $1`
    );
    const rows = nk.sqlQuery(
        unionParts.join(' UNION ALL ') + ' LIMIT 1',
        [req.achievement_id]
    );
    if (rows.length === 0) throw new Error('Achievement not found');

    const ach = rowToAchievement(rows[0]);
    cache.set(ck, ach, TTL_ACH_BY_ID);
    return JSON.stringify(ach);
}

// ─── RPC: Unlock a RetroAchievement (adds points to user profile) ─────────────
// POST /v2/rpc/ra-achievements-unlock
// Authorization: Bearer <token>
// Payload: { "achievement_id": 3159 }
function rpcUnlockRAAchievement(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    if (!ctx.userId) throw new Error('Authentication required');

    let req: { achievement_id: number };
    try { req = JSON.parse(payload); } catch (_) { throw new Error('Invalid JSON payload'); }
    if (!req.achievement_id) throw new Error('achievement_id is required');

    // Check if already unlocked in Nakama storage
    const lockKey  = `${req.achievement_id}`;
    const existing = nk.storageRead([{
        collection: COLLECTION_RA_USER_ACHIEVEMENTS,
        key:        lockKey,
        userId:     ctx.userId,
    }]);

    if (existing.length > 0) {
        const ua = existing[0].value as { unlocked_at: number; points_earned: number };
        return JSON.stringify({ already_unlocked: true, unlocked_at: ua.unlocked_at, points_earned: ua.points_earned });
    }

    // Fetch achievement from DB (search across all platforms)
    const achUnion = ALL_PREFIXES.map((p: string) =>
        `SELECT achievementid, title, points, gameid, gametitle, badgeurl
         FROM ${p}_achievements WHERE achievementid = $1`
    ).join(' UNION ALL ');
    const achRows = nk.sqlQuery(achUnion + ' LIMIT 1', [req.achievement_id]);
    if (achRows.length === 0) throw new Error('Achievement not found');

    const achRow      = achRows[0];
    const pointsEarned: number = achRow['points'] ?? 0;
    const unlockedAt  = Math.floor(Date.now() / 1000);

    // Write unlock record
    nk.storageWrite([{
        collection:      COLLECTION_RA_USER_ACHIEVEMENTS,
        key:             lockKey,
        userId:          ctx.userId,
        value: {
            achievement_id:    req.achievement_id,
            achievement_title: achRow['title'],
            game_id:           achRow['gameid'],
            game_title:        achRow['gametitle'],
            badge_url:         achRow['badgeurl'],
            points_earned:     pointsEarned,
            unlocked_at:       unlockedAt,
        },
        permissionRead:  2,
        permissionWrite: 0,
    }]);

    // Add points to user profile — reuse helper từ users.ts
    if (pointsEarned > 0) {
        let profile = storageGetProfile(nk, ctx.userId);
        if (!profile) {
            const account = nk.accountGetId(ctx.userId);
            const user = account.user!;
            profile = {
                id:           ctx.userId,
                username:     user.username ?? '',
                email:        account.email ?? '',
                created_at:   Math.floor(new Date(user.createTime!).getTime() / 1000),
                total_points: 0,
            };
        }
        profile.total_points += pointsEarned;
        storageUpsertProfile(nk, ctx.userId, profile);
    }

    logger.info('User %s unlocked RA achievement %d (+%d pts)', ctx.userId, req.achievement_id, pointsEarned);

    return JSON.stringify({
        already_unlocked:  false,
        unlocked_at:       unlockedAt,
        points_earned:     pointsEarned,
        achievement_title: achRow['title'],
        game_title:        achRow['gametitle'],
    });
}

// ─── RPC: List my unlocked RA achievements ────────────────────────────────────
// GET /v2/rpc/ra-achievements-list
// Authorization: Bearer <token>
// Payload (optional): { "limit": 50, "cursor": "..." }
function rpcListMyRAAchievements(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    if (!ctx.userId) throw new Error('Authentication required');

    let limit  = 50;
    let cursor: string | undefined;
    if (payload) {
        try {
            const req = JSON.parse(payload);
            if (typeof req.limit  === 'number') limit  = Math.min(req.limit, 200);
            if (typeof req.cursor === 'string') cursor = req.cursor;
        } catch (_) {}
    }

    const result = nk.storageList(ctx.userId, COLLECTION_RA_USER_ACHIEVEMENTS, limit, cursor);
    const unlocks = (result.objects || []).map((o: nkruntime.StorageObject) => o.value);

    return JSON.stringify({ unlocks, cursor: result.cursor });
}

// ─── RPC: Get user stats summary ─────────────────────────────────────────────
// GET /v2/rpc/users-me-stats
// Authorization: Bearer <token>
function rpcGetMyStats(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    if (!ctx.userId) throw new Error('Authentication required');

    // Count unlocks
    let totalUnlocked = 0;
    let cursor: string | undefined;
    do {
        const page = nk.storageList(ctx.userId, COLLECTION_RA_USER_ACHIEVEMENTS, 200, cursor);
        totalUnlocked += (page.objects || []).length;
        cursor = page.cursor;
    } while (cursor);

    // Load profile for total_points
    const profileObjs = nk.storageRead([{ collection: COLLECTION_USERS, key: KEY_PROFILE, userId: ctx.userId }]);
    const profile: any = profileObjs.length > 0 ? profileObjs[0].value : {};

    return JSON.stringify({
        user_id:           ctx.userId,
        total_points:      profile.total_points ?? 0,
        achievements_unlocked: totalUnlocked,
    });
}
