// ROMs & Leaderboard module

// ─── RPC: Look up game by ROM MD5 hash ───────────────────────────────────────
// POST /v2/rpc/roms-by-md5?http_key=<key>
// Payload: { "md5": "8e3630186e35d477231bf8fd50e54cdd" }
// Tuỳ chọn thêm "console_id" để tìm nhanh hơn trong một platform.
function rpcGetRomByMd5(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    let req: { md5: string; console_id?: number };
    try { req = JSON.parse(payload); } catch (_) { throw new Error('Invalid JSON payload'); }
    if (!req.md5 || req.md5.trim() === '') throw new Error('md5 is required');

    const md5Lower = req.md5.trim().toLowerCase();

    const ck = CK.romByMd5(md5Lower);
    const hit = cache.get<RARom>(ck);
    if (hit) return JSON.stringify(hit);

    const rows = nk.sqlQuery(
        `SELECT gameid, gametitle, md5, romname, labels, patchurl, region
         FROM md5 WHERE LOWER(md5) = $1 LIMIT 1`,
        [md5Lower]
    );
    if (rows.length === 0) throw new Error('ROM not found');

    const rom = rowToRom(rows[0]);
    cache.set(ck, rom, TTL_ROMS_BY_MD5);
    return JSON.stringify(rom);
}

// ─── RPC: List ROMs for a game ────────────────────────────────────────────────
// POST /v2/rpc/roms-by-game?http_key=<key>
// Payload: { "game_id": 1446 }
function rpcListRomsByGame(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    let req: { game_id: number };
    try { req = JSON.parse(payload); } catch (_) { throw new Error('Invalid JSON payload'); }
    if (!req.game_id) throw new Error('game_id is required');

    const ck = CK.romsByGame(req.game_id);
    const hit = cache.get<RARom[]>(ck);
    if (hit) return JSON.stringify(hit);

    const rows = nk.sqlQuery(
        `SELECT gameid, gametitle, md5, romname, labels, patchurl, region
         FROM md5 WHERE gameid = $1`,
        [req.game_id]
    );
    const result = rows.map(rowToRom);
    cache.set(ck, result, TTL_ROMS_BY_GAME);
    return JSON.stringify(result);
}

// ─── RPC: Leaderboard (top users by total_points) ─────────────────────────────
// GET /v2/rpc/users-leaderboard?http_key=<key>
// Payload (optional): { "limit": 20 }
function rpcUsersLeaderboard(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    let limit = 20;
    if (payload) {
        try {
            const req = JSON.parse(payload);
            if (typeof req.limit === 'number') limit = Math.min(req.limit, 100);
        } catch (_) {}
    }

    // Query Nakama's storage table directly for user profiles
    const rows = nk.sqlQuery(
        `SELECT user_id, value->>'username' AS username, (value->>'total_points')::int AS total_points
         FROM storage
         WHERE collection = $1 AND key = $2
           AND (value->>'total_points')::int > 0
         ORDER BY (value->>'total_points')::int DESC
         LIMIT $3`,
        [COLLECTION_USERS, KEY_PROFILE, limit]
    );

    const board = rows.map((r, i) => ({
        rank:         i + 1,
        user_id:      r['user_id'],
        username:     r['username'],
        total_points: r['total_points'],
    }));

    return JSON.stringify(board);
}
