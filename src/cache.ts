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

interface CacheEntry<T> {
    value: T;
    expiresAt: number; // Date.now() ms
}

class TtlCache {
    private store: Map<string, CacheEntry<any>> = new Map();

    /** Lấy giá trị từ cache; trả về undefined nếu miss hoặc hết hạn */
    get<T>(key: string): T | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value as T;
    }

    /** Lưu giá trị với TTL (giây) */
    set<T>(key: string, value: T, ttlSec: number): void {
        this.store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
    }

    /** Xoá một key */
    del(key: string): void {
        this.store.delete(key);
    }

    /** Xoá tất cả entry đã hết hạn (gọi định kỳ để tránh memory leak) */
    purgeExpired(): void {
        const now = Date.now();
        this.store.forEach((entry, key) => {
            if (now > entry.expiresAt) this.store.delete(key);
        });
    }

    /** Số entry hiện tại trong cache */
    size(): number {
        return this.store.size;
    }
}

// Singleton — dùng chung cho toàn bộ module
const cache = new TtlCache();

// ─── TTL constants (giây) ─────────────────────────────────────────────────────
const TTL_CONSOLES            = 24 * 3600; // ra_consoles không đổi
const TTL_GAME_BY_ID          = 2  * 3600;
const TTL_GAMES_BY_CONSOLE    = 1  * 3600;
const TTL_GAMES_SEARCH        = 30 * 60;   // search query đa dạng → TTL ngắn hơn
const TTL_GAMES_RELATED       = 2  * 3600;
const TTL_ACH_BY_GAME         = 2  * 3600;
const TTL_ACH_BY_ID           = 2  * 3600;
const TTL_ROMS_BY_GAME        = 4  * 3600;
const TTL_ROMS_BY_MD5         = 4  * 3600;

// ─── Cache key builders ───────────────────────────────────────────────────────
const CK = {
    consoles:         ()                                 => 'consoles',
    gameById:         (id: number)                       => `game:${id}`,
    gamesByConsole:   (cid: number, lim: number, off: number) => `games:${cid}:${lim}:${off}`,
    gamesSearch:      (q: string, cid: number|undefined, lim: number) => `search:${q}:${cid ?? 'all'}:${lim}`,
    gamesRelated:     (id: number)                       => `related:${id}`,
    achByGame:        (id: number)                       => `ach_game:${id}`,
    achById:          (id: number)                       => `ach:${id}`,
    romsByGame:       (id: number)                       => `roms_game:${id}`,
    romByMd5:         (md5: string)                      => `rom_md5:${md5.toLowerCase()}`,
};
