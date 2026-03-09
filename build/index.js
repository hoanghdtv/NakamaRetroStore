"use strict";
// Users module for Retro Achievement system
var COLLECTION_USERS = 'users';
var KEY_PROFILE = 'profile';
// ─── Storage helpers ────────────────────────────────────────────────────────
function storageGetProfile(nk, userId) {
    var reads = [{
            collection: COLLECTION_USERS,
            key: KEY_PROFILE,
            userId: userId,
        }];
    var objects = nk.storageRead(reads);
    if (objects.length === 0)
        return null;
    return objects[0].value;
}
function storageUpsertProfile(nk, userId, profile) {
    var writes = [{
            collection: COLLECTION_USERS,
            key: KEY_PROFILE,
            userId: userId,
            value: profile,
            permissionRead: 2,
            permissionWrite: 0, // server-only write
        }];
    nk.storageWrite(writes);
}
// ─── RPC: Get own profile ────────────────────────────────────────────────────
// Client calls: rpc_get_user_profile (no payload needed)
function rpcGetUserProfile(ctx, logger, nk, payload) {
    var _a, _b;
    if (!ctx.userId) {
        throw Error('No user ID in context');
    }
    // Load Nakama account for authoritative info
    var account = nk.accountGetId(ctx.userId);
    var user = account.user;
    // Load or initialise stored profile
    var profile = storageGetProfile(nk, ctx.userId);
    if (!profile) {
        // First access — create profile from Nakama account data
        profile = {
            id: ctx.userId,
            username: (_a = user.username) !== null && _a !== void 0 ? _a : '',
            email: (_b = account.email) !== null && _b !== void 0 ? _b : '',
            created_at: Math.floor(new Date(user.createTime).getTime() / 1000),
            total_points: 0,
        };
        storageUpsertProfile(nk, ctx.userId, profile);
        logger.info('Created new user profile for %s', ctx.userId);
    }
    return JSON.stringify(profile);
}
// ─── RPC: Add points (server/admin only) ─────────────────────────────────────
// Payload: { "points": 100 }
function rpcAddUserPoints(ctx, logger, nk, payload) {
    var _a, _b;
    if (!ctx.userId) {
        throw Error('No user ID in context');
    }
    var req;
    try {
        req = JSON.parse(payload);
    }
    catch (e) {
        throw Error('Invalid JSON payload');
    }
    if (typeof req.points !== 'number' || req.points < 0) {
        throw Error('points must be a non-negative number');
    }
    var profile = storageGetProfile(nk, ctx.userId);
    if (!profile) {
        var account = nk.accountGetId(ctx.userId);
        var user = account.user;
        profile = {
            id: ctx.userId,
            username: (_a = user.username) !== null && _a !== void 0 ? _a : '',
            email: (_b = account.email) !== null && _b !== void 0 ? _b : '',
            created_at: Math.floor(new Date(user.createTime).getTime() / 1000),
            total_points: 0,
        };
    }
    profile.total_points += req.points;
    storageUpsertProfile(nk, ctx.userId, profile);
    logger.info('Added %d points to user %s (total: %d)', req.points, ctx.userId, profile.total_points);
    return JSON.stringify({ total_points: profile.total_points });
}
// ─── RPC: Get user profile by ID (public) ─────────────────────────────────────
// Payload: { "user_id": "..." }
function rpcGetUserProfileById(ctx, logger, nk, payload) {
    var req;
    try {
        req = JSON.parse(payload);
    }
    catch (e) {
        throw Error('Invalid JSON payload');
    }
    if (!req.user_id) {
        throw Error('user_id is required');
    }
    var profile = storageGetProfile(nk, req.user_id);
    if (!profile) {
        throw Error('User profile not found');
    }
    return JSON.stringify(profile);
}
// Achievements module for Retro Achievement system
var COLLECTION_ACHIEVEMENTS = 'achievements';
var COLLECTION_GAME_ACH_INDEX = 'game_achievement_index';
var COLLECTION_USER_ACHIEVEMENTS = 'user_achievements';
// System-level records are stored under this fixed user ID
var SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
// ─── Storage helpers ─────────────────────────────────────────────────────────
function achRead(nk, achievementId) {
    var objs = nk.storageRead([{
            collection: COLLECTION_ACHIEVEMENTS,
            key: achievementId,
            userId: SYSTEM_USER_ID,
        }]);
    return objs.length > 0 ? objs[0].value : null;
}
function achWrite(nk, ach) {
    nk.storageWrite([{
            collection: COLLECTION_ACHIEVEMENTS,
            key: ach.id,
            userId: SYSTEM_USER_ID,
            value: ach,
            permissionRead: 2,
            permissionWrite: 0, // server-only write
        }]);
}
function gameIndexRead(nk, gameId) {
    var objs = nk.storageRead([{
            collection: COLLECTION_GAME_ACH_INDEX,
            key: gameId,
            userId: SYSTEM_USER_ID,
        }]);
    return objs.length > 0 ? objs[0].value : { achievement_ids: [] };
}
function gameIndexWrite(nk, gameId, index) {
    nk.storageWrite([{
            collection: COLLECTION_GAME_ACH_INDEX,
            key: gameId,
            userId: SYSTEM_USER_ID,
            value: index,
            permissionRead: 2,
            permissionWrite: 0,
        }]);
}
function userAchRead(nk, userId, achievementId) {
    var objs = nk.storageRead([{
            collection: COLLECTION_USER_ACHIEVEMENTS,
            key: achievementId,
            userId: userId,
        }]);
    return objs.length > 0 ? objs[0].value : null;
}
function userAchWrite(nk, ua) {
    nk.storageWrite([{
            collection: COLLECTION_USER_ACHIEVEMENTS,
            key: ua.achievement_id,
            userId: ua.user_id,
            value: ua,
            permissionRead: 2,
            permissionWrite: 0,
        }]);
}
// ─── RPC: Create achievement (admin/server) ───────────────────────────────────
// Payload: { "game_id", "title", "description", "points", "icon" }
function rpcCreateAchievement(ctx, logger, nk, payload) {
    var _a;
    var req;
    try {
        req = JSON.parse(payload);
    }
    catch (_) {
        throw Error('Invalid JSON payload');
    }
    if (!req.game_id || !req.title || !req.description) {
        throw Error('game_id, title and description are required');
    }
    var ach = {
        id: nk.uuidv4(),
        game_id: req.game_id,
        title: req.title,
        description: req.description,
        points: typeof req.points === 'number' ? req.points : 0,
        icon: (_a = req.icon) !== null && _a !== void 0 ? _a : '',
        created_at: Math.floor(Date.now() / 1000),
    };
    achWrite(nk, ach);
    // Update game index
    var index = gameIndexRead(nk, ach.game_id);
    index.achievement_ids.push(ach.id);
    gameIndexWrite(nk, ach.game_id, index);
    logger.info('Created achievement %s for game %s', ach.id, ach.game_id);
    return JSON.stringify(ach);
}
// ─── RPC: Get achievement by ID ───────────────────────────────────────────────
// Payload: { "achievement_id": "..." }
function rpcGetAchievement(ctx, logger, nk, payload) {
    var req;
    try {
        req = JSON.parse(payload);
    }
    catch (_) {
        throw Error('Invalid JSON payload');
    }
    if (!req.achievement_id)
        throw Error('achievement_id is required');
    var ach = achRead(nk, req.achievement_id);
    if (!ach)
        throw Error('Achievement not found');
    return JSON.stringify(ach);
}
// ─── RPC: List achievements by game ──────────────────────────────────────────
// Payload: { "game_id": "..." }
function rpcListGameAchievements(ctx, logger, nk, payload) {
    var req;
    try {
        req = JSON.parse(payload);
    }
    catch (_) {
        throw Error('Invalid JSON payload');
    }
    if (!req.game_id)
        throw Error('game_id is required');
    var index = gameIndexRead(nk, req.game_id);
    if (index.achievement_ids.length === 0) {
        return JSON.stringify([]);
    }
    var reads = index.achievement_ids.map(function (id) { return ({
        collection: COLLECTION_ACHIEVEMENTS,
        key: id,
        userId: SYSTEM_USER_ID,
    }); });
    var objs = nk.storageRead(reads);
    var achievements = objs.map(function (o) { return o.value; });
    return JSON.stringify(achievements);
}
// ─── RPC: Unlock achievement for current user ─────────────────────────────────
// Payload: { "achievement_id": "..." }
function rpcUnlockAchievement(ctx, logger, nk, payload) {
    if (!ctx.userId)
        throw Error('No user ID in context');
    var req;
    try {
        req = JSON.parse(payload);
    }
    catch (_) {
        throw Error('Invalid JSON payload');
    }
    if (!req.achievement_id)
        throw Error('achievement_id is required');
    // Verify achievement exists
    var ach = achRead(nk, req.achievement_id);
    if (!ach)
        throw Error('Achievement not found');
    // Check already unlocked
    var existing = userAchRead(nk, ctx.userId, req.achievement_id);
    if (existing) {
        return JSON.stringify({ already_unlocked: true, unlocked_at: existing.unlocked_at });
    }
    var ua = {
        user_id: ctx.userId,
        achievement_id: ach.id,
        unlocked_at: Math.floor(Date.now() / 1000),
    };
    userAchWrite(nk, ua);
    // Add points to user profile
    var profile = storageGetProfile(nk, ctx.userId);
    if (profile) {
        profile.total_points += ach.points;
        storageUpsertProfile(nk, ctx.userId, profile);
    }
    logger.info('User %s unlocked achievement %s (+%d pts)', ctx.userId, ach.id, ach.points);
    return JSON.stringify({ already_unlocked: false, unlocked_at: ua.unlocked_at, points_earned: ach.points });
}
// ─── RPC: Get all achievements unlocked by current user ───────────────────────
// No payload needed
function rpcGetUserAchievements(ctx, logger, nk, payload) {
    var _a;
    if (!ctx.userId)
        throw Error('No user ID in context');
    var result = nk.storageList(ctx.userId, COLLECTION_USER_ACHIEVEMENTS, 100, '');
    var userAchs = ((_a = result.objects) !== null && _a !== void 0 ? _a : []).map(function (o) { return o.value; });
    return JSON.stringify(userAchs);
}
/**
 * Simple in-memory TTL cache cho Nakama JS runtime.
 *
 * Nakama JS runtime là long-lived single process (không restart theo request)
 * nên module-level Map tồn tại suốt vòng đời server — hoàn toàn phù hợp
 * để cache dữ liệu read-heavy như games, achievements, ROMs.
 *
 * TTL guidelines:
 *   - Dữ liệu DB tĩnh (games, achievements, ROMs) : 60–120 phút
 *   - Leaderboard / stats                          : KHÔNG cache (real-time)
 *   - User profile / unlocks                       : KHÔNG cache (thay đổi thường xuyên)
 */
var TtlCache = /** @class */ (function () {
    function TtlCache() {
        this.store = new Map();
    }
    /** Lấy giá trị từ cache; trả về undefined nếu miss hoặc hết hạn */
    TtlCache.prototype.get = function (key) {
        var entry = this.store.get(key);
        if (!entry)
            return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value;
    };
    /** Lưu giá trị với TTL (giây) */
    TtlCache.prototype.set = function (key, value, ttlSec) {
        this.store.set(key, { value: value, expiresAt: Date.now() + ttlSec * 1000 });
    };
    /** Xoá một key */
    TtlCache.prototype.del = function (key) {
        this.store.delete(key);
    };
    /** Xoá tất cả entry đã hết hạn (gọi định kỳ để tránh memory leak) */
    TtlCache.prototype.purgeExpired = function () {
        var _this = this;
        var now = Date.now();
        this.store.forEach(function (entry, key) {
            if (now > entry.expiresAt)
                _this.store.delete(key);
        });
    };
    /** Số entry hiện tại trong cache */
    TtlCache.prototype.size = function () {
        return this.store.size;
    };
    return TtlCache;
}());
// Singleton — dùng chung cho toàn bộ module
var cache = new TtlCache();
// ─── TTL constants (giây) ─────────────────────────────────────────────────────
var TTL_CONSOLES = 24 * 3600; // ra_consoles không đổi
var TTL_GAME_BY_ID = 2 * 3600;
var TTL_GAMES_BY_CONSOLE = 1 * 3600;
var TTL_GAMES_SEARCH = 30 * 60; // search query đa dạng → TTL ngắn hơn
var TTL_GAMES_RELATED = 2 * 3600;
var TTL_ACH_BY_GAME = 2 * 3600;
var TTL_ACH_BY_ID = 2 * 3600;
var TTL_ROMS_BY_GAME = 4 * 3600;
var TTL_ROMS_BY_MD5 = 4 * 3600;
// ─── Cache key builders ───────────────────────────────────────────────────────
var CK = {
    consoles: function () { return 'consoles'; },
    gameById: function (id) { return "game:".concat(id); },
    gamesByConsole: function (cid, lim, off) { return "games:".concat(cid, ":").concat(lim, ":").concat(off); },
    gamesSearch: function (q, cid, lim) { return "search:".concat(q, ":").concat(cid !== null && cid !== void 0 ? cid : 'all', ":").concat(lim); },
    gamesRelated: function (id) { return "related:".concat(id); },
    achByGame: function (id) { return "ach_game:".concat(id); },
    achById: function (id) { return "ach:".concat(id); },
    romsByGame: function (id) { return "roms_game:".concat(id); },
    romByMd5: function (md5) { return "rom_md5:".concat(md5.toLowerCase()); },
};
// Games & RA-Achievements module — queries PostgreSQL tables populated from db/*.sql dumps
// ─── Console IDs ─────────────────────────────────────────────────────────────
/** All known RetroAchievements consoleIds */
var ALL_CONSOLE_IDS = [1, 2, 3, 5, 6, 7, 12, 16, 18, 27, 41];
/** Separate collection for RA unlocks — tránh lẫn với custom achievements */
var COLLECTION_RA_USER_ACHIEVEMENTS = 'ra_user_achievements';
// ─── Helpers ──────────────────────────────────────────────────────────────────
function assertConsoleId(consoleId) {
    if (ALL_CONSOLE_IDS.indexOf(consoleId) === -1)
        throw new Error("Unsupported consoleId: ".concat(consoleId));
}
function rowToGame(r) {
    var _a, _b, _c, _d, _e;
    return {
        rank: (_a = r['rank']) !== null && _a !== void 0 ? _a : 0,
        id: r['id'],
        title: r['title'],
        consoleName: r['consolename'],
        consoleId: r['consoleid'],
        totalPlayers: (_b = r['totalplayers']) !== null && _b !== void 0 ? _b : 0,
        numAchievements: (_c = r['numachievements']) !== null && _c !== void 0 ? _c : 0,
        points: (_d = r['points']) !== null && _d !== void 0 ? _d : 0,
        genre: r['genre'],
        developer: r['developer'],
        publisher: r['publisher'],
        released: r['released'],
        description: r['description'],
        icon: r['icon'],
        boxArt: r['boxart'],
        titleScreen: r['titlescreen'],
        screenshot: r['screenshot'],
        rating: (_e = r['rating']) !== null && _e !== void 0 ? _e : 0,
    };
}
function rowToAchievement(r) {
    var _a, _b, _c, _d, _e, _f;
    return {
        gameId: r['gameid'],
        gameTitle: r['gametitle'],
        achievementId: r['achievementid'],
        title: r['title'],
        description: r['description'],
        points: (_a = r['points']) !== null && _a !== void 0 ? _a : 0,
        trueRatio: (_b = r['trueratio']) !== null && _b !== void 0 ? _b : 0,
        type: r['type'],
        author: r['author'],
        badgeUrl: r['badgeurl'],
        numAwarded: (_c = r['numawarded']) !== null && _c !== void 0 ? _c : 0,
        numAwardedHardcore: (_d = r['numawardedhardcore']) !== null && _d !== void 0 ? _d : 0,
        displayOrder: (_e = r['displayorder']) !== null && _e !== void 0 ? _e : 0,
        memAddr: (_f = r['memaddr']) !== null && _f !== void 0 ? _f : '',
    };
}
function rowToRom(r) {
    return {
        gameId: r['gameid'],
        gameTitle: r['gametitle'],
        md5: r['md5'],
        romName: r['romname'],
        labels: r['labels'],
        patchUrl: r['patchurl'],
        region: r['region'],
    };
}
// ─── RPC: List all consoles ───────────────────────────────────────────────────
// GET /v2/rpc/games-consoles?http_key=<key>
function rpcListConsoles(ctx, logger, nk, payload) {
    var ck = CK.consoles();
    var hit = cache.get(ck);
    if (hit)
        return JSON.stringify(hit);
    var rows = nk.sqlQuery('SELECT id, name, "iconurl" AS iconurl, active, "isgamesystem" AS isgamesystem FROM ra_consoles ORDER BY id', []);
    var consoles = rows.map(function (r) { return ({
        id: r['id'],
        name: r['name'],
        iconUrl: r['iconurl'],
        active: r['active'],
        isGameSystem: r['isgamesystem'],
    }); });
    cache.set(ck, consoles, TTL_CONSOLES);
    return JSON.stringify(consoles);
}
// ─── RPC: List games by console ───────────────────────────────────────────────
// POST /v2/rpc/games-by-console?http_key=<key>
// Payload: { "console_id": 7, "limit": 50, "offset": 0 }
function rpcListGamesByConsole(ctx, logger, nk, payload) {
    var _a, _b;
    var req;
    try {
        req = JSON.parse(payload);
    }
    catch (_) {
        throw new Error('Invalid JSON payload');
    }
    if (!req.console_id)
        throw new Error('console_id is required');
    assertConsoleId(req.console_id);
    var limit = Math.min((_a = req.limit) !== null && _a !== void 0 ? _a : 50, 200);
    var offset = (_b = req.offset) !== null && _b !== void 0 ? _b : 0;
    var ck = CK.gamesByConsole(req.console_id, limit, offset);
    var hit = cache.get(ck);
    if (hit)
        return JSON.stringify(hit);
    var rows = nk.sqlQuery("SELECT rank, id, title, consolename, consoleid, totalplayers, numachievements, points, genre, developer, publisher, released, icon, boxart, rating\n         FROM games\n         WHERE consoleid = $1\n         ORDER BY rank\n         LIMIT $2 OFFSET $3", [req.console_id, limit, offset]);
    var result = rows.map(rowToGame);
    cache.set(ck, result, TTL_GAMES_BY_CONSOLE);
    return JSON.stringify(result);
}
// ─── RPC: Get game by ID (searches across all platforms) ─────────────────────
// POST /v2/rpc/games-by-id?http_key=<key>
// Payload: { "game_id": 1446 }
function rpcGetGameById(ctx, logger, nk, payload) {
    var req;
    try {
        req = JSON.parse(payload);
    }
    catch (_) {
        throw new Error('Invalid JSON payload');
    }
    if (!req.game_id)
        throw new Error('game_id is required');
    var ck = CK.gameById(req.game_id);
    var hit = cache.get(ck);
    if (hit)
        return JSON.stringify(hit);
    var rows = nk.sqlQuery("SELECT rank, id, title, consolename, consoleid, totalplayers, casualplayers, hardcoreplayers,\n                numachievements, points, genre, developer, publisher, released, description,\n                icon, boxart, titlescreen, screenshot, rating\n         FROM games WHERE id = $1 LIMIT 1", [req.game_id]);
    if (rows.length === 0)
        throw new Error('Game not found');
    var game = rowToGame(rows[0]);
    cache.set(ck, game, TTL_GAME_BY_ID);
    return JSON.stringify(game);
}
// ─── RPC: Search games by title ───────────────────────────────────────────────
// POST /v2/rpc/games-search?http_key=<key>
// Payload: { "query": "mario", "console_id": 7, "limit": 20 }
function rpcSearchGames(ctx, logger, nk, payload) {
    var _a;
    var req;
    try {
        req = JSON.parse(payload);
    }
    catch (_) {
        throw new Error('Invalid JSON payload');
    }
    if (!req.query || req.query.trim() === '')
        throw new Error('query is required');
    var limit = Math.min((_a = req.limit) !== null && _a !== void 0 ? _a : 20, 100);
    var q = req.query.trim().toLowerCase();
    var pattern = "%".concat(q, "%");
    var ck = CK.gamesSearch(q, req.console_id, limit);
    var hit = cache.get(ck);
    if (hit)
        return JSON.stringify(hit);
    var rows;
    if (req.console_id) {
        assertConsoleId(req.console_id);
        rows = nk.sqlQuery("SELECT rank, id, title, consolename, consoleid, totalplayers, numachievements, points,\n                    genre, developer, publisher, released, icon, boxart, rating\n             FROM games WHERE consoleid = $1 AND LOWER(title) LIKE LOWER($2)\n             ORDER BY rank LIMIT $3", [req.console_id, pattern, limit]);
    }
    else {
        rows = nk.sqlQuery("SELECT rank, id, title, consolename, consoleid, totalplayers, numachievements, points,\n                    genre, developer, publisher, released, icon, boxart, rating\n             FROM games WHERE LOWER(title) LIKE LOWER($1)\n             ORDER BY rank LIMIT $2", [pattern, limit]);
    }
    var result = rows.map(rowToGame);
    cache.set(ck, result, TTL_GAMES_SEARCH);
    return JSON.stringify(result);
}
// ─── RPC: Get related games ───────────────────────────────────────────────────
// POST /v2/rpc/games-related?http_key=<key>
// Payload: { "game_id": 1446 }
function rpcGetRelatedGames(ctx, logger, nk, payload) {
    var req;
    try {
        req = JSON.parse(payload);
    }
    catch (_) {
        throw new Error('Invalid JSON payload');
    }
    if (!req.game_id)
        throw new Error('game_id is required');
    var ck = CK.gamesRelated(req.game_id);
    var hit = cache.get(ck);
    if (hit)
        return JSON.stringify(hit);
    var relRows = nk.sqlQuery('SELECT related FROM related_roms WHERE id = $1 LIMIT 1', [req.game_id]);
    if (relRows.length === 0 || !relRows[0]['related'])
        return JSON.stringify([]);
    var relatedIds = relRows[0]['related']
        .split(',')
        .map(function (s) { return parseInt(s.trim(), 10); })
        .filter(function (n) { return !isNaN(n); });
    if (relatedIds.length === 0)
        return JSON.stringify([]);
    var placeholders = relatedIds.map(function (_, i) { return "$".concat(i + 1); }).join(', ');
    var rows = nk.sqlQuery("SELECT rank, id, title, consolename, consoleid, totalplayers, numachievements, points,\n                genre, developer, publisher, released, icon, boxart, rating\n         FROM games WHERE id IN (".concat(placeholders, ")"), relatedIds);
    var result = rows.map(rowToGame);
    cache.set(ck, result, TTL_GAMES_RELATED);
    return JSON.stringify(result);
}
// ─── RPC: List RA achievements by game ───────────────────────────────────────
// POST /v2/rpc/ra-achievements-by-game?http_key=<key>
// Payload: { "game_id": 1446, "console_id": 7 }
function rpcListRAGAchievementsByGame(ctx, logger, nk, payload) {
    var req;
    try {
        req = JSON.parse(payload);
    }
    catch (_) {
        throw new Error('Invalid JSON payload');
    }
    if (!req.game_id)
        throw new Error('game_id is required');
    var rows = nk.sqlQuery("SELECT gameid, gametitle, achievementid, title, description, points, trueratio,\n                type, author, badgeurl, numawarded, numawardedhardcore, displayorder, memaddr\n         FROM achievements\n         WHERE gameid = $1\n         ORDER BY displayorder", [req.game_id]);
    return JSON.stringify(rows.map(rowToAchievement));
}
// ─── RPC: Get single RA achievement by ID ────────────────────────────────────
// POST /v2/rpc/ra-achievements-by-id?http_key=<key>
// Payload: { "achievement_id": 3159 }
function rpcGetRAAchievementById(ctx, logger, nk, payload) {
    var req;
    try {
        req = JSON.parse(payload);
    }
    catch (_) {
        throw new Error('Invalid JSON payload');
    }
    if (!req.achievement_id)
        throw new Error('achievement_id is required');
    var ck = CK.achById(req.achievement_id);
    var hit = cache.get(ck);
    if (hit)
        return JSON.stringify(hit);
    var rows = nk.sqlQuery("SELECT gameid, gametitle, achievementid, title, description, points, trueratio,\n                type, author, badgeurl, numawarded, numawardedhardcore, displayorder, memaddr\n         FROM achievements WHERE achievementid = $1 LIMIT 1", [req.achievement_id]);
    if (rows.length === 0)
        throw new Error('Achievement not found');
    var ach = rowToAchievement(rows[0]);
    cache.set(ck, ach, TTL_ACH_BY_ID);
    return JSON.stringify(ach);
}
// ─── RPC: Unlock a RetroAchievement (adds points to user profile) ─────────────
// POST /v2/rpc/ra-achievements-unlock
// Authorization: Bearer <token>
// Payload: { "achievement_id": 3159 }
function rpcUnlockRAAchievement(ctx, logger, nk, payload) {
    var _a, _b, _c;
    if (!ctx.userId)
        throw new Error('Authentication required');
    var req;
    try {
        req = JSON.parse(payload);
    }
    catch (_) {
        throw new Error('Invalid JSON payload');
    }
    if (!req.achievement_id)
        throw new Error('achievement_id is required');
    // Check if already unlocked in Nakama storage
    var lockKey = "".concat(req.achievement_id);
    var existing = nk.storageRead([{
            collection: COLLECTION_RA_USER_ACHIEVEMENTS,
            key: lockKey,
            userId: ctx.userId,
        }]);
    if (existing.length > 0) {
        var ua = existing[0].value;
        return JSON.stringify({ already_unlocked: true, unlocked_at: ua.unlocked_at, points_earned: ua.points_earned });
    }
    // Fetch achievement from DB
    var achRows = nk.sqlQuery("SELECT achievementid, title, points, gameid, gametitle, badgeurl\n         FROM achievements WHERE achievementid = $1 LIMIT 1", [req.achievement_id]);
    if (achRows.length === 0)
        throw new Error('Achievement not found');
    var achRow = achRows[0];
    var pointsEarned = (_a = achRow['points']) !== null && _a !== void 0 ? _a : 0;
    var unlockedAt = Math.floor(Date.now() / 1000);
    // Write unlock record
    nk.storageWrite([{
            collection: COLLECTION_RA_USER_ACHIEVEMENTS,
            key: lockKey,
            userId: ctx.userId,
            value: {
                achievement_id: req.achievement_id,
                achievement_title: achRow['title'],
                game_id: achRow['gameid'],
                game_title: achRow['gametitle'],
                badge_url: achRow['badgeurl'],
                points_earned: pointsEarned,
                unlocked_at: unlockedAt,
            },
            permissionRead: 2,
            permissionWrite: 0,
        }]);
    // Add points to user profile — reuse helper từ users.ts
    if (pointsEarned > 0) {
        var profile = storageGetProfile(nk, ctx.userId);
        if (!profile) {
            var account = nk.accountGetId(ctx.userId);
            var user = account.user;
            profile = {
                id: ctx.userId,
                username: (_b = user.username) !== null && _b !== void 0 ? _b : '',
                email: (_c = account.email) !== null && _c !== void 0 ? _c : '',
                created_at: Math.floor(new Date(user.createTime).getTime() / 1000),
                total_points: 0,
            };
        }
        profile.total_points += pointsEarned;
        storageUpsertProfile(nk, ctx.userId, profile);
    }
    logger.info('User %s unlocked RA achievement %d (+%d pts)', ctx.userId, req.achievement_id, pointsEarned);
    return JSON.stringify({
        already_unlocked: false,
        unlocked_at: unlockedAt,
        points_earned: pointsEarned,
        achievement_title: achRow['title'],
        game_title: achRow['gametitle'],
    });
}
// ─── RPC: List my unlocked RA achievements ────────────────────────────────────
// GET /v2/rpc/ra-achievements-list
// Authorization: Bearer <token>
// Payload (optional): { "limit": 50, "cursor": "..." }
function rpcListMyRAAchievements(ctx, logger, nk, payload) {
    if (!ctx.userId)
        throw new Error('Authentication required');
    var limit = 50;
    var cursor;
    if (payload) {
        try {
            var req = JSON.parse(payload);
            if (typeof req.limit === 'number')
                limit = Math.min(req.limit, 200);
            if (typeof req.cursor === 'string')
                cursor = req.cursor;
        }
        catch (_) { }
    }
    var result = nk.storageList(ctx.userId, COLLECTION_RA_USER_ACHIEVEMENTS, limit, cursor);
    var unlocks = (result.objects || []).map(function (o) { return o.value; });
    return JSON.stringify({ unlocks: unlocks, cursor: result.cursor });
}
// ─── RPC: Get user stats summary ─────────────────────────────────────────────
// GET /v2/rpc/users-me-stats
// Authorization: Bearer <token>
function rpcGetMyStats(ctx, logger, nk, payload) {
    var _a;
    if (!ctx.userId)
        throw new Error('Authentication required');
    // Count unlocks
    var totalUnlocked = 0;
    var cursor;
    do {
        var page = nk.storageList(ctx.userId, COLLECTION_RA_USER_ACHIEVEMENTS, 200, cursor);
        totalUnlocked += (page.objects || []).length;
        cursor = page.cursor;
    } while (cursor);
    // Load profile for total_points
    var profileObjs = nk.storageRead([{ collection: COLLECTION_USERS, key: KEY_PROFILE, userId: ctx.userId }]);
    var profile = profileObjs.length > 0 ? profileObjs[0].value : {};
    return JSON.stringify({
        user_id: ctx.userId,
        total_points: (_a = profile.total_points) !== null && _a !== void 0 ? _a : 0,
        achievements_unlocked: totalUnlocked,
    });
}
// ROMs & Leaderboard module
// ─── RPC: Look up game by ROM MD5 hash ───────────────────────────────────────
// POST /v2/rpc/roms-by-md5?http_key=<key>
// Payload: { "md5": "8e3630186e35d477231bf8fd50e54cdd" }
// Tuỳ chọn thêm "console_id" để tìm nhanh hơn trong một platform.
function rpcGetRomByMd5(ctx, logger, nk, payload) {
    var req;
    try {
        req = JSON.parse(payload);
    }
    catch (_) {
        throw new Error('Invalid JSON payload');
    }
    if (!req.md5 || req.md5.trim() === '')
        throw new Error('md5 is required');
    var md5Lower = req.md5.trim().toLowerCase();
    var ck = CK.romByMd5(md5Lower);
    var hit = cache.get(ck);
    if (hit)
        return JSON.stringify(hit);
    var rows = nk.sqlQuery("SELECT gameid, gametitle, md5, romname, labels, patchurl, region\n         FROM md5 WHERE LOWER(md5) = $1 LIMIT 1", [md5Lower]);
    if (rows.length === 0)
        throw new Error('ROM not found');
    var rom = rowToRom(rows[0]);
    cache.set(ck, rom, TTL_ROMS_BY_MD5);
    return JSON.stringify(rom);
}
// ─── RPC: List ROMs for a game ────────────────────────────────────────────────
// POST /v2/rpc/roms-by-game?http_key=<key>
// Payload: { "game_id": 1446 }
function rpcListRomsByGame(ctx, logger, nk, payload) {
    var req;
    try {
        req = JSON.parse(payload);
    }
    catch (_) {
        throw new Error('Invalid JSON payload');
    }
    if (!req.game_id)
        throw new Error('game_id is required');
    var ck = CK.romsByGame(req.game_id);
    var hit = cache.get(ck);
    if (hit)
        return JSON.stringify(hit);
    var rows = nk.sqlQuery("SELECT gameid, gametitle, md5, romname, labels, patchurl, region\n         FROM md5 WHERE gameid = $1", [req.game_id]);
    var result = rows.map(rowToRom);
    cache.set(ck, result, TTL_ROMS_BY_GAME);
    return JSON.stringify(result);
}
// ─── RPC: Leaderboard (top users by total_points) ─────────────────────────────
// GET /v2/rpc/users-leaderboard?http_key=<key>
// Payload (optional): { "limit": 20 }
function rpcUsersLeaderboard(ctx, logger, nk, payload) {
    var limit = 20;
    if (payload) {
        try {
            var req = JSON.parse(payload);
            if (typeof req.limit === 'number')
                limit = Math.min(req.limit, 100);
        }
        catch (_) { }
    }
    // Query Nakama's storage table directly for user profiles
    var rows = nk.sqlQuery("SELECT user_id, value->>'username' AS username, (value->>'total_points')::int AS total_points\n         FROM storage\n         WHERE collection = $1 AND key = $2\n           AND (value->>'total_points')::int > 0\n         ORDER BY (value->>'total_points')::int DESC\n         LIMIT $3", [COLLECTION_USERS, KEY_PROFILE, limit]);
    var board = rows.map(function (r, i) { return ({
        rank: i + 1,
        user_id: r['user_id'],
        username: r['username'],
        total_points: r['total_points'],
    }); });
    return JSON.stringify(board);
}
function InitModule(ctx, logger, nk, initializer) {
    // ── User endpoints (require Bearer token) ────────────────────────────────
    // GET  /v2/rpc/users-me
    initializer.registerRpc('users-me', rpcGetUserProfile);
    // POST /v2/rpc/users-me-points  { "points": 100 }
    initializer.registerRpc('users-me-points', rpcAddUserPoints);
    // POST /v2/rpc/users-by-id  { "user_id": "..." }
    initializer.registerRpc('users-by-id', rpcGetUserProfileById);
    // GET  /v2/rpc/users-me-stats
    initializer.registerRpc('users-me-stats', rpcGetMyStats);
    // GET  /v2/rpc/users-leaderboard?http_key=<key>  { "limit": 20 }
    initializer.registerRpc('users-leaderboard', rpcUsersLeaderboard);
    // ── Custom Achievement endpoints (Nakama storage) ─────────────────────────
    // POST /v2/rpc/achievements-create?http_key=<key>  { game_id, title, description, points, icon }
    initializer.registerRpc('achievements-create', rpcCreateAchievement);
    // POST /v2/rpc/achievements-by-id?http_key=<key>   { "achievement_id": "..." }
    initializer.registerRpc('achievements-by-id', rpcGetAchievement);
    // POST /v2/rpc/achievements-by-game?http_key=<key> { "game_id": "..." }
    initializer.registerRpc('achievements-by-game', rpcListGameAchievements);
    // POST /v2/rpc/user-achievements-unlock  { "achievement_id": "..." }
    initializer.registerRpc('user-achievements-unlock', rpcUnlockAchievement);
    // GET  /v2/rpc/user-achievements-list
    initializer.registerRpc('user-achievements-list', rpcGetUserAchievements);
    // ── Games & Consoles (PostgreSQL DB) ──────────────────────────────────────
    // GET  /v2/rpc/games-consoles?http_key=<key>
    initializer.registerRpc('games-consoles', rpcListConsoles);
    // POST /v2/rpc/games-by-console?http_key=<key>  { "console_id": 7, "limit": 50, "offset": 0 }
    initializer.registerRpc('games-by-console', rpcListGamesByConsole);
    // POST /v2/rpc/games-by-id?http_key=<key>        { "game_id": 1446 }
    initializer.registerRpc('games-by-id', rpcGetGameById);
    // POST /v2/rpc/games-search?http_key=<key>       { "query": "mario", "console_id": 7, "limit": 20 }
    initializer.registerRpc('games-search', rpcSearchGames);
    // POST /v2/rpc/games-related?http_key=<key>      { "game_id": 1446 }
    initializer.registerRpc('games-related', rpcGetRelatedGames);
    // ── RetroAchievements (PostgreSQL DB) ─────────────────────────────────────
    // POST /v2/rpc/ra-achievements-by-game?http_key=<key>  { "game_id": 1446 }
    initializer.registerRpc('ra-achievements-by-game', rpcListRAGAchievementsByGame);
    // POST /v2/rpc/ra-achievements-by-id?http_key=<key>    { "achievement_id": 3159 }
    initializer.registerRpc('ra-achievements-by-id', rpcGetRAAchievementById);
    // POST /v2/rpc/ra-achievements-unlock  (Bearer token)  { "achievement_id": 3159 }
    initializer.registerRpc('ra-achievements-unlock', rpcUnlockRAAchievement);
    // GET  /v2/rpc/ra-achievements-list   (Bearer token)   { "limit": 50, "cursor": "..." }
    initializer.registerRpc('ra-achievements-list', rpcListMyRAAchievements);
    // ── ROMs (PostgreSQL DB) ──────────────────────────────────────────────────
    // POST /v2/rpc/roms-by-md5?http_key=<key>   { "md5": "..." }  — console_id optional để tăng tốc
    initializer.registerRpc('roms-by-md5', rpcGetRomByMd5);
    // POST /v2/rpc/roms-by-game?http_key=<key>  { "game_id": 1446 }
    initializer.registerRpc('roms-by-game', rpcListRomsByGame);
    logger.info('Retro Achievement module loaded.');
}
