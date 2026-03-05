// Achievements module for Retro Achievement system

const COLLECTION_ACHIEVEMENTS      = 'achievements';
const COLLECTION_GAME_ACH_INDEX    = 'game_achievement_index';
const COLLECTION_USER_ACHIEVEMENTS = 'user_achievements';

// System-level records are stored under this fixed user ID
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Achievement {
    id: string;
    game_id: string;
    title: string;
    description: string;
    points: number;
    icon: string;
    created_at: number; // unix timestamp (seconds)
}

interface GameAchievementIndex {
    achievement_ids: string[];
}

interface UserAchievement {
    user_id: string;
    achievement_id: string;
    unlocked_at: number; // unix timestamp (seconds)
}

// ─── Storage helpers ─────────────────────────────────────────────────────────

function achRead(nk: nkruntime.Nakama, achievementId: string): Achievement | null {
    const objs = nk.storageRead([{
        collection: COLLECTION_ACHIEVEMENTS,
        key: achievementId,
        userId: SYSTEM_USER_ID,
    }]);
    return objs.length > 0 ? (objs[0].value as Achievement) : null;
}

function achWrite(nk: nkruntime.Nakama, ach: Achievement): void {
    nk.storageWrite([{
        collection: COLLECTION_ACHIEVEMENTS,
        key: ach.id,
        userId: SYSTEM_USER_ID,
        value: ach,
        permissionRead: 2,  // public read
        permissionWrite: 0, // server-only write
    }]);
}

function gameIndexRead(nk: nkruntime.Nakama, gameId: string): GameAchievementIndex {
    const objs = nk.storageRead([{
        collection: COLLECTION_GAME_ACH_INDEX,
        key: gameId,
        userId: SYSTEM_USER_ID,
    }]);
    return objs.length > 0 ? (objs[0].value as GameAchievementIndex) : { achievement_ids: [] };
}

function gameIndexWrite(nk: nkruntime.Nakama, gameId: string, index: GameAchievementIndex): void {
    nk.storageWrite([{
        collection: COLLECTION_GAME_ACH_INDEX,
        key: gameId,
        userId: SYSTEM_USER_ID,
        value: index,
        permissionRead: 2,
        permissionWrite: 0,
    }]);
}

function userAchRead(nk: nkruntime.Nakama, userId: string, achievementId: string): UserAchievement | null {
    const objs = nk.storageRead([{
        collection: COLLECTION_USER_ACHIEVEMENTS,
        key: achievementId,
        userId,
    }]);
    return objs.length > 0 ? (objs[0].value as UserAchievement) : null;
}

function userAchWrite(nk: nkruntime.Nakama, ua: UserAchievement): void {
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
function rpcCreateAchievement(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    let req: Partial<Achievement>;
    try {
        req = JSON.parse(payload);
    } catch (_) {
        throw Error('Invalid JSON payload');
    }

    if (!req.game_id || !req.title || !req.description) {
        throw Error('game_id, title and description are required');
    }

    const ach: Achievement = {
        id: nk.uuidv4(),
        game_id: req.game_id,
        title: req.title,
        description: req.description,
        points: typeof req.points === 'number' ? req.points : 0,
        icon: req.icon ?? '',
        created_at: Math.floor(Date.now() / 1000),
    };

    achWrite(nk, ach);

    // Update game index
    const index = gameIndexRead(nk, ach.game_id);
    index.achievement_ids.push(ach.id);
    gameIndexWrite(nk, ach.game_id, index);

    logger.info('Created achievement %s for game %s', ach.id, ach.game_id);
    return JSON.stringify(ach);
}

// ─── RPC: Get achievement by ID ───────────────────────────────────────────────
// Payload: { "achievement_id": "..." }
function rpcGetAchievement(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    let req: { achievement_id: string };
    try {
        req = JSON.parse(payload);
    } catch (_) {
        throw Error('Invalid JSON payload');
    }
    if (!req.achievement_id) throw Error('achievement_id is required');

    const ach = achRead(nk, req.achievement_id);
    if (!ach) throw Error('Achievement not found');

    return JSON.stringify(ach);
}

// ─── RPC: List achievements by game ──────────────────────────────────────────
// Payload: { "game_id": "..." }
function rpcListGameAchievements(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    let req: { game_id: string };
    try {
        req = JSON.parse(payload);
    } catch (_) {
        throw Error('Invalid JSON payload');
    }
    if (!req.game_id) throw Error('game_id is required');

    const index = gameIndexRead(nk, req.game_id);
    if (index.achievement_ids.length === 0) {
        return JSON.stringify([]);
    }

    const reads: nkruntime.StorageReadRequest[] = index.achievement_ids.map(id => ({
        collection: COLLECTION_ACHIEVEMENTS,
        key: id,
        userId: SYSTEM_USER_ID,
    }));

    const objs = nk.storageRead(reads);
    const achievements = objs.map(o => o.value as Achievement);

    return JSON.stringify(achievements);
}

// ─── RPC: Unlock achievement for current user ─────────────────────────────────
// Payload: { "achievement_id": "..." }
function rpcUnlockAchievement(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    if (!ctx.userId) throw Error('No user ID in context');

    let req: { achievement_id: string };
    try {
        req = JSON.parse(payload);
    } catch (_) {
        throw Error('Invalid JSON payload');
    }
    if (!req.achievement_id) throw Error('achievement_id is required');

    // Verify achievement exists
    const ach = achRead(nk, req.achievement_id);
    if (!ach) throw Error('Achievement not found');

    // Check already unlocked
    const existing = userAchRead(nk, ctx.userId, req.achievement_id);
    if (existing) {
        return JSON.stringify({ already_unlocked: true, unlocked_at: existing.unlocked_at });
    }

    const ua: UserAchievement = {
        user_id: ctx.userId,
        achievement_id: ach.id,
        unlocked_at: Math.floor(Date.now() / 1000),
    };
    userAchWrite(nk, ua);

    // Add points to user profile
    let profile = storageGetProfile(nk, ctx.userId);
    if (profile) {
        profile.total_points += ach.points;
        storageUpsertProfile(nk, ctx.userId, profile);
    }

    logger.info('User %s unlocked achievement %s (+%d pts)', ctx.userId, ach.id, ach.points);
    return JSON.stringify({ already_unlocked: false, unlocked_at: ua.unlocked_at, points_earned: ach.points });
}

// ─── RPC: Get all achievements unlocked by current user ───────────────────────
// No payload needed
function rpcGetUserAchievements(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    if (!ctx.userId) throw Error('No user ID in context');

    const result = nk.storageList(ctx.userId, COLLECTION_USER_ACHIEVEMENTS, 100, '');
    const userAchs: UserAchievement[] = (result.objects ?? []).map(o => o.value as UserAchievement);

    return JSON.stringify(userAchs);
}
