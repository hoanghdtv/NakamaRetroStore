// Users module for Retro Achievement system

const COLLECTION_USERS = 'users';
const KEY_PROFILE = 'profile';

interface UserProfile {
    id: string;
    username: string;
    email: string;
    created_at: number; // unix timestamp (seconds)
    total_points: number;
}

interface UserProfileUpdateRequest {
    total_points?: number;
}

// ─── Storage helpers ────────────────────────────────────────────────────────

function storageGetProfile(nk: nkruntime.Nakama, userId: string): UserProfile | null {
    const reads: nkruntime.StorageReadRequest[] = [{
        collection: COLLECTION_USERS,
        key: KEY_PROFILE,
        userId,
    }];

    const objects = nk.storageRead(reads);
    if (objects.length === 0) return null;
    return objects[0].value as UserProfile;
}

function storageUpsertProfile(nk: nkruntime.Nakama, userId: string, profile: UserProfile): void {
    const writes: nkruntime.StorageWriteRequest[] = [{
        collection: COLLECTION_USERS,
        key: KEY_PROFILE,
        userId,
        value: profile,
        permissionRead: 2,  // public read
        permissionWrite: 0, // server-only write
    }];
    nk.storageWrite(writes);
}

// ─── RPC: Get own profile ────────────────────────────────────────────────────
// Client calls: rpc_get_user_profile (no payload needed)
function rpcGetUserProfile(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    if (!ctx.userId) {
        throw Error('No user ID in context');
    }

    // Load Nakama account for authoritative info
    const account = nk.accountGetId(ctx.userId);
    const user = account.user!;

    // Load or initialise stored profile
    let profile = storageGetProfile(nk, ctx.userId);
    if (!profile) {
        // First access — create profile from Nakama account data
        profile = {
            id: ctx.userId,
            username: user.username ?? '',
            email: account.email ?? '',
            created_at: Math.floor(new Date(user.createTime!).getTime() / 1000),
            total_points: 0,
        };
        storageUpsertProfile(nk, ctx.userId, profile);
        logger.info('Created new user profile for %s', ctx.userId);
    }

    return JSON.stringify(profile);
}

// ─── RPC: Add points (server/admin only) ─────────────────────────────────────
// Payload: { "points": 100 }
function rpcAddUserPoints(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    if (!ctx.userId) {
        throw Error('No user ID in context');
    }

    let req: { points: number };
    try {
        req = JSON.parse(payload);
    } catch (e) {
        throw Error('Invalid JSON payload');
    }
    if (typeof req.points !== 'number' || req.points < 0) {
        throw Error('points must be a non-negative number');
    }

    let profile = storageGetProfile(nk, ctx.userId);
    if (!profile) {
        const account = nk.accountGetId(ctx.userId);
        const user = account.user!;
        profile = {
            id: ctx.userId,
            username: user.username ?? '',
            email: account.email ?? '',
            created_at: Math.floor(new Date(user.createTime!).getTime() / 1000),
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
function rpcGetUserProfileById(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    let req: { user_id: string };
    try {
        req = JSON.parse(payload);
    } catch (e) {
        throw Error('Invalid JSON payload');
    }
    if (!req.user_id) {
        throw Error('user_id is required');
    }

    const profile = storageGetProfile(nk, req.user_id);
    if (!profile) {
        throw Error('User profile not found');
    }

    return JSON.stringify(profile);
}
