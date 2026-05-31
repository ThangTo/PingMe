# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## My Role in This Project

Tôi là người hướng dẫn realtime/socket cho bạn. Nguyên tắc:

- **Phần realtime & socket (Socket.io, WebRTC, signaling):** Tôi sẽ **hướng dẫn** — giải thích cái gì cần code, ở file nào, tại sao. Bạn tự implement để học.
- **Phần không liên quan realtime (UI, state thường, API REST, logic thuần túy):** Tôi có thể tự code.

## Project Overview

**PingMe** is a full-stack real-time messaging app with a sci-fi neural network UI (dark backgrounds, neon gradient accents, cyberpunk theme). Monorepo with two independent Node.js packages.

Working directory: `D:/Project/PingMe`

## Commands

```sh
# Backend (port 3001)
cd server && npm install && npm run dev

# Frontend (port 5173)
cd client && npm install && npm run dev

# Frontend production build
cd client && npm run build

# Lint (frontend only)
cd client && npm run lint
```

## Tech Stack

| | Client | Server |
|---|---|---|
| Framework | React 19 + Vite 7 | Express 5 |
| Language | JavaScript (JSX, no TypeScript) | Node.js ESM |
| Styling | Tailwind CSS v4 (CSS-first config) | — |
| Real-time | Socket.io-client | Socket.io 4 |
| HTTP | Axios + 401 refresh interceptor | REST API |
| Database | — | MongoDB + Mongoose 8 |
| Auth | localStorage + Context API | JWT + bcrypt (httpOnly cookies) |

## Project Specs (`.claude/specs/`)

Always read the relevant spec before implementing features. Current active specs:

- `media-file-sharing/requirements.md` — Images, file attachments, lightbox, reactions, media gallery
- `voice-video-calls/requirements.md` — WebRTC calls (STUN, offer/answer signaling, call UI)

### Client (`client/src/`)
- `main.jsx` — Entry point: mounts `AuthProvider` + `SocketProvider`
- `App.jsx` — Router: `/login`, `/register` (public), `/chat` (protected)
- `socket.js` — Singleton Socket.io-client (`autoConnect: false`)
- `config/api.js` — Axios instance with 401 → refresh token interceptor
- `context/AuthContext.jsx` — User state, login/logout/register
- `context/SocketContext.jsx` — Socket connection state
- `pages/Login.jsx`, `Register.jsx`, `Chat.jsx` — Main page components
- `components/layout/` — `AuthLayout` (Framer Motion 3D flip), `ChatArea`, `Header`, `Sidebar`, `MiniSidebar`, `TopNavBar`
- `components/chat/` — `MessageBubble`, `MessageInput`, `MessageList`
- `components/ui/` — `Avatar`, `Button`, `Input`, `SearchBar`, `ValidationMessage`

### Server (`server/`)
- `index.js` — Express app + HTTP server + Socket.io setup
- `config/db.js` — Mongoose connection
- `models/User.js` — Schema with bcrypt password (`select: false`), JWT tokens, friends[], friendRequests[]
- `models/Message.js` — Schema: sender/recipient, content, status, roomId, replyTo
- `controllers/` — `auth.controller`, `message.controller`, `user.controller` (thin: request → service → response)
- `services/auth.service.js` — bcrypt + JWT logic
- `middlewares/auth.middleware.js` — JWT verify (checks cookies first, then `Authorization: Bearer`)
- `routers/` — `auth.routes`, `message.routes`, `user.routes`
- `socket/socketHandler.js` — In-memory `onlineUsers` map, socket event handlers

## Key Patterns

**Auth Flow:** Register/login → server sets `accessToken` (15m) + `refreshToken` (7d) as httpOnly cookies. User object stored in `localStorage` as `pingme_user`. Axios interceptor auto-calls `POST /auth/refresh` on 401 and retries the failed request. `authMiddleware` checks cookies first, then Bearer header. Note: `password` has `select: false` — use `.select('+password')` when comparing.

**Socket Flow:** `client/src/socket.js` is a singleton (`autoConnect: false`). `SocketProvider` auto-connects on mount. `Chat.jsx` emits `register_user` on mount → server maps `userId → socketId` in its in-memory `onlineUsers`. Friend online/offline broadcasts via `user_status_changed`. Messages are saved to MongoDB then relayed to recipient via `receive_message`. Socket.io `io.use()` middleware is stubbed (accepts all connections).

**Tailwind v4 CSS-first:** Theme tokens (`@theme {}`), custom utilities (`prism-border`, `nebula-bg`, `.animate-message-pop`, `.animate-fade-in`), and font families are defined in `index.css` — **not** in `tailwind.config.js` (does not exist). **Never create `tailwind.config.js`** — extend the theme in `index.css`.

**UI Aesthetic:** Space Grotesk (headlines), Inter (body), Material Symbols Outlined (icons). `AuthLayout.jsx` uses Framer Motion `AnimatePresence` with 3D `rotateY` flip transitions between Login/Register.

**Code Language:** All source comments are in Vietnamese — team convention. Do not translate them.

## API Endpoints

```
POST /api/auth/register   — No auth   — Create account
POST /api/auth/login      — No auth   — Login (sets httpOnly cookies)
POST /api/auth/logout     — Auth      — Clear cookies
POST /api/auth/refresh    — No auth   — Refresh tokens
GET  /api/messages/:userId — Auth     — Get conversation
POST /api/messages/upload — Auth      — Multipart file upload (images/files)
GET  /api/users           — Auth      — All users except self
GET  /api/users/friends   — Auth      — Friend list
GET  /api/users/requests  — Auth      — Pending friend requests
GET  /api/users/search?q= — Auth      — Search users
POST /api/users/request   — Auth      — Send friend request
POST /api/users/accept    — Auth      — Accept friend request
GET  /health              — No auth   — Health check
```

## Socket.io Events

```
Client → Server: register_user, send_message, typing, stop_typing,
                  mark_messages_read, send_friend_request, accept_friend_request,
                  add_reaction, remove_reaction,
                  call_request, call_cancelled, call_accepted, call_rejected, call_ended,
                  offer, answer, ice_candidate
Server → Client: get_online_friends, user_status_changed, receive_message,
                  message_sent, user_typing, user_stopped_typing, messages_were_read,
                  receive_friend_request, friend_request_accepted, connection_success,
                  reaction_added, reaction_removed,
                  incoming_call, call_cancelled, call_accepted, call_rejected,
                  call_ended, offer, answer, ice_candidate, user_busy
```

## Known Gaps / TODOs

- ⚠️ Media & File Sharing — in progress (backend: multer upload, frontend: lightbox, reactions)
- ⚠️ Voice & Video Calls — in progress (WebRTC + Socket.io signaling)
- "Reject friend request" button exists in `Sidebar.jsx` — no backend route
- Persistent unread counts are client-side only (not stored in DB)
- No tests, no backend ESLint, no Prettier, no Docker, no CI/CD
- `.env` files are tracked in git — **do not commit secrets**
- Google OAuth is defined in requirements but not implemented

## Env Vars

```
client/.env:  VITE_API_URL=http://localhost:3001/api
server/.env:  MONGODB_URI, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET,
              ACCESS_TOKEN_EXPIRES_IN=15m, REFRESH_TOKEN_EXPIRES_IN=7d
```

## Development Notes

- Server uses Mongoose 8 with async/await. `connectDB()` called once at startup.
- `nodemon` watches server files and auto-restarts on changes.
- Always apply `authMiddleware` to new protected routes.
- Controllers delegate business logic to services — don't put logic directly in controllers.
- Use the `.claude/specs/` directory for project requirements and roadmap context.
- **Socket realtime:** Đọc spec trước khi code phần socket. Mỗi bước realtime đều cần được hướng dẫn rõ ràng.
- **Khi nào tự làm:** Phần UI/frontend thuần túy (không liên quan socket), logic state thường, file cấu trúc mới không có socket → tự code luôn.
