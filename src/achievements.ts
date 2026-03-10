// Achievements module for Retro Achievement system

const COLLECTION_ACHIEVEMENTS      = 'achievements';
const COLLECTION_GAME_ACH_INDEX    = 'game_achievement_index';
const COLLECTION_USER_ACHIEVEMENTS = 'user_achievements';

// System-level records are stored under this fixed user ID
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

// Nakama native leaderboard IDs for achievements unlocked count
const LEADERBOARD_ACH_ALLTIME = 'achievements_unlocked';           // no reset
const LEADERBOARD_ACH_WEEKLY  = 'achievements_unlocked_weekly';    // resets every Monday
const LEADERBOARD_ACH_MONTHLY = 'achievements_unlocked_monthly';   // resets 1st of month

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

// ─── Helper: update profile + all 3 leaderboards after any unlock ───────────
function applyUnlockToProfile(
    nk: nkruntime.Nakama,
    logger: nkruntime.Logger,
    userId: string,
    pointsEarned: number,
): void {
    let profile = storageGetProfile(nk, userId);
    if (!profile) {
        const account = nk.accountGetId(userId);
        const user = account.user!;
        profile = {
            id:                   userId,
            username:             user.username ?? '',
            email:                account.email ?? '',
            created_at:           Math.floor(new Date(user.createTime!).getTime() / 1000),
            total_points:         0,
            achievements_unlocked: 0,
            level:                1,
        };
    }
    profile.total_points          += pointsEarned;
    profile.achievements_unlocked  = (profile.achievements_unlocked ?? 0) + 1;
    profile.level                  = calculateRank(profile.total_points);
    storageUpsertProfile(nk, userId, profile);

    try {
        // all-time: absolute count; weekly+monthly: +1 per unlock (reset by cron)
        nk.leaderboardRecordWrite(LEADERBOARD_ACH_ALLTIME, userId, '', profile.achievements_unlocked, 0, {});
        nk.leaderboardRecordWrite(LEADERBOARD_ACH_WEEKLY,  userId, '', 0, 0, {}, nkruntime.OverrideOperator.INCREMENTAL);
        nk.leaderboardRecordWrite(LEADERBOARD_ACH_MONTHLY, userId, '', 0, 0, {}, nkruntime.OverrideOperator.INCREMENTAL);
    } catch (e) {
        logger.warn('Failed to update achievements leaderboards for user %s: %s', userId, e);
    }
}

// ─── RPC: Unlock achievement for current user ─────────────────────────────────
// Payload: { "achievement_id": "..." }  — accepts both custom UUID and numeric RA ID
function rpcUnlockAchievement(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    if (!ctx.userId) throw Error('No user ID in context');

    let req: { achievement_id: string };
    try {
        req = JSON.parse(payload);
    } catch (_) {
        throw Error('Invalid JSON payload');
    }
    if (!req.achievement_id) throw Error('achievement_id is required');

    // ── Try custom Nakama achievement first ──────────────────────────────────
    const ach = achRead(nk, req.achievement_id);
    if (ach) {
        // Check already unlocked
        const existing = userAchRead(nk, ctx.userId, req.achievement_id);
        if (existing) {
            return JSON.stringify({ already_unlocked: true, unlocked_at: existing.unlocked_at });
        }

        const ua: UserAchievement = {
            user_id:        ctx.userId,
            achievement_id: ach.id,
            unlocked_at:    Math.floor(Date.now() / 1000),
        };
        userAchWrite(nk, ua);
        applyUnlockToProfile(nk, logger, ctx.userId, ach.points);

        logger.info('User %s unlocked custom achievement %s (+%d pts)', ctx.userId, ach.id, ach.points);
        return JSON.stringify({ already_unlocked: false, unlocked_at: ua.unlocked_at, points_earned: ach.points });
    }

    // ── Fallback: try RetroAchievements PostgreSQL DB (numeric ID) ───────────
    const raId = parseInt(req.achievement_id, 10);
    if (isNaN(raId)) throw Error(`Achievement not found: ${req.achievement_id}`);

    const lockKey = `${raId}`;
    const raExisting = nk.storageRead([{ collection: COLLECTION_USER_ACHIEVEMENTS, key: lockKey, userId: ctx.userId }]);
    if (raExisting.length > 0) {
        const ua = raExisting[0].value as { unlocked_at: number; points_earned: number };
        return JSON.stringify({ already_unlocked: true, unlocked_at: ua.unlocked_at, points_earned: ua.points_earned });
    }

    const achRows = nk.sqlQuery(
        `SELECT achievementid, title, points, gameid, gametitle, badgeurl
         FROM achievements WHERE achievementid = $1 LIMIT 1`,
        [raId]
    );
    if (achRows.length === 0) throw Error(`Achievement not found: ${req.achievement_id}`);

    const achRow     = achRows[0];
    const points     = achRow['points'] as number ?? 0;
    const unlockedAt = Math.floor(Date.now() / 1000);

    nk.storageWrite([{
        collection:     COLLECTION_USER_ACHIEVEMENTS,
        key:            lockKey,
        userId:         ctx.userId,
        value: {
            achievement_id:    raId,
            achievement_title: achRow['title'],
            game_id:           achRow['gameid'],
            game_title:        achRow['gametitle'],
            badge_url:         achRow['badgeurl'],
            points_earned:     points,
            unlocked_at:       unlockedAt,
        },
        permissionRead:  2,
        permissionWrite: 0,
    }]);

    applyUnlockToProfile(nk, logger, ctx.userId, points);

    logger.info('User %s unlocked RA achievement %d (+%d pts) via unified endpoint', ctx.userId, raId, points);
    return JSON.stringify({
        already_unlocked:  false,
        unlocked_at:       unlockedAt,
        points_earned:     points,
        achievement_title: achRow['title'],
        game_title:        achRow['gametitle'],
    });
}

// ─── RPC: Achievements leaderboard (top users by achievements_unlocked) ────────
// Payload (optional): { "period": "alltime" | "weekly" | "monthly", "limit": 20, "cursor": "" }
function rpcAchievementsLeaderboard(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    let limit = 20;
    let cursor = '';
    let period = 'alltime';
    if (payload) {
        try {
            const req = JSON.parse(payload);
            if (typeof req.limit === 'number') limit = Math.min(req.limit, 100);
            if (typeof req.cursor === 'string') cursor = req.cursor;
            if (req.period === 'weekly' || req.period === 'monthly' || req.period === 'alltime') period = req.period;
        } catch (_) {}
    }

    const leaderboardId =
        period === 'weekly'  ? LEADERBOARD_ACH_WEEKLY  :
        period === 'monthly' ? LEADERBOARD_ACH_MONTHLY :
                               LEADERBOARD_ACH_ALLTIME;

    const result = nk.leaderboardRecordsList(leaderboardId, [], limit, cursor);

    const board = (result.records ?? []).map(r => ({
        rank:                  r.rank,
        user_id:               r.ownerId,
        username:              r.username,
        achievements_unlocked: r.score,
    }));

    return JSON.stringify({ period, records: board, next_cursor: result.nextCursor ?? '' });
}

// ─── RPC: Get all achievements unlocked by current user ───────────────────────
// No payload needed
function rpcGetUserAchievements(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    if (!ctx.userId) throw Error('No user ID in context');

    const result = nk.storageList(ctx.userId, COLLECTION_USER_ACHIEVEMENTS, 100, '');
    const userAchs: UserAchievement[] = (result.objects ?? []).map(o => o.value as UserAchievement);

    // logger.info('User %s has %d unlocked achievements', ctx.userId, userAchs.length);

    return JSON.stringify(userAchs);
}
function calculateRank(total_points: number): number {
    if (total_points <= 0) return 1; // default rank for new users with no points
    
    // Rank tiers based on cumulative points
    if (total_points >= 500) return 5; // Legend
    if (total_points >= 100) return 4;  // Master
    if (total_points >= 50) return 3;  // Expert
    if (total_points >= 10) return 2;   // Intermediate
    if (total_points >= 3) return 1;   // Novice
    
    return 1; // Default rank for new users with no points
}

