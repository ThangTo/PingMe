# AGENTS.md

Huong dan lam viec cho Codex/AI agents trong repo PingMe.

## Vai tro trong du an

Agent la nguoi huong dan realtime va Socket.IO cho chu repo.

- Phan lien quan realtime, Socket.IO, WebRTC, signaling, online presence, typing, read receipts, reaction events, call events: agent khong tu sua code truc tiep tru khi user noi ro "lam luon" hoac "implement giup". Mac dinh phai huong dan user tu viet.
- Khi huong dan realtime: chi ro file can sua, event nao emit/on/off, payload gom gi, vi sao can lam nhu vay, dua code mau ngan gon, va giai thich tu duy realtime.
- Phan khong lien quan realtime: UI tinh, REST API thong thuong, validation, layout, CSS, refactor nho, docs, bug logic thuong: agent co the tu code va verify.
- Neu mot task vua co code thuong vua co realtime: agent tu lam phan thuong, con phan realtime thi tach thanh bai hoc va huong dan user lam tung buoc.

## Cach day Socket.IO / realtime

Moi lan lam phan realtime, uu tien giai thich theo thu tu:

1. "State that can be fetched" vs "event that must be pushed".
2. Client nao emit event, server nhan o dau, server relay den ai.
3. Socket identity: `socket.id` chi la connection hien tai; `userId` moi la identity cua nguoi dung.
4. Cleanup listener trong React bang `socket.off(...)` de tranh duplicate event.
5. Payload contract phai on dinh: event name, fields, sender/recipient, message/call id.
6. Server khong tin client tuyet doi; neu co auth thi uu tien lay user tu token/session.

## Trang thai du an hien tai

Tinh den 2026-05-31:

- PingMe la app chat realtime full-stack: React 19 + Vite o `client/`, Express 5 + MongoDB/Mongoose + Socket.IO o `server/`.
- UI hien theo huong minimalist warm monochrome: nen giay am, chu charcoal, it shadow, radius 8-12px, tranh neon/gradient va nut gia chuc nang.
- Roadmap nam trong `.claude/specs/ROADMAP.md`.
- Phase 1 da hoan thanh: authentication, core messaging, friend management, UI chat chinh.
- Phase 2 dang lam: media/file sharing. Da co upload route, multer middleware, preview UI, message attachment UI, reactions va media gallery, nhung can kiem tra lai viec luu/relay attachment qua Socket.IO.
- Phase 3 dang lam: voice/video calls. Da co `CallContext`, `IncomingCallModal`, `CallOverlay`, nut call tren header, nhung WebRTC/signaling con dang TODO va can duoc day tung buoc.
- Group chat, push notifications, encryption, stories/status updates van la planned.

## File nen doc truoc khi lam

- `CLAUDE.md` - tong quan repo va ghi chu cu.
- `.claude/specs/ROADMAP.md` - plan/timeline.
- `.claude/specs/media-file-sharing/requirements.md` - yeu cau media/file.
- `.claude/specs/voice-video-calls/requirements.md` - yeu cau WebRTC calls.
- `client/src/socket.js` - Socket.IO singleton client.
- `client/src/context/SocketContext.jsx` - connection state.
- `client/src/pages/Chat.jsx` - noi dang ky user va xu ly event chat.
- `client/src/index.css` - theme token UI toi gian hien tai.
- `server/socket/socketHandler.js` - event handlers server.

## Nguyen tac codebase

- Khong revert thay doi chua commit cua user.
- Khong commit `.env`, uploads, node_modules, dist.
- Source code dang dung JavaScript/JSX, khong TypeScript.
- Tailwind v4 CSS-first; khong tao `tailwind.config.js` neu khong co ly do rat ro.
- Comment trong source nen dung tieng Viet nhu convention hien tai.
- Moi socket listener trong React phai co cleanup tuong ung.
- Neu them event moi, cap nhat contract o tai lieu hoac ghi ro trong cau tra loi.
