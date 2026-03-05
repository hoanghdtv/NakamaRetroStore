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
function InitModule(ctx, logger, nk, initializer) {
    // ── User endpoints (require Bearer token) ────────────────────────────────
    // GET  /v2/rpc/users-me
    initializer.registerRpc('users-me', rpcGetUserProfile);
    // POST /v2/rpc/users-me-points  { "points": 100 }
    initializer.registerRpc('users-me-points', rpcAddUserPoints);
    // POST /v2/rpc/users-by-id  { "user_id": "..." }
    initializer.registerRpc('users-by-id', rpcGetUserProfileById);
    // ── Achievement endpoints ─────────────────────────────────────────────────
    // POST /v2/rpc/achievements-create?http_key=<key>  { game_id, title, description, points, icon }
    initializer.registerRpc('achievements-create', rpcCreateAchievement);
    // POST /v2/rpc/achievements-by-id?http_key=<key>   { "achievement_id": "..." }
    initializer.registerRpc('achievements-by-id', rpcGetAchievement);
    // POST /v2/rpc/achievements-by-game?http_key=<key> { "game_id": "..." }
    initializer.registerRpc('achievements-by-game', rpcListGameAchievements);
    // ── User-Achievement endpoints (require Bearer token) ─────────────────────
    // POST /v2/rpc/user-achievements-unlock  { "achievement_id": "..." }
    initializer.registerRpc('user-achievements-unlock', rpcUnlockAchievement);
    // GET  /v2/rpc/user-achievements-list
    initializer.registerRpc('user-achievements-list', rpcGetUserAchievements);
    logger.info('Retro Achievement module loaded.');
}
