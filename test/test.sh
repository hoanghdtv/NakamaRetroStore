#!/usr/bin/env bash
# NakamaRetroStore — curl Test Script
# Chạy: bash test/test.sh

set -euo pipefail

BASE="http://localhost:7350"
KEY="retro_server_http_key"
EMAIL="curltest@example.com"
PASSWORD="Password123!"
USERNAME="curltest"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
PASS=0; FAIL=0

ok()  { echo -e "${GREEN}✅ $1${NC}"; ((PASS++)); }
fail(){ echo -e "${RED}❌ $1${NC}"; ((FAIL++)); }
hdr() { echo -e "\n${CYAN}── $1 ──────────────────────────────────${NC}"; }

# Helper: gọi RPC với http_key (server-to-server)
srv() {
    local name=$1; local body=${2:-'{}'}
    curl -sf -X POST "${BASE}/v2/rpc/${name}?http_key=${KEY}&unwrap=true" \
        -H "Content-Type: application/json" -d "${body}"
}

# Helper: gọi RPC với Bearer token
usr() {
    local name=$1; local body=${2:-'{}'}; local token=$3
    curl -sf -X POST "${BASE}/v2/rpc/${name}?unwrap=true" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${token}" \
        -d "${body}"
}

echo "=== NakamaRetroStore curl Tests ==="
echo "Server: ${BASE}"

# ─── 1. Auth ──────────────────────────────────────────────────────────────────
hdr "1. Authentication"

TOKEN=$(curl -sf -X POST \
    "${BASE}/v2/account/authenticate/email?create=true&username=${USERNAME}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Basic $(echo -n "defaultkey:" | base64)" \
    -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

if [ -n "$TOKEN" ]; then
    ok "Auth — session token: ${TOKEN:0:30}..."
else
    fail "Auth — không lấy được token"
    exit 1
fi

# ─── 2. Users ─────────────────────────────────────────────────────────────────
hdr "2. Users"

echo "→ users-me"
curl -sf -X GET "${BASE}/v2/rpc/users-me?unwrap=true" \
    -H "Authorization: Bearer ${TOKEN}" | python3 -m json.tool && ok "users-me" || fail "users-me"

echo "→ users-me-points"
usr "users-me-points" '{"points":50}' "${TOKEN}" | python3 -m json.tool \
    && ok "users-me-points" || fail "users-me-points"

echo "→ users-me-stats"
curl -sf -X GET "${BASE}/v2/rpc/users-me-stats?unwrap=true" \
    -H "Authorization: Bearer ${TOKEN}" | python3 -m json.tool && ok "users-me-stats" || fail "users-me-stats"

# ─── 3. Consoles ──────────────────────────────────────────────────────────────
hdr "3. Consoles"

echo "→ games-consoles"
srv "games-consoles" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(f'  {len(d)} consoles'); [print(f'  {c[\"id\"]:>3} {c[\"name\"]}') for c in d[:5]]" \
    && ok "games-consoles" || fail "games-consoles"

# ─── 4. Games ─────────────────────────────────────────────────────────────────
hdr "4. Games"

echo "→ games-by-console (NES, top 5)"
srv "games-by-console" '{"console_id":7,"limit":5}' | python3 -c \
    "import sys,json; [print(f'  #{g[\"rank\"]} {g[\"title\"]}') for g in json.load(sys.stdin)]" \
    && ok "games-by-console" || fail "games-by-console"

echo "→ games-by-id (Super Mario Bros. id=1446)"
srv "games-by-id" '{"game_id":1446}' | python3 -c \
    "import sys,json; g=json.load(sys.stdin); print(f'  {g[\"title\"]} [{g[\"consoleName\"]}] ⭐{g[\"rating\"]}')" \
    && ok "games-by-id" || fail "games-by-id"

echo "→ games-search mario (NES)"
srv "games-search" '{"query":"mario","console_id":7,"limit":3}' | python3 -c \
    "import sys,json; [print(f'  {g[\"title\"]}') for g in json.load(sys.stdin)]" \
    && ok "games-search" || fail "games-search"

echo "→ games-search mario (cross-platform)"
srv "games-search" '{"query":"mario","limit":5}' | python3 -c \
    "import sys,json; [print(f'  [{g[\"consoleName\"]}] {g[\"title\"]}') for g in json.load(sys.stdin)]" \
    && ok "games-search (cross-platform)" || fail "games-search (cross-platform)"

echo "→ games-related (id=1446)"
srv "games-related" '{"game_id":1446}' | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(f'  {len(d)} related games')" \
    && ok "games-related" || fail "games-related"

# ─── 5. RA Achievements ───────────────────────────────────────────────────────
hdr "5. RA Achievements"

echo "→ ra-achievements-by-game (id=1446)"
srv "ra-achievements-by-game" '{"game_id":1446}' | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(f'  {len(d)} achievements'); [print(f'  [{a[\"achievementId\"]}] {a[\"title\"]} ({a[\"points\"]} pts)') for a in d[:3]]" \
    && ok "ra-achievements-by-game" || fail "ra-achievements-by-game"

echo "→ ra-achievements-by-id (id=3159)"
srv "ra-achievements-by-id" '{"achievement_id":3159}' | python3 -c \
    "import sys,json; a=json.load(sys.stdin); print(f'  {a[\"title\"]} — {a[\"description\"]}')" \
    && ok "ra-achievements-by-id" || fail "ra-achievements-by-id"

echo "→ ra-achievements-unlock (id=3159, lần đầu)"
UNLOCK=$(usr "ra-achievements-unlock" '{"achievement_id":3159}' "${TOKEN}")
echo "$UNLOCK" | python3 -m json.tool
ALREADY=$(echo "$UNLOCK" | python3 -c "import sys,json; print(json.load(sys.stdin).get('already_unlocked','?'))")
[ "$ALREADY" = "False" ] || [ "$ALREADY" = "false" ] \
    && ok "ra-achievements-unlock (lần đầu)" || ok "ra-achievements-unlock (đã unlock trước đó)"

echo "→ ra-achievements-unlock (id=3159, lần 2 — kỳ vọng already_unlocked=true)"
usr "ra-achievements-unlock" '{"achievement_id":3159}' "${TOKEN}" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); assert d['already_unlocked']==True, 'không phải already_unlocked!'; print(f'  already_unlocked={d[\"already_unlocked\"]}')" \
    && ok "ra-achievements-unlock idempotent" || fail "ra-achievements-unlock idempotent"

echo "→ ra-achievements-list"
curl -sf -X GET "${BASE}/v2/rpc/ra-achievements-list?unwrap=true" \
    -H "Authorization: Bearer ${TOKEN}" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(f'  {len(d[\"unlocks\"])} unlocks')" \
    && ok "ra-achievements-list" || fail "ra-achievements-list"

echo "→ users-me-stats (sau unlock)"
curl -sf -X GET "${BASE}/v2/rpc/users-me-stats?unwrap=true" \
    -H "Authorization: Bearer ${TOKEN}" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(f'  total_points={d[\"total_points\"]} unlocked={d[\"achievements_unlocked\"]}')" \
    && ok "users-me-stats (điểm cập nhật)" || fail "users-me-stats"

# ─── 6. ROMs ──────────────────────────────────────────────────────────────────
hdr "6. ROMs"

echo "→ roms-by-game (id=1446)"
srv "roms-by-game" '{"game_id":1446}' | python3 -c \
    "import sys,json; [print(f'  {r[\"romName\"]} [{r[\"region\"]}] {r[\"md5\"]}') for r in json.load(sys.stdin)]" \
    && ok "roms-by-game" || fail "roms-by-game"

echo "→ roms-by-md5"
srv "roms-by-md5" '{"md5":"8e3630186e35d477231bf8fd50e54cdd"}' | python3 -c \
    "import sys,json; r=json.load(sys.stdin); print(f'  [{r[\"gameId\"]}] {r[\"gameTitle\"]} — {r[\"romName\"]}')" \
    && ok "roms-by-md5" || fail "roms-by-md5"

# ─── 7. Custom Achievements ───────────────────────────────────────────────────
hdr "7. Custom Achievements (Nakama storage)"

echo "→ achievements-create"
ACH=$(srv "achievements-create" '{
    "game_id":"test-game-1",
    "title":"Shell Shocked",
    "description":"Hit an enemy with a shell",
    "points":10,
    "icon":"https://example.com/shell.png"
}')
echo "$ACH" | python3 -m json.tool
ACH_ID=$(echo "$ACH" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
ok "achievements-create (id=${ACH_ID})"

echo "→ achievements-by-id"
srv "achievements-by-id" "{\"achievement_id\":\"${ACH_ID}\"}" | python3 -c \
    "import sys,json; a=json.load(sys.stdin); print(f'  {a[\"title\"]} ({a[\"points\"]} pts)')" \
    && ok "achievements-by-id" || fail "achievements-by-id"

echo "→ achievements-by-game"
srv "achievements-by-game" '{"game_id":"test-game-1"}' | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(f'  {len(d)} achievement(s)')" \
    && ok "achievements-by-game" || fail "achievements-by-game"

echo "→ user-achievements-unlock"
usr "user-achievements-unlock" "{\"achievement_id\":\"${ACH_ID}\"}" "${TOKEN}" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(f'  points_earned={d[\"points_earned\"]}')" \
    && ok "user-achievements-unlock" || fail "user-achievements-unlock"

echo "→ user-achievements-list"
curl -sf -X GET "${BASE}/v2/rpc/user-achievements-list?unwrap=true" \
    -H "Authorization: Bearer ${TOKEN}" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(f'  {len(d)} custom unlock(s)')" \
    && ok "user-achievements-list" || fail "user-achievements-list"

# ─── 8. Leaderboard ───────────────────────────────────────────────────────────
hdr "8. Leaderboard"

echo "→ users-leaderboard"
srv "users-leaderboard" '{"limit":5}' | python3 -c \
    "import sys,json; [print(f'  #{e[\"rank\"]} {e[\"username\"]} — {e[\"total_points\"]} pts') for e in json.load(sys.stdin)]" \
    && ok "users-leaderboard" || fail "users-leaderboard"

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════"
echo -e "Kết quả: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
