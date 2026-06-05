# PingMe Product Pipeline

Cập nhật: 2026-06-05

Mục tiêu sản phẩm: xây PingMe theo hướng chat app tương tự Telegram: nhanh, ổn định, hỗ trợ nhiều thiết bị, có chat 1-1, nhóm, media, gọi thoại/video, thông báo, tìm kiếm, quyền riêng tư và các tính năng nâng cao. Làm theo thứ tự: hoàn thành tính năng cơ bản trước, sau đó mới mở rộng sang phần nâng cao.

## Cách Dùng File Này

- `DONE`: đã code và đã test ở mức chấp nhận được.
- `IN_PROGRESS`: đang làm, có thể còn cần test hoặc polish.
- `NEXT`: ưu tiên tiếp theo.
- `PLANNED`: chưa làm.
- `OPTIONAL`: chỉ làm khi các pipeline quan trọng đã ổn.

Mỗi stage chỉ được đánh dấu `DONE` khi đạt đủ các mục trong `Definition of Done`.

## Definition Of Done

Một stage được xem là xong khi:

- UI không vỡ ở desktop và màn hình nhỏ phổ biến.
- Backend route/socket event có validation cơ bản.
- Socket listener trong React có cleanup bằng `socket.off(...)`.
- Event contract rõ: event name, payload, server relay đến ai.
- Không tin identity do client tự gửi nếu có thể lấy từ auth/session.
- `npm run lint` và `npm run build` trong `client/` pass.
- File server vừa sửa pass `node --check`.
- User test được flow chính bằng ít nhất 2 account nếu đó là realtime feature.

## Nguyên Tắc Học Realtime

Phần realtime/Socket.IO/WebRTC sẽ được tách thành bài học:

1. Xác định đâu là state có thể fetch, đâu là event phải push.
2. Xác định client nào emit, server nhận ở đâu, relay đến ai.
3. Xác định identity: `socket.id` là connection, `userId` là người dùng.
4. Xác định payload contract và cleanup listener.
5. Sau khi user tự implement hoặc nói "làm đi", mới chuyển sang verify/refactor.

---

# Basic Pipelines

## Pipeline 0 - Project Foundation

Mục tiêu: dự án dễ đọc, dễ chạy, dễ follow, có quy tắc làm việc rõ ràng.

| Stage | Status | Output |
|---|---|---|
| 0.1 Repo overview | DONE | `CLAUDE.md`, `AGENTS.md` ghi vai trò agent, stack, file cần đọc |
| 0.2 Product pipeline | DONE | `PIPELINE.md` chia Basic/Advanced pipeline |
| 0.3 Local run guide | DONE | Lệnh chạy client/server nằm trong `CLAUDE.md` |
| 0.4 Env hygiene | DONE | `.env`, uploads, node_modules, dist được ignore |
| 0.5 Formatting/lint baseline | DONE | Client có ESLint; backend có `npm run check` syntax baseline |
| 0.6 Test strategy | PLANNED | Thêm smoke test hoặc script test API/socket cơ bản |

Next actions:

- Tạo backend lint/prettier hoặc ít nhất `npm run check`.
- Viết smoke test nhỏ cho login, get friends, send message.

## Pipeline 1 - Account, Auth, Identity

Mục tiêu: login/register/logout ổn định, identity đúng cho REST và Socket.IO.

| Stage | Status | Output |
|---|---|---|
| 1.1 Register/Login UI | DONE | Login/Register minimalist UI |
| 1.2 JWT httpOnly cookies | DONE | `accessToken`, `refreshToken` qua cookie |
| 1.3 Axios refresh flow | DONE | 401 tự refresh và retry request |
| 1.4 Protected routes | DONE | `/chat` cần auth |
| 1.5 Socket auth identity | DONE | Socket verify cookie, gắn `socket.userId` |
| 1.6 Logout socket cleanup | DONE | Socket disconnect khi không authenticated |
| 1.7 Profile basics | DONE | username, avatar URL, bio, password change |
| 1.8 Session/device management | PLANNED | Xem và revoke các session/device |

Definition of Done riêng:

- Client không gửi `senderId/userId` cho các socket event nếu server có thể lấy từ `socket.userId`.
- Logout xóa cookie và ngắt socket.

## Pipeline 2 - Contacts And Social Graph

Mục tiêu: tìm bạn, gửi lời mời, chấp nhận/từ chối, xem danh sách bạn.

| Stage | Status | Output |
|---|---|---|
| 2.1 Search users | DONE | Search user để kết nối |
| 2.2 Send friend request | DONE | Gửi lời mời kết bạn |
| 2.3 Accept friend request | DONE | Chấp nhận lời mời |
| 2.4 Friend list | DONE | Sidebar hiện conversations từ friends |
| 2.5 Realtime friend events | IN_PROGRESS | Có notify accept; cần đồng bộ đầy đủ request mới |
| 2.6 Reject/cancel request | DONE | Từ chối lời mời đã nhận, hủy lời mời đã gửi |
| 2.7 Block/report user | PLANNED | Chặn người dùng, report abuse |

Next actions:

- Thêm route `POST /api/users/reject`.
- Thêm route `POST /api/users/cancel-request`.
- Socket notify khi có lời mời mới để sidebar badge cập nhật realtime.

## Pipeline 3 - One-To-One Messaging Core

Mục tiêu: chat 1-1 nhanh, đúng status, đúng sync, refresh không mất state quan trọng.

| Stage | Status | Output |
|---|---|---|
| 3.1 Send/receive text | DONE | `send_message`, `receive_message` |
| 3.2 Persist messages | DONE | Message lưu MongoDB |
| 3.3 Optimistic UI + ack | DONE | `tempId`, `message_sent`, DB id sync |
| 3.4 Delivered receipt | DONE | `mark_message_delivered`, `message_was_delivered` |
| 3.5 Read receipt by ids | DONE | `mark_messages_read` có `messageIds` |
| 3.6 Unread count | DONE | Sidebar badge realtime + REST summary |
| 3.7 Conversation model + summary | DONE | `Conversation` model/API trả `lastMessage`, `lastMessageAt`, `unreadCount`, client dùng `conversationId` |
| 3.8 Typing indicators | DONE | `typing`, `stop_typing` |
| 3.9 Multi-tab presence | DONE | `userId -> Set(socketId)` |
| 3.10 Message edit/revoke | DONE | Edit message, thu hồi message cho cả hai bên |
| 3.11 Reply basics | DONE | Reply to message, scroll to original |
| 3.12 Pin message | DONE | Nhiều tin ghim, dropdown, jump/highlight, bỏ ghim có confirm |

Next actions:

- Test migration `Conversation` với dữ liệu cũ và chạy `npm run backfill:conversations` nếu cần migrate toàn bộ DB.
- Test nhiều pinned messages: dropdown, số lượng, jump/highlight, refresh, revoke message đang ghim.
- Sau khi pin ổn, cân nhắc chuyển sang album/multiple images hoặc group chat MVP.

## Pipeline 4 - Media, Files, Reactions

Mục tiêu: gửi ảnh/file/reaction như một chat app hiện đại.

| Stage | Status | Output |
|---|---|---|
| 4.1 Upload route + multer | DONE | `POST /api/messages/upload` |
| 4.2 Image/file preview before send | DONE | Preview trong message input |
| 4.3 Attachment schema and socket relay | DONE | `attachment.type/url/filename/size/mimeType` |
| 4.4 Image bubble + lightbox | DONE | Xem ảnh phóng to |
| 4.5 File bubble + download | DONE | File card UI |
| 4.6 Reactions | DONE | Toggle reaction qua socket |
| 4.7 Media gallery | DONE | Panel xem media trong conversation |
| 4.8 Multiple images per message | DONE | Album/grouped media |
| 4.9 Upload progress/retry | DONE | Progress bar, retry khi upload fail |
| 4.10 Voice messages | DONE | Record audio, upload audio attachment, compact mobile playback |

Next actions:

- Pipeline 6.8: hoàn thiện group media gallery cho ảnh, file và audio trong group.
- Sau khi media/group ổn, chuyển sang Pipeline 9 voice/video calls.

## Pipeline 5 - UI/UX Basic Product Polish

Mục tiêu: app dùng hằng ngày thay vì chỉ là demo.

| Stage | Status | Output |
|---|---|---|
| 5.1 Minimalist redesign | DONE | Warm monochrome UI |
| 5.2 Collapsible sidebar | DONE | Sidebar có compact rail |
| 5.3 Empty/loading/error states | IN_PROGRESS | Có một số state, cần đồng bộ toàn app |
| 5.4 Mobile responsive chat | DONE | Conversation list và chat full screen trên mobile |
| 5.5 Keyboard shortcuts | DONE | Enter send, Esc close, Ctrl/Cmd+K focus search |
| 5.6 Accessibility pass | IN_PROGRESS | Focus states, aria labels, keyboard nav cơ bản |
| 5.7 Theme settings | DONE | Light/dark/system local preference |

Next actions:

- Làm mobile layout trước dark mode.
- Đổi các log/debug UI sang toast hoặc silent states.

## Pipeline 6 - Groups Basic

Mục tiêu: group chat cơ bản giống Telegram group nhỏ.

| Stage | Status | Output |
|---|---|---|
| 6.1 Group schema | DONE | Dùng `Conversation` type `group`: title, avatar, members, role |
| 6.2 Create group | DONE | Tạo nhóm từ danh sách friends |
| 6.3 Group message send/receive | DONE | Socket.IO room `conversation:<id>` |
| 6.4 Group history | DONE | REST fetch messages by conversation group |
| 6.5 Add/remove members | DONE | Owner/admin thêm và xóa thành viên có authorization |
| 6.6 Role basics | DONE | owner/admin/member, owner phong/gỡ admin |
| 6.7 Group unread count | DONE | unread/read cursor theo từng member |
| 6.8 Group media gallery | IN_PROGRESS | REST gallery theo conversation, panel group/detail có Media/Audio/Tệp/Liên kết; cần test thực tế |

Realtime notes:

- Group message không nên emit từng user bằng tay lâu dài; nên dùng Socket.IO rooms.
- Mỗi socket của user cần join tất cả rooms cần thiết sau khi auth/register.

## Pipeline 7 - Search And Navigation

Mục tiêu: tìm nhanh người, conversation, message và media.

| Stage | Status | Output |
|---|---|---|
| 7.1 Search friends/users | DONE | Search user trong sidebar |
| 7.2 Search conversations | IN_PROGRESS | Filter local conversations |
| 7.3 Search messages in current chat | DONE | Text/file-name search trong conversation hiện tại |
| 7.4 Global message search | PLANNED | Search all messages user được phép xem |
| 7.5 Media/file search | DONE | Lọc media, file, link trong detail panel |
| 7.6 Jump to message | PLANNED | Search result click -> scroll to message |

Backend notes:

- Cần index text hoặc dedicated search pipeline khi data lớn.
- Không search message mà user không có quyền xem.

## Pipeline 8 - Notifications

Mục tiêu: không bỏ lỡ tin nhắn, nhưng không làm phiền.

| Stage | Status | Output |
|---|---|---|
| 8.1 In-app unread badge | DONE | Sidebar unread count |
| 8.2 In-app notification panel | PLANNED | Bell/list notifications |
| 8.3 Browser notification permission | PLANNED | Notification API |
| 8.4 Push for new messages | PLANNED | Service worker + Web Push |
| 8.5 Notification preferences | PLANNED | Mute chat, mute duration |
| 8.6 Mention notification | PLANNED | Quan trọng cho group |

Product rule:

- Notification là state có thể fetch + event có thể push.
- Nếu app reload, notification badge phải lấy lại được từ DB.

## Pipeline 9 - Voice And Video Calls Basic

Mục tiêu: 1-1 voice/video call hoạt động ổn định trước khi thêm group call.

| Stage | Status | Output |
|---|---|---|
| 9.1 Call UI shell | IN_PROGRESS | `IncomingCallModal`, `CallOverlay`, `CallContext` đã có scaffold |
| 9.2 Call request/ring/reject/end events | PLANNED | Signaling state cơ bản |
| 9.3 WebRTC peer connection | PLANNED | offer/answer/ICE qua Socket.IO |
| 9.4 Mic/camera controls | PLANNED | mute, camera off |
| 9.5 Call timer and states | PLANNED | calling/ringing/connected/ended |
| 9.6 Busy state | PLANNED | User đang trong call |
| 9.7 TURN server strategy | PLANNED | Cần cho network thực tế |

Realtime/WebRTC notes:

- Socket.IO chỉ làm signaling, không truyền audio/video.
- Audio/video đi qua WebRTC peer connection.

## Pipeline 10 - Release, Stability, Operations

Mục tiêu: dự án có thể deploy, debug, rollback, và không vỡ vì thay đổi nhỏ.

| Stage | Status | Output |
|---|---|---|
| 10.1 Environment docs | IN_PROGRESS | Env vars nằm trong `CLAUDE.md` |
| 10.2 Backend health check | DONE | `GET /health` |
| 10.3 Error logging cleanup | PLANNED | Log có context, không spam console |
| 10.4 API/socket smoke tests | PLANNED | Test login, send message, receipts |
| 10.5 CI pipeline | DONE | GitHub Actions chạy client lint/build và server check |
| 10.6 Deployment plan | PLANNED | Client hosting, server hosting, MongoDB |
| 10.7 File storage plan | PLANNED | Local uploads -> cloud storage |
| 10.8 Monitoring | PLANNED | uptime, errors, socket connection counts |

---

# Advanced Pipelines

## Pipeline A1 - Telegram-Grade Multi-Device Sync

Mục tiêu: nhiều thiết bị của cùng user đồng bộ tin nhắn, read state, draft, setting.

| Stage | Status | Output |
|---|---|---|
| A1.1 Multi-tab socket presence | DONE | `userId -> Set(socketId)` |
| A1.2 Multi-device session model | PLANNED | Lưu devices/sessions trong DB |
| A1.3 Sync read state across devices | PLANNED | Đọc ở laptop -> mobile cập nhật |
| A1.4 Draft sync | PLANNED | Draft theo conversation |
| A1.5 Per-device notification settings | PLANNED | Mute device riêng |
| A1.6 Offline sync queue | PLANNED | Khi reconnect fetch missed events |

## Pipeline A2 - Channels And Broadcast

Mục tiêu: kênh broadcast giống Telegram channel.

| Stage | Status | Output |
|---|---|---|
| A2.1 Channel schema | PLANNED | Channel, subscribers, admins |
| A2.2 Create/join/leave channel | PLANNED | Public/private channels |
| A2.3 Broadcast post | PLANNED | Admin post, subscriber receive |
| A2.4 View counters | PLANNED | Count seen/view per post |
| A2.5 Comments/discussion group | PLANNED | Link channel post to group thread |
| A2.6 Admin tools | PLANNED | Manage admins, permissions |

## Pipeline A3 - Advanced Group Admin

Mục tiêu: group lớn có moderation và role rõ.

| Stage | Status | Output |
|---|---|---|
| A3.1 Permissions matrix | PLANNED | send media, pin, invite, ban |
| A3.2 Invite links | PLANNED | Link join public/private |
| A3.3 Ban/mute member | PLANNED | Temporary/permanent |
| A3.4 Slow mode | PLANNED | Rate limit per user |
| A3.5 Admin audit log | PLANNED | Ai đã làm gì, khi nào |
| A3.6 Mentions and replies | PLANNED | @mention, reply navigation |

## Pipeline A4 - Privacy And Security

Mục tiêu: người dùng kiểm soát dữ liệu và mức riêng tư.

| Stage | Status | Output |
|---|---|---|
| A4.1 Block user | PLANNED | Block prevents messaging/presence |
| A4.2 Privacy settings | PLANNED | Who can see online/avatar |
| A4.3 Report abuse | PLANNED | Report message/user |
| A4.4 Secret chat research | PLANNED | E2EE feasibility |
| A4.5 E2EE secret chat MVP | OPTIONAL | Encrypt/decrypt client-side |
| A4.6 Account deletion/export | PLANNED | GDPR-style basics |

Important:

- E2EE không nên làm sớm. Nó ảnh hưởng search, backup, multi-device, moderation.
- Làm privacy/block/report trước E2EE.

## Pipeline A5 - Bots And Integrations

Mục tiêu: hệ sinh thái nhỏ giống Telegram bot.

| Stage | Status | Output |
|---|---|---|
| A5.1 Bot account type | PLANNED | User có type `bot` |
| A5.2 Bot token/API | PLANNED | Token để bot gửi/nhận event |
| A5.3 Slash commands | PLANNED | `/start`, `/help`, custom commands |
| A5.4 Webhook delivery | PLANNED | Server call bot webhook |
| A5.5 Inline buttons | PLANNED | Button callbacks |
| A5.6 Bot permissions | PLANNED | Group/channel permissions |

## Pipeline A6 - Rich Messaging

Mục tiêu: tin nhắn giàu hơn text/file cơ bản.

| Stage | Status | Output |
|---|---|---|
| A6.1 Link preview | IN_PROGRESS | Async server unfurl, lưu `linkPreview`, emit `message_preview_updated`; cần test nhiều domain |
| A6.2 Stickers | PLANNED | Sticker packs |
| A6.3 GIF search/send | PLANNED | GIF provider or local library |
| A6.4 Polls | PLANNED | Poll message type |
| A6.5 Scheduled messages | PLANNED | Send later |
| A6.6 Saved messages | PLANNED | Chat with yourself |
| A6.7 Message translation | OPTIONAL | Later AI/translation |

## Pipeline A7 - Stories / Status

Mục tiêu: stories/status updates sau khi chat core ổn định.

| Stage | Status | Output |
|---|---|---|
| A7.1 Story schema | PLANNED | Media, caption, expiresAt |
| A7.2 Upload story | PLANNED | Image/video short |
| A7.3 Story viewer | PLANNED | Seen state |
| A7.4 Privacy audience | PLANNED | Friends/all/custom |
| A7.5 Reactions/replies | PLANNED | Reply story into chat |

## Pipeline A8 - Scale And Performance

Mục tiêu: sản phẩm chịu dữ liệu lớn hơn demo.

| Stage | Status | Output |
|---|---|---|
| A8.1 Pagination messages | PLANNED | Load older messages |
| A8.2 Virtualized message list | PLANNED | Render large chat smoothly |
| A8.3 Redis adapter for Socket.IO | PLANNED | Scale multi-server |
| A8.4 Redis presence store | PLANNED | Online state not only in memory |
| A8.5 Queue for heavy jobs | PLANNED | Upload processing, notifications |
| A8.6 CDN/cloud storage | PLANNED | Media delivery |
| A8.7 Rate limiting | PLANNED | API/socket abuse protection |

## Pipeline A9 - Mobile/PWA

Mục tiêu: dùng tốt trên phone, gần như app native.

| Stage | Status | Output |
|---|---|---|
| A9.1 Mobile responsive shell | PLANNED | Sidebar drawer, chat screen |
| A9.2 PWA manifest | PLANNED | Installable web app |
| A9.3 Service worker | PLANNED | Cache shell, push notifications |
| A9.4 Mobile media capture | PLANNED | Camera/gallery input |
| A9.5 Touch interactions | PLANNED | Long press, swipe reply |

---

# Suggested Next Order

Nên làm theo thứ tự gần nhất:

1. Commit/push mốc vừa làm: socket auth identity + multi-tab presence + `PIPELINE.md`.
2. Pipeline 3.12: Pin message.
3. Pipeline 4.8: Multiple images per message.
4. Pipeline 6.1-6.4: Group chat MVP.
5. Pipeline 9.2-9.4: Voice/video call MVP.
6. Pipeline 8.2-8.4: Notifications.
7. Pipeline 10.4: API/socket smoke tests.

Nếu bị rối, quay lại nguyên tắc này:

- Chat 1-1 phải thật ổn trước.
- Group phải ổn trước channel.
- Notification phải dựa trên unread state đúng.
- Call phải học WebRTC từng bước, không trộn chung với message socket.
- Scale/Redis/E2EE để sau khi product behavior đã chắc.
