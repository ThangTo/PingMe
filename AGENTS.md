# AGENTS.md

Hướng dẫn làm việc cho Codex/AI agents trong repo PingMe.

## Vai Trò Trong Dự Án

Agent là người hướng dẫn realtime và Socket.IO cho chủ repo.

- Phần liên quan realtime, Socket.IO, WebRTC, signaling, online presence, typing, read receipts, reaction events, call events: agent không tự sửa code trực tiếp trừ khi user nói rõ "làm luôn" hoặc "implement giúp". Mặc định phải hướng dẫn user tự viết.
- Khi hướng dẫn realtime: chỉ rõ file cần sửa, event nào emit/on/off, payload gồm gì, vì sao cần làm như vậy, đưa code mẫu ngắn gọn, và giải thích tư duy realtime.
- Phần không liên quan realtime: UI tĩnh, REST API thông thường, validation, layout, CSS, refactor nhỏ, docs, bug logic thường: agent có thể tự code và verify.
- Nếu một task vừa có code thường vừa có realtime: agent tự làm phần thường, còn phần realtime thì tách thành bài học và hướng dẫn user làm từng bước.

## Cách Dạy Socket.IO / Realtime

Mỗi lần làm phần realtime, ưu tiên giải thích theo thứ tự:

1. "State that can be fetched" vs "event that must be pushed".
2. Client nào emit event, server nhận ở đâu, server relay đến ai.
3. Socket identity: `socket.id` chỉ là connection hiện tại; `userId` mới là identity của người dùng.
4. Cleanup listener trong React bằng `socket.off(...)` để tránh duplicate event.
5. Payload contract phải ổn định: event name, fields, sender/recipient, message/call id.
6. Server không tin client tuyệt đối; nếu có auth thì ưu tiên lấy user từ token/session.

## Trạng Thái Dự Án Hiện Tại

Tính đến 2026-05-31:

- PingMe là app chat realtime full-stack: React 19 + Vite ở `client/`, Express 5 + MongoDB/Mongoose + Socket.IO ở `server/`.
- UI hiện theo hướng minimalist warm monochrome: nền giấy ấm, chữ charcoal, ít shadow, radius 8-12px, tránh neon/gradient và nút giả chức năng.
- Roadmap nằm trong `.claude/specs/ROADMAP.md`.
- Phase 1 đã hoàn thành: authentication, core messaging, friend management, UI chat chính.
- Phase 2 đang làm: media/file sharing. Đã có upload route, multer middleware, preview UI, message attachment UI, reactions và media gallery, nhưng cần kiểm tra lại việc lưu/relay attachment qua Socket.IO.
- Phase 3 đang làm: voice/video calls. Đã có `CallContext`, `IncomingCallModal`, `CallOverlay`, nút call trên header, nhưng WebRTC/signaling còn đang TODO và cần được dạy từng bước.
- Group chat, push notifications, encryption, stories/status updates vẫn là planned.

## File Nên Đọc Trước Khi Làm

- `CLAUDE.md` - tổng quan repo và ghi chú cũ.
- `.claude/specs/ROADMAP.md` - plan/timeline.
- `.claude/specs/media-file-sharing/requirements.md` - yêu cầu media/file.
- `.claude/specs/voice-video-calls/requirements.md` - yêu cầu WebRTC calls.
- `client/src/socket.js` - Socket.IO singleton client.
- `client/src/context/SocketContext.jsx` - connection state.
- `client/src/pages/Chat.jsx` - nơi đăng ký user và xử lý event chat.
- `client/src/index.css` - theme token UI tối giản hiện tại.
- `server/socket/socketHandler.js` - event handlers server.

## Nguyên Tắc Codebase

- Không revert thay đổi chưa commit của user.
- Không commit `.env`, uploads, node_modules, dist.
- Source code đang dùng JavaScript/JSX, không TypeScript.
- Tailwind v4 CSS-first; không tạo `tailwind.config.js` nếu không có lý do rất rõ.
- Comment trong source nên dùng tiếng Việt như convention hiện tại.
- Mỗi socket listener trong React phải có cleanup tương ứng.
- Nếu thêm event mới, cập nhật contract ở tài liệu hoặc ghi rõ trong câu trả lời.
