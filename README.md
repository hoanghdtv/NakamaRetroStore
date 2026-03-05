# NakamaRetroStore

Backend cho hệ thống **Retro Achievement** — xây dựng trên [Nakama](https://heroiclabs.com/nakama/) (TypeScript runtime) + PostgreSQL.

---

## Stack

| Service | Image | Mô tả |
|---------|-------|-------|
| **nakama** | `heroiclabs/nakama:3.26.0` | Game server, chạy TypeScript module |
| **postgres** | `postgres:12.2-alpine` | Database chính |
| **tf** | `tensorflow/serving` | TensorFlow Serving (model inference) |

---

## Cấu trúc dự án

```
src/
  main.ts            # InitModule — đăng ký tất cả RPCs
  users.ts           # User profile & điểm
  achievements.ts    # Achievement definitions & user unlocks
build/
  index.js           # TypeScript compiled output (auto-generated)
api/
  xoxoapi.proto      # Protobuf schema
local.yml            # Nakama server config
docker-compose.yml
Dockerfile
tsconfig.json
```

---

## Khởi động

```bash
docker compose up --build nakama
```

Lần đầu sẽ tự động chạy database migration. Các lần tiếp theo:

```bash
docker compose up nakama
```

Build lại không dùng cache:

```bash
docker compose build --no-cache nakama && docker compose up nakama
```

---

## Ports

| Port | Mô tả |
|------|-------|
| `7349` | Nakama socket (real-time) |
| `7350` | Nakama HTTP API |
| `7351` | Nakama gRPC |
| `5432` | PostgreSQL |

**Nakama Console:** http://localhost:7351 (admin: `admin` / `password`)

---

## HTTP API

Base URL: `http://localhost:7350`

Tất cả endpoints đều qua `POST /v2/rpc/{name}`.

### Authentication

| Loại | Header / Query |
|------|----------------|
| User session | `Authorization: Bearer <session_token>` |
| Server-to-server | `?http_key=retro_server_http_key` |

---

### Users

#### Lấy profile của chính mình
```
GET /v2/rpc/users-me
Authorization: Bearer <token>
```
Response:
```json
{
  "id": "uuid",
  "username": "player1",
  "email": "player1@example.com",
  "created_at": 1741132800,
  "total_points": 500
}
```

#### Lấy profile theo user ID (public)
```
POST /v2/rpc/users-by-id
Authorization: Bearer <token>

{ "user_id": "uuid" }
```

#### Cộng điểm thủ công
```
POST /v2/rpc/users-me-points
Authorization: Bearer <token>

{ "points": 100 }
```

---

### Achievements

#### Tạo achievement mới (admin)
```
POST /v2/rpc/achievements-create?http_key=retro_server_http_key

{
  "game_id": "sonic-1",
  "title": "Speed Demon",
  "description": "Finish Green Hill Zone in under 30 seconds",
  "points": 50,
  "icon": "https://cdn.example.com/icons/speed.png"
}
```

#### Lấy achievement theo ID
```
POST /v2/rpc/achievements-by-id?http_key=retro_server_http_key

{ "achievement_id": "uuid" }
```

#### Liệt kê tất cả achievements của một game
```
POST /v2/rpc/achievements-by-game?http_key=retro_server_http_key

{ "game_id": "sonic-1" }
```

---

### User Achievements

#### Unlock achievement
```
POST /v2/rpc/user-achievements-unlock
Authorization: Bearer <token>

{ "achievement_id": "uuid" }
```
Response:
```json
{
  "already_unlocked": false,
  "unlocked_at": 1741132800,
  "points_earned": 50
}
```
> Tự động cộng `points` vào `total_points` của user.

#### Liệt kê achievements đã unlock
```
GET /v2/rpc/user-achievements-list
Authorization: Bearer <token>
```

---

## Storage Schema

Nakama lưu dữ liệu dạng key-value trong collections:

| Collection | Key | Owner | Mô tả |
|---|---|---|---|
| `users` | `profile` | user | Thông tin user |
| `achievements` | `{achievement_id}` | system | Định nghĩa achievement |
| `game_achievement_index` | `{game_id}` | system | Danh sách achievement IDs theo game |
| `user_achievements` | `{achievement_id}` | user | Achievement đã unlock |

---

## Development

Compile TypeScript cục bộ:
```bash
npm install
npx tsc
```

---

## Cấu hình (`local.yml`)

| Key | Giá trị | Mô tả |
|-----|---------|-------|
| `runtime.js_entrypoint` | `build/index.js` | Entry point TypeScript |
| `runtime.http_key` | `retro_server_http_key` | Key cho server-to-server API |
| `session.token_expiry_sec` | `7200` | Session timeout (2 giờ) |

> **Production:** Đổi `http_key` thành secret ngẫu nhiên và không commit vào git.
