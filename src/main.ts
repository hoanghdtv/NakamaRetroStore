function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {

    // ── Nakama native leaderboards ────────────────────────────────────────────
    // All-time: no reset, operator=set (tracks absolute unlocked count per user)
    nk.leaderboardCreate(LEADERBOARD_ACH_ALLTIME, false, nkruntime.SortOrder.DESCENDING, nkruntime.Operator.SET,         null,       null);
    // Weekly: resets every Monday at 00:00 UTC, operator=increment (counts unlocks within the week)
    nk.leaderboardCreate(LEADERBOARD_ACH_WEEKLY,  false, nkruntime.SortOrder.DESCENDING, nkruntime.Operator.INCREMENTAL, '0 0 * * 1', null);
    // Monthly: resets on 1st of each month at 00:00 UTC, operator=increment
    nk.leaderboardCreate(LEADERBOARD_ACH_MONTHLY, false, nkruntime.SortOrder.DESCENDING, nkruntime.Operator.INCREMENTAL, '0 0 1 * *', null);

    // ── User endpoints (require Bearer token) ────────────────────────────────
    // GET  /v2/rpc/users-me
    initializer.registerRpc('users-me',                   rpcGetUserProfile);
    // POST /v2/rpc/users-me-points  { "points": 100 }
    initializer.registerRpc('users-me-points',            rpcAddUserPoints);
    // POST /v2/rpc/users-by-id  { "user_id": "..." }
    initializer.registerRpc('users-by-id',                rpcGetUserProfileById);
    // GET  /v2/rpc/users-me-stats
    initializer.registerRpc('users-me-stats',             rpcGetMyStats);
    // GET  /v2/rpc/users-leaderboard?http_key=<key>  { "limit": 20 }
    initializer.registerRpc('users-leaderboard',          rpcUsersLeaderboard);

    // ── Custom Achievement endpoints (Nakama storage) ─────────────────────────
    // user achievements (unlocks, list) are stored in Nakama's storage engine for simplicity; since they are user-specific and change frequently, caching is not effective here.
    // POST /v2/rpc/achievements-create?http_key=<key>  { game_id, title, description, points, icon }
    initializer.registerRpc('achievements-create',        rpcCreateAchievement);
    // POST /v2/rpc/achievements-by-id?http_key=<key>   { "achievement_id": "..." }
    initializer.registerRpc('achievements-by-id',         rpcGetAchievement);
    // POST /v2/rpc/achievements-by-game?http_key=<key> { "game_id": "..." }
    initializer.registerRpc('achievements-by-game',       rpcListGameAchievements);
    // POST /v2/rpc/user-achievements-unlock  { "achievement_id": "..." }
    initializer.registerRpc('user-achievements-unlock',   rpcUnlockAchievement);
    // GET  /v2/rpc/user-achievements-list
    initializer.registerRpc('user-achievements-list',     rpcGetUserAchievements);
    // GET  /v2/rpc/achievements-leaderboard?http_key=<key>  { "limit": 20, "cursor": "" }
    initializer.registerRpc('achievements-leaderboard',   rpcAchievementsLeaderboard);

    // ── Games & Consoles (PostgreSQL DB) ──────────────────────────────────────
    // GET  /v2/rpc/games-consoles?http_key=<key>
    // initializer.registerRpc('games-consoles',             rpcListConsoles);
    // // POST /v2/rpc/games-by-console?http_key=<key>  { "console_id": 7, "limit": 50, "offset": 0 }
    // initializer.registerRpc('games-by-console',           rpcListGamesByConsole);
    // // POST /v2/rpc/games-by-id?http_key=<key>        { "game_id": 1446 }
    // initializer.registerRpc('games-by-id',                rpcGetGameById);
    // // POST /v2/rpc/games-search?http_key=<key>       { "query": "mario", "console_id": 7, "limit": 20 }
    // initializer.registerRpc('games-search',               rpcSearchGames);
    // // POST /v2/rpc/games-related?http_key=<key>      { "game_id": 1446 }
    // initializer.registerRpc('games-related',              rpcGetRelatedGames);

    // server-side caching for game data (since it doesn't change often and can be expensive to query)
    // ── RetroAchievements (PostgreSQL DB) ─────────────────────────────────────
    // POST /v2/rpc/ra-achievements-by-game?http_key=<key>  { "game_id": 1446 }
    initializer.registerRpc('ra-achievements-by-game',    rpcListRAGAchievementsByGame);
    // POST /v2/rpc/ra-achievements-by-id?http_key=<key>    { "achievement_id": 3159 }
    initializer.registerRpc('ra-achievements-by-id',      rpcGetRAAchievementById);
    // POST /v2/rpc/ra-achievements-unlock  (Bearer token)  { "achievement_id": 3159 }
    initializer.registerRpc('ra-achievements-unlock',     rpcUnlockRAAchievement);
    // GET  /v2/rpc/ra-achievements-list   (Bearer token)   { "limit": 50, "cursor": "..." }
    initializer.registerRpc('ra-achievements-list',       rpcListMyRAAchievements);

    // ── ROMs (PostgreSQL DB) ──────────────────────────────────────────────────
    // POST /v2/rpc/roms-by-md5?http_key=<key>   { "md5": "..." }  — console_id optional để tăng tốc
    initializer.registerRpc('roms-by-md5',                rpcGetRomByMd5);
    // POST /v2/rpc/roms-by-game?http_key=<key>  { "game_id": 1446 }
    initializer.registerRpc('roms-by-game',               rpcListRomsByGame);

    logger.info('Retro Achievement module loaded.');
}
