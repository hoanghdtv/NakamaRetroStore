/**
 * NakamaRetroStore — TypeScript API Test Client
 *
 * Yêu cầu: Node 18+ (native fetch)
 * Chạy:    npx ts-node test/test.ts
 *          hoặc: node --require ts-node/register test/test.ts
 */

const BASE_URL  = 'http://localhost:7350';
const HTTP_KEY  = 'retro_server_http_key';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function log(label: string, data: any) {
    console.log(`\n✅ ${label}`);
    console.log(JSON.stringify(data, null, 2));
    passed++;
}

function err(label: string, e: any) {
    console.error(`\n❌ ${label}`);
    console.error(e?.message ?? e);
    failed++;
}

async function rpc(
    name: string,
    payload: object | null,
    token?: string,
    method: 'GET' | 'POST' = 'POST'
): Promise<any> {
    const url = token
        ? `${BASE_URL}/v2/rpc/${name}?unwrap=true`
        : `${BASE_URL}/v2/rpc/${name}?http_key=${HTTP_KEY}&unwrap=true`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, {
        method,
        headers,
        body: payload ? JSON.stringify(payload) : undefined,
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
    return text ? JSON.parse(text) : null;
}

/** Đăng ký hoặc đăng nhập user, trả về session token */
async function getSessionToken(username: string, password: string): Promise<string> {
    const creds = btoa(`${username}:${password}`);
    const res = await fetch(
        `${BASE_URL}/v2/account/authenticate/email?create=true&username=${username}`,
        {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Basic ${creds}`,
            },
            body: JSON.stringify({ email: `${username}@test.com`, password }),
        }
    );
    if (!res.ok) throw new Error(`Auth failed: ${await res.text()}`);
    const data = await res.json();
    return data.token as string;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {
    console.log('=== NakamaRetroStore API Tests ===\n');
    console.log(`Server: ${BASE_URL}`);

    // ── 1. Auth ───────────────────────────────────────────────────────────────
    let token: string;
    try {
        token = await getSessionToken('testplayer', 'Password123!');
        log('Auth — đăng ký / đăng nhập', { token: token.slice(0, 30) + '...' });
    } catch (e) {
        err('Auth', e);
        console.error('\nKhông thể lấy token, dừng test.');
        process.exit(1);
    }

    // ── 2. Users ──────────────────────────────────────────────────────────────
    try {
        const profile = await rpc('users-me', null, token, 'GET');
        log('users-me', profile);
    } catch (e) { err('users-me', e); }

    try {
        const pts = await rpc('users-me-points', { points: 10 }, token);
        log('users-me-points', pts);
    } catch (e) { err('users-me-points', e); }

    try {
        const stats = await rpc('users-me-stats', null, token, 'GET');
        log('users-me-stats', stats);
    } catch (e) { err('users-me-stats', e); }

    // ── 3. Consoles ───────────────────────────────────────────────────────────
    try {
        const consoles = await rpc('games-consoles', null);
        log(`games-consoles (${consoles.length} consoles)`, consoles.slice(0, 3));
    } catch (e) { err('games-consoles', e); }

    // ── 4. Games ──────────────────────────────────────────────────────────────
    try {
        const games = await rpc('games-by-console', { console_id: 7, limit: 5 });
        log(`games-by-console NES (top 5)`, games);
    } catch (e) { err('games-by-console', e); }

    try {
        const game = await rpc('games-by-id', { game_id: 1446 });
        log('games-by-id (Super Mario Bros.)', game);
    } catch (e) { err('games-by-id', e); }

    try {
        const results = await rpc('games-search', { query: 'mario', console_id: 7, limit: 3 });
        log(`games-search "mario" NES (top 3)`, results);
    } catch (e) { err('games-search', e); }

    try {
        const related = await rpc('games-related', { game_id: 1446 });
        log(`games-related (Super Mario Bros.)`, related.slice(0, 3));
    } catch (e) { err('games-related', e); }

    // ── 5. RA Achievements ────────────────────────────────────────────────────
    try {
        const achs = await rpc('ra-achievements-by-game', { game_id: 1446 });
        log(`ra-achievements-by-game (Super Mario Bros. — ${achs.length} total)`, achs.slice(0, 2));
    } catch (e) { err('ra-achievements-by-game', e); }

    try {
        const ach = await rpc('ra-achievements-by-id', { achievement_id: 3159 });
        log('ra-achievements-by-id (id=3159)', ach);
    } catch (e) { err('ra-achievements-by-id', e); }

    // ── 6. Unlock RA Achievement ──────────────────────────────────────────────
    try {
        const unlock1 = await rpc('ra-achievements-unlock', { achievement_id: 3159 }, token);
        log('ra-achievements-unlock (lần đầu)', unlock1);
    } catch (e) { err('ra-achievements-unlock (lần đầu)', e); }

    try {
        const unlock2 = await rpc('ra-achievements-unlock', { achievement_id: 3159 }, token);
        log('ra-achievements-unlock (lần 2 — phải already_unlocked=true)', unlock2);
        if (!unlock2.already_unlocked) failed++, console.error('  ⚠️  Kỳ vọng already_unlocked=true');
    } catch (e) { err('ra-achievements-unlock (lần 2)', e); }

    try {
        const list = await rpc('ra-achievements-list', null, token, 'GET');
        log('ra-achievements-list', list);
    } catch (e) { err('ra-achievements-list', e); }

    // ── 7. Kiểm tra điểm sau unlock ───────────────────────────────────────────
    try {
        const stats = await rpc('users-me-stats', null, token, 'GET');
        log('users-me-stats (sau unlock)', stats);
    } catch (e) { err('users-me-stats (sau unlock)', e); }

    // ── 8. ROMs ───────────────────────────────────────────────────────────────
    try {
        const roms = await rpc('roms-by-game', { game_id: 1446 });
        log(`roms-by-game (Super Mario Bros. — ${roms.length} ROMs)`, roms);
    } catch (e) { err('roms-by-game', e); }

    try {
        const rom = await rpc('roms-by-md5', { md5: '8e3630186e35d477231bf8fd50e54cdd' });
        log('roms-by-md5 (Super Mario Bros. World)', rom);
    } catch (e) { err('roms-by-md5', e); }

    // ── 9. Custom Achievements (Nakama storage) ────────────────────────────────
    let customAchId: string | undefined;
    try {
        const created = await rpc('achievements-create', {
            game_id:     'custom-game-1',
            title:       'First Blood',
            description: 'Win your first match',
            points:      25,
            icon:        'https://example.com/icons/first-blood.png',
        });
        customAchId = created.id;
        log('achievements-create', created);
    } catch (e) { err('achievements-create', e); }

    if (customAchId) {
        try {
            const ach = await rpc('achievements-by-id', { achievement_id: customAchId });
            log('achievements-by-id', ach);
        } catch (e) { err('achievements-by-id', e); }

        try {
            const list = await rpc('achievements-by-game', { game_id: 'custom-game-1' });
            log('achievements-by-game', list);
        } catch (e) { err('achievements-by-game', e); }

        try {
            const unlocked = await rpc('user-achievements-unlock', { achievement_id: customAchId }, token);
            log('user-achievements-unlock', unlocked);
        } catch (e) { err('user-achievements-unlock', e); }

        try {
            const myAchs = await rpc('user-achievements-list', null, token, 'GET');
            log('user-achievements-list', myAchs);
        } catch (e) { err('user-achievements-list', e); }
    }

    // ── 10. Leaderboard ───────────────────────────────────────────────────────
    try {
        const board = await rpc('users-leaderboard', { limit: 5 });
        log('users-leaderboard (top 5)', board);
    } catch (e) { err('users-leaderboard', e); }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n════════════════════════════════');
    console.log(`Kết quả: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

main().catch(e => {
    console.error('Fatal:', e);
    process.exit(1);
});
