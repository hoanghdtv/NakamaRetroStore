# NakamaRetroStore

Backend cho hệ thống **Retro Achievement** — xây dựng trên [Nakama](https://heroiclabs.com/nakama/) (TypeScript runtime) + PostgreSQL.

---

## Stack

| Service | Image | Mô tả |
|---------|-------|-------|
| **nakama** | `heroiclabs/nakama:3.26.0` | Game server, chạy TypeScript module |
| **postgres** | `postgres:12.2-alpine` | Database chính |

---

## Cấu trúc dự án

```
src/
  main.ts              # InitModule — đăng ký tất cả RPCs
  users.ts             # User profile & điểm
  achievements.ts      # Custom achievement definitions & user unlocks (Nakama storage)
  games.ts             # Games, consoles & RA achievements (PostgreSQL)
  roms.ts              # ROM lookup & leaderboard (PostgreSQL)
build/
  index.js             # TypeScript compiled output (auto-generated)
db/
  ra_consoles.sql      # Bảng danh sách console
  related_roms.sql     # Bảng liên kết game liên quan
  nes_games.sql        # Danh sách game theo platform (top 200)
  nes_achievements.sql # Achievement definitions theo platform
  nes_md5.sql          # ROM MD5 hashes theo platform
  # ... tương tự cho: snes, n64, gba, gbc, gamecube, nds, psx, psp, sega, mame
test/
  test.ts              # TypeScript test client (Node 18+)
  test.sh              # curl test script
local.yml              # Nakama server config
docker-compose.yml
Dockerfile
tsconfig.json
```

---

## Khởi động

**Lần đầu** (xoá volume cũ để load lại toàn bộ SQL):
```bash
docker compose down -v
docker compose up --build
```

**Các lần tiếp theo:**
```bash
docker compose up
```

**Build lại không dùng cache:**
```bash
docker compose build --no-cache && docker compose up
```

---

## Ports

| Port | Mô tả |
|------|-------|
| `7349` | Nakama socket (real-time) |
| `7350` | Nakama HTTP API |
| `7351` | Nakama Console (admin) |
| `5432` | PostgreSQL |

**Nakama Console:** http://localhost:7351 (admin: `admin` / `password`)

---

## HTTP API

**Base URL:** `http://localhost:7350`

Tất cả endpoints đều qua `/v2/rpc/{name}`.  
**Luôn thêm `?unwrap=true`** để gửi JSON object trực tiếp trong body.

### Authentication

| Loại | Header |
|------|--------|
| User session | `Authorization: Bearer <session_token>` |
| Server-to-server | `?http_key=retro_server_http_key` |

**Lấy session token:**
```bash
curl -X POST "http://localhost:7350/v2/account/authenticate/email?create=true&username=player1" \
  -H "Authorization: Basic $(echo -n 'defaultkey:' | base64)" \
  -H "Content-Type: application/json" \
  -d '{"email":"player1@example.com","password":"Password123!"}'
```

---

### Users

| Endpoint | Method | Auth | Payload |
|----------|--------|------|---------|
| `users-me` | GET | Bearer | — |
| `users-by-id` | POST | Bearer | `{ "user_id": "uuid" }` |
| `users-me-points` | POST | Bearer | `{ "points": 100 }` |
| `users-me-stats` | GET | Bearer | — |
| `users-leaderboard` | POST | http_key | `{ "limit": 20 }` |

**users-me-stats** response:
```json
{ "user_id": "uuid", "total_points": 500, "achievements_unlocked": 12 }
```

---

### Consoles

| Endpoint | Method | Auth | Payload |
|----------|--------|------|---------|
| `games-consoles` | GET | http_key | — |

---

### Games

| Endpoint | Method | Auth | Payload |
|----------|--------|------|---------|
| `games-by-console` | POST | http_key | `{ "console_id": 7, "limit": 50, "offset": 0 }` |
| `games-by-id` | POST | http_key | `{ "game_id": 1446 }` |
| `games-search` | POST | http_key | `{ "query": "mario", "console_id": 7, "limit": 20 }` |
| `games-related` | POST | http_key | `{ "game_id": 1446 }` |

> `games-search`: `console_id` không bắt buộc — bỏ qua để tìm trên tất cả platform.

**Console IDs:**

| ID | Platform | ID | Platform |
|----|----------|----|----------|
| 1 | Genesis/Mega Drive | 12 | PlayStation |
| 2 | Nintendo 64 | 16 | GameCube |
| 3 | SNES | 18 | Nintendo DS |
| 5 | Game Boy Advance | 27 | MAME (Arcade) |
| 6 | Game Boy Color | 41 | PSP |
| 7 | NES | | |

---

### RA Achievements (từ DB)

| Endpoint | Method | Auth | Payload |
|----------|--------|------|---------|
| `ra-achievements-by-game` | POST | http_key | `{ "game_id": 1446 }` |
| `ra-achievements-by-id` | POST | http_key | `{ "achievement_id": 3159 }` |
| `ra-achievements-unlock` | POST | Bearer | `{ "achievement_id": 3159 }` |
| `ra-achievements-list` | GET | Bearer | `{ "limit": 50, "cursor": "..." }` |

**ra-achievements-unlock** response:
```json
{
  "already_unlocked": false,
  "unlocked_at": 1741132800,
  "points_earned": 1,
  "achievement_title": "Shroooooms...",
  "game_title": "Super Mario Bros."
}
```
> Tự động cộng `points` vào `total_points`. Gọi lặp lại trả về `already_unlocked: true`.

---

### ROMs

| Endpoint | Method | Auth | Payload |
|----------|--------|------|---------|
| `roms-by-md5` | POST | http_key | `{ "md5": "8e3630186e35d477231bf8fd50e54cdd" }` |
| `roms-by-game` | POST | http_key | `{ "game_id": 1446 }` |

> `roms-by-md5`: thêm `"console_id"` để tăng tốc độ tìm kiếm.

---

### Custom Achievements (Nakama storage)

Hệ thống achievement riêng độc lập với RA — quản lý thủ công.

| Endpoint | Method | Auth | Payload |
|----------|--------|------|---------|
| `achievements-create` | POST | http_key | `{ game_id, title, description, points, icon }` |
| `achievements-by-id` | POST | http_key | `{ "achievement_id": "uuid" }` |
| `achievements-by-game` | POST | http_key | `{ "game_id": "my-game" }` |
| `user-achievements-unlock` | POST | Bearer | `{ "achievement_id": "uuid" }` |
| `user-achievements-list` | GET | Bearer | — |

---

## Storage Schema

| Collection | Key | Owner | Mô tả |
|---|---|---|---|
| `users` | `profile` | user | Thông tin user & tổng điểm |
| `achievements` | `{uuid}` | system | Custom achievement definitions |
| `game_achievement_index` | `{game_id}` | system | Index achievement IDs theo game |
| `user_achievements` | `{uuid}` | user | Custom achievements đã unlock |
| `ra_user_achievements` | `{achievement_id}` | user | RA achievements đã unlock |

---

## Database Schema (PostgreSQL)

Mỗi platform có 3 bảng (`{prefix}` = `nes`, `snes`, `n64`, `gba`, `gbc`, `gamecube`, `nds`, `psx`, `psp`, `sega`, `mame`):

| Bảng | Cột chính |
|------|-----------|
| `{prefix}_games` | `id`, `title`, `rank`, `points`, `rating`, `genre`, `icon`, `boxArt` |
| `{prefix}_achievements` | `achievementId`, `gameId`, `title`, `points`, `badgeUrl`, `memAddr` |
| `{prefix}_md5` | `gameId`, `md5`, `romName`, `region`, `labels` |

Bảng chia sẻ:

| Bảng | Mô tả |
|------|-------|
| `ra_consoles` | Danh sách tất cả console |
| `related_roms` | Quan hệ game liên quan (comma-separated IDs) |

---

## Testing

### TypeScript client (Node 18+)

```bash
npm install -D ts-node @types/node
npx ts-node test/test.ts
```

Kết quả mẫu:
```
=== NakamaRetroStore API Tests ===
✅ Auth — đăng ký / đăng nhập
✅ users-me
✅ games-consoles (43 consoles)
✅ ra-achievements-by-game (Super Mario Bros. — 77 total)
✅ ra-achievements-unlock (lần đầu)
✅ ra-achievements-unlock idempotent
...
════════════════════════════════
Kết quả: 20 passed, 0 failed
```

### curl script

```bash
bash test/test.sh
```

> Yêu cầu: `curl`, `python3` và server đang chạy trên `localhost:7350`.

---

## Development

```bash
npm install
npx tsc
```

---

## Cấu hình (`local.yml`)

| Key | Giá trị | Mô tả |
|-----|---------|-------|
| `runtime.js_entrypoint` | `build/index.js` | Entry point |
| `runtime.http_key` | `retro_server_http_key` | Key server-to-server |
| `session.token_expiry_sec` | `7200` | Timeout session (2 giờ) |

> **Production:** Đổi `http_key` thành secret ngẫu nhiên và không commit vào git.
READMEEOF`, and this is the output of running that command instead:
namvu@192 NakamaRetroStore %  cat > /Volumes/TOMGAU/GitHub/NakamaRetroStore/READ
ME.md << 'READMEEOF'
heredoc> # NakamaRetroStore
heredoc> 
heredoc> Backend cho hệ thống **Retro Achievement** — xây dựng trên [Nakama](htt
ps://heroiclabs.com/nakama/) (TypeScript runtime) + PostgreSQL.
heredoc> 
heredoc> ---
heredoc> 
heredoc> ## Stack
heredoc> 
heredoc> | Service | Image | Mô tả |
heredoc> |---------|-------|-------|
heredoc> | **nakama** | `heroiclabs/nakama:3.26.0` | Game server, chạy TypeScrip
t module |
heredoc> | **postgres** | `postgres:12.2-alpine` | Database chính |
heredoc> 
heredoc> ---
heredoc> 
heredoc> ## Cấu trúc dự án
heredoc> 
heredoc> ```
heredoc> src/
heredoc>   main.ts              # InitModule — đăng ký tất cả RPCs
heredoc>   users.ts             # User profile & điểm
heredoc>   achievements.ts      # Custom achievement definitions & user unlocks 
(Nakama storage)
heredoc>   games.ts             # Games, consoles & RA achievements (PostgreSQL)

heredoc>   roms.ts              # ROM lookup & leaderboard (PostgreSQL)
heredoc> build/
heredoc>   index.js             # TypeScript compiled output (auto-generated)
heredoc> db/
heredoc>   ra_consoles.sql      # Bảng danh sách console
heredoc>   related_roms.sql     # Bảng liên kết game liên quan# NakamaRetroStore

heredoc> 
heredoc> Backend cho hệ thống **Retro Achievement** —s_
heredoc> Backend cho hệ# A
heredoc> ---
heredoc> 
heredoc> ## Stack
heredoc> 
heredoc> | Service | Image | Mô tả |
heredoc> |---------|-------|-------|
heredoc> | **nakama** | `heroiclabs/nakama:3.26.0` | Game server, chạy Typeube
heredoc> #nds
heredoc> | Servpsp|---------|-------|-------|
heredoc>    | **nakama** | `heroiclabsst| **postgres** | `postgres:12.2-alpine` 
| Database chính |
heredoc> 
heredoc> ---
heredoc> 
heredoc> ## Cấu trúc d  
heredoc> ---
heredoc> 
heredoc> ## Cấu trúc dự án
heredoc> 
heredoc> ```
heredoc> src/
heredoc>   main.ts         fig
heredoc> #son
heredoc> ```
heredoc> src/
heredoc>   main.ts   <ffffffff><ffffffff>ng
heredoc>   mL<ffffffff> users.ts             # User profile & điểm
heredoc>   achievements.ts``  achievements.ts      # Custom achievement de--  ga
mes.ts             # Games, consoles & RA achievements (PostgreSQL)
heredoc>   roms.ts     ô  roms.ts              # ROM lookup & leaderboard (Postg
reSQL)
heredoc> build/
heredoc> mpbuild/
heredoc>   index.js             # TypeScript compiled output (a-|  ind34db/
heredoc>   ra_consoles.sql      # Bảng danh sách console
heredoc>   related_ro51  |   related_roms (admin) |
heredoc> | `5432` | PostgreSQL |
heredoc> 
heredoc> *
heredoc> Backend cho hệ thống **Retro Achievement** —s_
heredoc> Backend cho hệ# A
heredoc> --
heredoc> ##Backend cho hệ# A
heredoc> ---
heredoc> 
heredoc> ## Stack
heredoc> 
heredoc> | Service | Imag<ffffffff>--
heredoc> 
heredoc> ## Stack
heredoc> 
heredoc> | Sđ
heredoc> #<ffffffff>u 
heredoc> | Serv2/r|---------|-------|-------|
heredoc> |?u| **nakama** | `heroiclabsJS#nds
heredoc> | Servpsp|---------|-------|-------|
heredoc>    | **nakama** | `heroiclabad| S|
heredoc>    | **nakama** | `heroi session | `A
heredoc> ---
heredoc> 
heredoc> ## Cấu trúc d  
heredoc> ---
heredoc> 
heredoc> ## Cấu trúc dự án
heredoc> 
heredoc> ```
heredoc> src/
heredoc>   main.ts         fig
heredoc> #so_ke
heredoc> # |
heredoc> ---
heredoc> 
heredoc> ## Cấu tr<ffffffff>o
heredoc> #n:*
heredoc> ```
heredoc> src/
heredoc>   main.ts    "hsrp:  moc#son
heredoc> ```
heredoc> src/
heredoc>   mainnt```thsrti  me/  mL<ffffffff> users.ts  &u  achievements.ts``  a
chievements.ts      # Custom o   roms.ts     ô  roms.ts              # ROM looku
p & leaderboard (PostgreSQL)
heredoc> build/
heredoc> mpbuild/
heredoc>   index.js             # TypeScript compil`
heredoc> build/
heredoc> mpbuild/
heredoc>   index.js             # TypeScript compiled output (a-|  ind--mpbui-- 
 index|
heredoc>   ra_ers-me` | GET | Bearer | — |
heredoc> | `users-by-id` | POST | Bearer  related_ro51  |   related_roms (admin)
 |
heredoc> | `543| | `5432` | PostgreSQL |
heredoc> 
heredoc> *
heredoc> Backend cho h<ffffffff>s
heredoc> *
heredoc> Backend cho hệ thBeareBackend cho hệ# A
heredoc> --
heredoc> ##Backend cho hệ# A
heredoc> ---
heredoc> 
heredoc> # `--
heredoc> ##Backend cho h
heredoc> 
heredoc> #*u---
heredoc> 
heredoc> ## Stack
heredoc> 
heredoc> | Seron
heredoc> #:
heredoc> `
heredoc> | Son
heredoc> { "
heredoc> ## Stack
heredoc> 
heredoc> | Sđ
heredoc> #<ffffffff>uota
heredoc> | Sđ
heredoc> s":#<ffffffff>u , | Shi|?u| **nakama** | `heroiclabsJS#nds##| Servpsp|-
--------|-------|------Au   | **nakama** | `heroiclabad| S|
heredoc> |-   | **nakama** | `heroi session s`---
heredoc> 
heredoc> ## Cấu trúc d  
heredoc> ---
heredoc> 
heredoc> ## CấGa
heredoc> #s
heredoc> 
heredoc> ---
heredoc> 
heredoc> ## Cấu tr<ffffffff>d
heredoc> # Au
heredoc> ```
heredoc> src/
heredoc>   main.ts   ---sr-------#so_ke
heredoc> # |--------|
heredoc> | # |
heredoc> -s----c
heredoc> #sol#n:*
heredoc> POST | http_keysr `  mco```
heredoc> src/
heredoc>   mainnt```thsrti "osrse  m 0build/
heredoc> mpbuild/
heredoc>   index.js             # TypeScript compil`
heredoc> build/
heredoc> mpbuild/
heredoc>   index.js             # TypeScript compiled output (a-|  ind--mpbui-- 
 index|
heredoc>   ra_ers-me` | GtempbuiPO  indextpbuild/
heredoc> mpbuild/
heredoc>   index.js             # Teampbui `  index_i  ra_ers-me` | GET | Bearer
 | — |
heredoc> | `users-by-id` | POST | Bearer  related_Co| `users-by-id` | POST | Bea
rer  r || `543| | `5432` | PostgreSQL |
heredoc> 
heredoc> *
heredoc> Backend cho h<ffffffff>s
heredoc> *
heredoc> Backend cho hệ t 1
heredoc> *
heredoc> Backend cho h<ffffffff>s
heredoc> *
heredoc> Backend do 64*
heredoc> Backend ceCube |
heredoc> --
heredoc> ##Backend cho hệ# A
heredoc> ---
heredoc> 
heredoc> # `--
heredoc> ##Back B#y ---
heredoc> 
heredoc> # `--
heredoc> ##Backend(A
heredoc> #ade##Ba| 
heredoc> #*u---
heredoc> 
heredoc> ##y Colo
heredoc> ## S1 |
heredoc> | Sero| 7#:
heredoc> `
heredoc> | |`| |
heredoc> { "
heredoc> 
heredoc> 
heredoc> ### 
heredoc> | Achieve#<ffffffff>uos | Sđ Ds":#| |-   | **nakama** | `heroi session 
s`---
heredoc> 
heredoc> ## Cấu trúc d  
heredoc> ---
heredoc> 
heredoc> ## CấGa
heredoc> #s
heredoc> 
heredoc> ---
heredoc> 
heredoc> ## Cấu tr<ffffffff>d
heredoc> # Au
heredoc> ```
heredoc> src/
heredoc>  tp_key 
heredoc> ## Cấu trúc d  
heredoc> ---
heredoc> 
heredoc> ## CấGa
heredoc> #s
heredoc> 
heredoc> men---
heredoc> 
heredoc> ## CấGa
heredoc> #s| 
heredoc> #tp_#s
heredoc> 
heredoc> ---
heredoc>  "
heredoc> chi
heredoc> veme# Au
heredoc> ```
heredoc> src/}````| sra-  mie# |--------|
heredoc> | # |
heredoc> -s----c
heredoc> #ser| # |
heredoc> -s---ev-s--t_#sol#n15PO}` |
heredoc> | src/
heredoc>   mainnt```thsrti "osET  mBempbuild/
heredoc>   index.js             # ..  index
heredoc> 
heredoc> build/
heredoc> mpbuild/
heredoc>   index.js             # Tonmpbui"a  indexun  ra_ers-me` | GtempbuiPO  
indextpbuild/
heredoc> mpbuild/
heredoc>   index.js             # Temempbuild/
heredoc>   index.js             # Teample  indexer| `users-by-id` | POST | Beare
r  related_Co| `users-by-id` | POST | Bearer  r l<ffffffff>*
heredoc> Backend cho h<ffffffff>s
heredoc> *
heredoc> Backend cho hệ t 1
heredoc> *
heredoc> Backend cho h<ffffffff>s
heredoc> *
heredoc> Backend do 64*
heredoc> Backend ceCube |
heredoc> --
heredoc> ##Backend ----|*
heredoc> Backend cho h|---*
heredoc> Backend cho h<ffffffff>s
heredoc> md5`*
heredoc> Backend do 64key Backend ceCub8e--
heredoc> ##Backend ch31#f8---
heredoc> 
heredoc> # `--
heredoc> ##Back B#ro
heredoc> #-by##Bae`
heredoc> # `--
heredoc> ##Backp_k##Ba `#ade##Ba| ":#*u---
heredoc> 
heredoc> #|
heredoc> 
heredoc> ##y oms## S1 |`:| Serm ``
heredoc> | |`| |
heredoc> d"` { "
heredoc> 
heredoc> 
heredoc> t<ffffffff>
heredoc> g t<ffffffff> A <ffffffff>## Cấu trúc d  
heredoc> ---
heredoc> 
heredoc> ## CấGa
heredoc> #s
heredoc> 
heredoc> ---
heredoc> 
heredoc> ## Cấu tr<ffffffff>d
heredoc> # Au
heredoc> ```ệ---
heredoc> 
heredoc> ## CấGa
heredoc> #sen
heredoc> #ri<ffffffff>s
heredoc> 
heredoc> ---
heredoc> <ffffffff>c
heredoc> l<ffffffff># v<ffffffff> Au
heredoc> ```
heredoc> src/<ffffffff>``l<ffffffff>rth tp c## Cấ| ---
heredoc> 
heredoc> ## CấGa
heredoc> #s |
heredoc> #uth#s
heredoc> 
heredoc> men-ad |
heredoc> |
heredoc> ## C---#s| 
heredoc> #tp--#tp--
heredoc> ---
heredoc> --- "--c|
heredoc> ve`a```
heredoc> srcensr-c| # |
heredoc> -s----c
heredoc> #ser| # |
heredoc> -s---evam-s--, #ser|  d-s---ev-on| src/
heredoc>   mainnt```thsrti "ie  maits  index.js             # ..  index
heredoc> ie
heredoc> build/
heredoc> mpbuild/
heredoc>   index.js      emempbuiy-  index Pmpbuild/
heredoc>   index.js             # Temempbuild/
heredoc>   index.js             # Teample  in B  index `  "achievement_id": "uui
d" }` |
heredoc> | `useBackend cho h<ffffffff>s
heredoc> *
heredoc> Backend cho hệ t 1
heredoc> *
heredoc> Backend cho h<ffffffff>s
heredoc> *
heredoc> Backend do 64*
heredoc> Backend ceCube |
heredoc> --
heredoc> ##Backend ----|*
heredoc> Backend c--*
heredoc> Backend cho h`pro*
heredoc> Backend cho h<ffffffff>s
heredoc> ng t*
heredoc> Backend do 64g đBackend ceCubhi--
heredoc> ##Backend --ui#}`Backend cho h|-toBackend cho h<ffffffff>s
heredoc> inmd5`*
heredoc> Backend de_Backev##Backend ch31#f8---
heredoc> 
heredoc> # `--
heredoc> ##Bacem
heredoc> # `--
heredoc> ##Back B#ro
heredoc> t I##Bahe#-by##Bae` `# `--
heredoc> ##Bev##Bats
heredoc> #|
heredoc> 
heredoc> ##y oms## S1 |`:| Serm ``
heredoc> |iev
heredoc> men| |`| |
heredoc> d"` { "
heredoc> 
heredoc> 
heredoc> t<ffffffff>
heredoc> g sed"` { ev
heredoc> 
heredoc> t<ffffffff>
heredoc> ` | g ac---
heredoc> 
heredoc> ## CấGa
heredoc> #s
heredoc> 
heredoc> ---
heredoc> 
heredoc> ## ac
heredoc> #eve#s
heredoc> 
heredoc> ---
heredoc> ã
heredoc> unl
heredoc> #k |# Au
heredoc> ```ệ-tab``` S
heredoc> ## Cấost#sen
heredoc> #ri
heredoc> M#rii 
heredoc> ---
heredoc> orm<ffffffff>cól3 ```
heredoc> src/<ffffffff>resrx}
heredoc> ## CấGa
heredoc> #s |
heredoc> #uth#s
heredoc> 
heredoc> men-ad , `#s |
heredoc> #utam#utbe
heredoc> men-ds`|
heredoc> ## C-, `p#tp--#tp--`,---
heredoc> --- "
heredoc> 
heredoc> --B<ffffffff>e`a```
heredoc> <ffffffff>rcens<ffffffff>n-s----c
heredoc> #ser|--#ser| ---s---evaef  mainnt```thsrti "ie  maits  index.jsoiie
heredoc> build/
heredoc> mpbuild/
heredoc>   index.js      emempbuiy-  index Pmpbuildvebenmpbui `  indexme  index.
js             # Temempbuild/
heredoc>   inUr  index.js             # Teample  inga| `useBackend cho h<fffffff
f>s
heredoc> *
heredoc> Backend cho hệ t 1
heredoc> *
heredoc> Backend cho h<ffffffff>s
heredoc> *
heredoc> Backend doM<ffffffff>
heredoc> Backend cho hệ t ---|*
heredoc> Backend cho s` | Danh*
heredoc> Backend do 64<ffffffff><ffffffff> cBackend ceCubel--
heredoc> ##Backend --an#h<ffffffff>ackend ciên quaBackend chopaBackend cho h<fff
fffff>s
heredoc> 
heredoc> 
heredoc> ng t*
heredoc> Backend d TBackcr##Backend --ui#}`Backend cho h|-tm inmd5`*
heredoc> Backend de_Backev##Backend ch31#f8---
heredoc> 
heredoc> # est.ts
heredoc> ```
heredoc> # `--
heredoc> ##Bacem
heredoc> # `--
heredoc> ##Back B#ro
heredoc> t Ietr##Bare# `--
heredoc> es##Ba==t I##Bahe#<ffffffff>#Bev##Bats
heredoc> #|
heredoc> 
heredoc> ##y oms##<ffffffff><ffffffff>#|
heredoc> 
heredoc> ##y oms-
heredoc> e
heredoc> <ffffffff>iev
heredoc> men| |`| |
heredoc> d"` { "
heredoc> nsmens)d"` { "
heredoc> 
heredoc> ch
heredoc> 
heredoc> t<ffffffff>
heredoc> nts-g -g
heredoc> t<ffffffff>
heredoc> ` | g Mar`  B
heredoc> ## CấGa7 t#s
heredoc> 
heredoc> ---
heredoc> <ffffffff> 
heredoc> a-a
heredoc> #iev#evets
heredoc> ---
heredoc> ck ã<ffffffff>n #k<ffffffff>``ệ- r## Cấost#sen-u#ri
heredoc> M#rii 
heredoc> --enM#..---
heredoc> o<ffffffff>r<ffffffff><ffffffff>src/<ffffffff>resrx<ffffffff># CấG<ffff
ffff><ffffffff>═<ffffffff>s |
heredoc> #ut<ffffffff>ut<ffffffff><ffffffff>men-═#utam#utbe
heredoc> me<ffffffff><ffffffff>men-ds`|
heredoc> <ffffffff># C-, <ffffffff>-- "
heredoc> 
heredoc> --B<ffffffff>e`a```
heredoc> <ffffffff>rd,
heredoc> --Bailed
heredoc> ```
heredoc> 
heredoc> ### #ser|--#ser| ---babuild/
heredoc> mpbuild/
heredoc>   index.js      emempbuiy-  index Pmpbuildvebenmpbermpbuig   indextr  i
nUr  index.js             # Teample  inga| `useBackend cho h<ffffffff>s
heredoc> *
heredoc> Backend cho hệ t 1
heredoc> *
heredoc> Backendlo*
heredoc> Backend cho hệ t 1
heredoc> *
heredoc> Backend cho h<ffffffff>s
heredoc> *
heredoc> Backend doM<ffffffff>
heredoc> Backend--|
heredoc> *
heredoc> Backend cho h<ffffffff>s
heredoc> poin*
heredoc> Backend doM<ffffffff>ex.jBackend cho oiBackend cho s` | Danh*
heredoc> y`Backend do 64<ffffffff><ffffffff> cBack_k##Backend --an#h<ffffffff>ac
kend ciên ques
heredoc> 
heredoc> ng t*
heredoc> Backend d TBackcr##Backend --ui#}`Backend cho h|-tm in
heredoc> > *BackduBackend de_Backev##Backend ch31#f8---
heredoc> 
heredoc> # est.ts
heredoc> ```
heredoc> # `--
heredoc>  k
heredoc> # est.ts
heredoc> ```
heredoc> # `--
heredoc> ##Bacem
heredoc> # `--