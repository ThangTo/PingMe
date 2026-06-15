# PingMe Priority Feature Pipeline

Cập nhật: 2026-06-11

Nguồn đầu vào:

- `PIPELINE.md`: trạng thái hiện tại của Basic và Advanced Pipelines.
- `FEATURES.md`: danh sách tính năng bắt kịp, tính năng thu hút và ý tưởng đột phá.
- Tham chiếu thị trường 2026: Telegram đang đẩy mạnh AI bots, polls, scheduled messages, sticker search; WhatsApp có message summaries, advanced chat privacy, group message history; Slack có canvas, lists, AI recap và workflow; Messenger tập trung chất lượng call.

Mục tiêu của file này: biến danh sách tính năng thành một pipeline ưu tiên rõ ràng, có tag theo từng giai đoạn, dễ chọn việc tiếp theo và giúp PingMe trở thành app chat thật sự hữu dụng, có lý do đủ mạnh để người dùng quay lại hằng ngày.

---

## Định Vị Sản Phẩm

PingMe nên được định vị là:

> Ứng dụng nhắn tin giúp người dùng không bỏ lỡ thông tin, dễ đưa ra quyết định và hoàn thành việc chung ngay trong hội thoại.

Telegram mạnh ở cộng đồng, bot và tốc độ. Messenger mạnh ở mạng xã hội và gọi điện. WhatsApp mạnh ở riêng tư và độ phổ cập. Slack mạnh ở workflow nhóm. PingMe nên thắng bằng tổ hợp:

- Chat cá nhân và nhóm nhỏ thật nhanh, ít nhiễu.
- Conversation có trí nhớ: biết việc gì đang chờ, quyết định nào đã chốt, file nào quan trọng.
- Quyền riêng tư rõ ràng theo từng conversation.
- AI hỗ trợ người dùng bắt kịp, tìm lại và hành động, không biến app thành một lớp tính năng rườm rà.

---

## Cách Dùng File Này

### Priority

- `P0`: phải làm ngay để sản phẩm đáng tin và không vỡ khi dùng thật.
- `P1`: nên làm sớm vì tăng retention và daily utility rõ ràng.
- `P2`: khác biệt hóa mạnh, giúp PingMe có câu chuyện riêng.
- `P3`: mở rộng cộng đồng, hệ sinh thái, scale hoặc growth dài hạn.
- `P4`: nghiên cứu hoặc optional, chỉ làm khi nền tảng đã vững.

### Status

- `DONE`: đã code và đã test ở mức chấp nhận được.
- `IN_PROGRESS`: đang UAT hoặc còn release gate cần xác nhận.
- `READY_TO_TEST`: đã implement, cần user acceptance test.
- `NEXT`: nên làm tiếp theo.
- `PLANNED`: chưa làm.
- `RESEARCH`: cần thiết kế kỹ trước khi code.
- `OPTIONAL`: chưa cần trong giai đoạn sản phẩm hiện tại.

### Tags

- `#core`: chất lượng chat cốt lõi.
- `#retention`: làm người dùng quay lại hằng ngày.
- `#wow`: có thể trở thành lý do chuyển sang PingMe.
- `#realtime`: cần Socket.IO/WebRTC/event contract.
- `#ai`: cần AI, transcription, summary hoặc semantic search.
- `#privacy`: dữ liệu, permission, consent, export/delete.
- `#trust-safety`: chống spam, scam, abuse, moderation.
- `#group`: nhóm, role, topic, admin.
- `#call`: voice/video/WebRTC.
- `#growth`: mời bạn, share, profile, channel, community.
- `#scale`: performance, queue, Redis, CDN, rate limit.
- `#mobile`: PWA, touch, mobile ergonomics.
- `#platform`: bot, API, integration, mini app.
- `#monetization`: có thể mở đường cho premium hoặc paid workspace.

### Realtime Rule

Các stage có tag `#realtime`, `#call`, `#presence`, `#notification` phải được tách thành bài học trước khi implement:

1. State nào fetch được, event nào phải push.
2. Client nào emit, server nhận ở đâu, server relay đến ai.
3. Identity dùng `userId` từ auth/session, không tin client tự gửi.
4. Payload contract ổn định.
5. React listener luôn có cleanup bằng `socket.off(...)`.

---

## North Star Metrics

Các phase nên phục vụ ít nhất một metric cụ thể:

| Metric                             | Ý nghĩa                                   | Feature ảnh hưởng mạnh                                    |
| ---------------------------------- | ----------------------------------------- | --------------------------------------------------------- |
| `D1/D7 retention`                  | Người dùng quay lại sau 1 ngày, 7 ngày    | Saved Messages, Draft Sync, Notifications, Smart Catch-up |
| `Messages per active conversation` | Conversation có sống thật không           | Scheduled Messages, Polls, Checklist, Intent Message      |
| `Time to catch up`                 | Mất bao lâu để hiểu nhóm sau khi vắng mặt | Smart Catch-up, Decision Timeline, Group Handover         |
| `Resolved conversation debt`       | Bao nhiêu câu hỏi/lời hứa được xử lý      | Intent Message, Conversation Debt, Reminder               |
| `Invite conversion`                | Người được mời có tham gia và ở lại không | QR/Profile Sharing, Invite Links, Group History           |
| `Trust actions completed`          | User có kiểm soát privacy/safety không    | Passkeys, Privacy Agreement, Advanced Chat Privacy        |

---

## Priority Snapshot

Thứ tự ưu tiên tổng quát:

1.  `P0` Stabilize & UAT: xác nhận toàn bộ Basic, pagination, privacy, search, notification thật sự ổn.
2.  `P1` Daily Carryover: Saved Messages, Draft Sync, Scheduled/Recurring Messages, QR/Profile Sharing.
3.  `P1` Planning Layer: Poll, Checklist, Event, Message Evolution, Conversation Workspace MVP.
4.  `P2` Smart Catch-up: summary, decision timeline, unanswered questions, mention focus, jump to original.
5.  `P2` Voice Intelligence: transcription, voice summary, timestamp reply, searchable voice.
6.  `P2` Group Focus: topics/threads, invite links, group handover, permissions.
7.  `P2` Call Collaboration: call link, group call, screen share, call memory.
8.  `P2` Trust & Safety: passkeys, anti-scam screen, privacy agreement, export/delete.
9.  `P3` Channels/Bots/Mini Apps: community growth and ecosystem.
10. `P4` E2EE/Local-first AI: research first, build later.

Ba bet có tiềm năng tạo khác biệt lớn nhất:

- Smart Catch-up.
- Intent Message + Conversation Debt.
- Conversation Workspace + Shared Plans.

---

# Phase 0 - Product Readiness And Acceptance

Tags: `#P0`, `#core`, `#retention`, `#quality`, `#uat`

Mục tiêu: trước khi thêm tính năng mới, xác nhận nền hiện tại đủ chắc để dùng như app thật. Đây là phase "không hào nhoáng nhưng cứu sản phẩm".

| Stage                               | Status      | Priority | Tags                             | Scope                                                                           | Output / Gate                                                                                          |
| ----------------------------------- | ----------- | -------- | -------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 0.1 Basic UAT sweep                 | DONE        | P0       | `#core #uat`                     | Test toàn bộ Basic Pipelines 0-10 theo `TEST_PIPELINE.md` với ít nhất 2 account | Automated/headless + ops gate (check/lint/build) pass; VAPID cố định đã set, TURN (Metered) đã cấu hình; WebRTC media và Web Push đã xác nhận trên thiết bị thật |
| 0.2 Long chat UAT                   | DONE        | P0       | `#scale #core`                   | Test A8.1/A8.2: pagination, virtualized list, jump, keep scroll khi load older  | Cursor pagination, virtualization, jump và giữ scroll đã pass desktop/mobile                           |
| 0.3 Privacy/search/notification UAT | DONE        | P0       | `#privacy #notification #search` | Test A4.2, A6.1, 7.4, 7.6, 8.2, 8.6                                             | Search/jump/link preview/privacy persistence pass; logic unread đã review (direct=status, group=cutoff, list aggregate khớp socket recount); avatar thật, Web Push và badge đã xác nhận trên thiết bị thật |
| 0.4 Release confidence              | DONE        | P0       | `#quality #ops`                  | Seed data demo, smoke test trước release, rollback notes                        | Có `docs/RELEASE_CHECKLIST.md` và smoke test lặp lại được                                              |
| 0.5 Bug triage board                | DONE        | P0       | `#quality`                       | Gom bug theo severity: blocker, major, minor, polish                            | Có `docs/BUG_TRIAGE.md` với owner trạng thái và release gate                                           |

Definition of Done:

- Không có blocker ở auth, send message, receive message, group, media, notification, call basic.
- Client `npm run lint` và `npm run build` pass.
- Server `npm run check` hoặc `node --check` cho file vừa sửa pass.
- Flow realtime chính test được bằng 2 account và nhiều tab.

---

# Phase 1 - Daily Carryover Loop

Tags: `#P1`, `#retention`, `#core`, `#mobile`

Mục tiêu: làm PingMe trở thành nơi người dùng muốn mở mỗi ngày, kể cả khi không chat ngay. Phase này ưu tiên các tính năng nhỏ nhưng dùng nhiều.

| Stage                   | Status | Priority | Tags                              | Scope                                                       | Output / Gate                                                                                                    |
| ----------------------- | ------ | -------- | --------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1.1 Saved Messages      | DONE   | P1       | `#retention #core #realtime`      | Chat với chính mình để lưu note, link, file, ảnh, voice     | Conversation cá nhân tự tạo, pin trên danh sách, sync tab/device, search/media gallery hoạt động như chat thường |
| 1.2 Draft Sync          | DONE   | P1       | `#retention #realtime #sync`      | Lưu text draft theo conversation, sync giữa tab/device      | Gõ dở ở tab A, mở tab B thấy draft; clear/send xóa draft ở mọi tab                                               |
| 1.3 Scheduled Messages  | DONE   | P1       | `#retention #notification #queue` | Gửi sau theo thời điểm user chọn                            | Job gửi đúng giờ, trạng thái pending/sent/failed rõ                                                              |
| 1.4 Recurring Reminders | DONE   | P1       | `#retention #notification`        | Nhắc định kỳ trong Saved Messages hoặc conversation         | Reminder daily/weekly/monthly, có snooze/dismiss                                                                 |
| 1.5 QR/Profile Sharing  | DONE   | P1       | `#growth #mobile`                 | Share PingMe ID bằng QR/link, mở ra profile hoặc add friend | Người mới join từ link có flow rõ, không bị rơi vào màn hình trống                                               |
| 1.6 Offline Sync Queue  | DONE   | P1       | `#sync #realtime #scale`          | Khi reconnect, fetch missed messages/events/settings        | Không mất unread/read state sau mất mạng                                                                         |

Realtime notes:

- Draft là state có thể fetch, nhưng cần event `draft_updated` để sync tab/device tức thời.
- Scheduled message không nên chỉ dựa vào client timer. Server phải lưu job/pending state.
- Offline sync nên có `lastSeenEventAt` hoặc cursor tương đương để fetch missed events.

Product reason:

- Saved Messages là "túi áo" của app.
- Draft Sync và Scheduled Messages làm PingMe có cảm giác đáng tin hơn demo chat.
- QR/Profile Sharing giảm ma sát mời người dùng mới.

---

# Phase 2 - Conversation Actions And Shared Plans

Tags: `#P1`, `#P2`, `#retention`, `#wow`, `#group`

Mục tiêu: biến message thành hành động. Người dùng không chỉ nói chuyện, mà còn quyết định, phân công, hẹn lịch và lưu kết quả ngay trong chat.

| Stage                          | Status  | Priority | Tags                            | Scope                                                                                                  | Output / Gate                                                           |
| ------------------------------ | ------- | -------- | ------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| 2.1 Poll MVP                   | DONE    | P1       | `#group #realtime #retention`   | Group-only poll message type, single-choice vote changing, deadline optional                           | Vote realtime, refresh vẫn đúng, kết quả có count/percent và voter list |
| 2.2 Event In Chat              | DONE    | P1       | `#retention #notification`      | Tạo lịch hẹn từ conversation, RSVP đơn giản                                                            | Event card, reminder, danh sách người tham gia                          |
| 2.3 Collaborative Checklist    | DONE    | P1       | `#group #realtime #wow`         | Checklist chung, assign member, mark done                                                              | Update realtime, audit nhỏ: ai tick, lúc nào                            |
| 2.4 Message Evolution          | DONE    | P2       | `#wow #core`                    | Convert message thành task, poll, event, checklist item                                                | Object mới giữ link tới message gốc và jump được                        |
| 2.5 Conversation Workspace MVP | DONE    | P2       | `#wow #retention #monetization` | Tab Kế hoạch trong detail panel tổng hợp Poll, Event, Checklist; thao tác trực tiếp và jump về tin gốc | Mỗi conversation có một "home base" không rối                           |
| 2.6 Shared Plans               | PLANNED | P2       | `#wow #group`                   | Plan card cho đi chơi/họp/sự kiện: poll địa điểm, checklist, chi phí, album                            | Một flow tạo kế hoạch trọn vẹn từ chat                                  |
| 2.7 Decision Timeline          | PLANNED | P2       | `#ai #wow`                      | Tự hoặc bán tự động lưu các quyết định đã chốt                                                         | Timeline có link message gốc, người chốt, thời điểm                     |

Realtime notes:

- Poll/checklist là state fetch được, nhưng vote/tick là event phải push.
- Server phải kiểm tra member trong conversation trước khi nhận vote/tick.
- Payload nên có `conversationId`, `messageId` hoặc `itemId`, `version`, `updatedAt`.

Product reason:

- Đây là vùng Telegram/Messenger chưa tối ưu cho nhóm nhỏ đời thường.
- PingMe có thể trở thành nơi "chốt việc" thay vì chỉ "nói chuyện".

---

# Phase 3 - Smart Catch-up And Conversation Intelligence

Tags: `#P2`, `#wow`, `#ai`, `#privacy`, `#search`

Mục tiêu: giải quyết nỗi đau lớn nhất của chat hiện đại: quá nhiều tin, đọc không kịp, quên phản hồi, khó tìm lại thông tin quan trọng.

| Stage                             | Status   | Priority | Tags                         | Scope                                                                       | Output / Gate                                                      |
| --------------------------------- | -------- | -------- | ---------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 3.1 Smart Catch-up MVP            | NEXT     | P2       | `#ai #wow #retention`        | Tóm tắt unread messages trong conversation                                  | Summary có bullet, mention, decisions, questions, jump to original |
| 3.2 Mention And Priority Catch-up | PLANNED  | P2       | `#ai #notification`          | Ưu tiên tin nhắc tới user, reply user, urgent intent                        | Người dùng thấy "việc liên quan đến mình" trước                    |
| 3.3 Conversation Debt             | PLANNED  | P2       | `#ai #wow #retention`        | Detect câu hỏi chưa trả lời, lời hứa chưa hoàn thành, message cần follow-up | Inbox riêng cho "đang nợ phản hồi"                                 |
| 3.4 Intent Message                | PLANNED  | P2       | `#core #realtime #wow`       | Người gửi đánh dấu `urgent`, `needs_reply`, `decision`, `fyi`, `remind_me`  | Filter được message theo intent; notification tôn trọng intent     |
| 3.5 Smart Notification Digest     | PLANNED  | P2       | `#ai #notification #privacy` | Gom thông báo theo batch, chỉ alert ngay khi urgent/mention                 | Ít notification hơn nhưng không bỏ lỡ việc quan trọng              |
| 3.6 Semantic Search               | PLANNED  | P2       | `#ai #search`                | Tìm bằng ý nghĩa: "file báo cáo Minh gửi tháng trước"                       | Kết quả có nguồn, conversation, jump, quyền truy cập được kiểm tra |
| 3.7 Cross-App Personal Inbox      | PLANNED  | P2       | `#retention #growth`         | Share link/file/email vào Saved Messages, tự phân loại                      | User có một nơi gom thông tin cá nhân                              |
| 3.8 Local-first AI Research       | RESEARCH | P4       | `#ai #privacy`               | Đánh giá summary/transcription local hoặc hybrid                            | Quyết định rõ: local, server, hay opt-in cloud AI                  |

Privacy gates:

- AI summary phải opt-in theo user hoặc theo conversation.
- Conversation có privacy agreement cấm AI thì không được đưa vào summary.
- Summary phải lưu nguồn message id để kiểm tra và xóa khi user xóa dữ liệu.
- Không dùng private message để train model nếu không có cơ chế consent rõ.

Product reason:

- Smart Catch-up là tính năng có khả năng tạo "wow moment" nhanh nhất.
- Conversation Debt giải quyết vấn đề rất thật: đọc rồi quên trả lời.
- Semantic Search biến lịch sử chat thành bộ nhớ hữu dụng.

---

# Phase 4 - Voice Intelligence And Call Memory

Tags: `#P2`, `#call`, `#ai`, `#wow`

Mục tiêu: voice và call không chỉ là media, mà trở thành thông tin có thể đọc, tìm, tóm tắt và follow-up.

| Stage                      | Status  | Priority | Tags                      | Scope                                                              | Output / Gate                                                |
| -------------------------- | ------- | -------- | ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| 4.1 Voice Message Trimming | NEXT    | P1       | `#media #mobile`          | Cắt đoạn đầu/cuối trước khi gửi voice                              | UI đơn giản, không làm tăng ma sát gửi voice                 |
| 4.2 Voice Transcription    | PLANNED | P2       | `#ai #search #privacy`    | Convert voice message thành text                                   | Có trạng thái processing/failed, user có thể xóa transcript  |
| 4.3 Voice Summary          | PLANNED | P2       | `#ai #wow`                | Tóm tắt voice dài thành ý chính                                    | Summary có link timestamp                                    |
| 4.4 Timestamp Reply        | PLANNED | P2       | `#media #core`            | Reply vào đoạn cụ thể của voice                                    | Click reply nhảy tới timestamp trong audio                   |
| 4.5 Search Inside Voice    | PLANNED | P2       | `#ai #search`             | Transcript được index theo quyền conversation                      | Search trả voice result đúng timestamp                       |
| 4.6 Call Link              | PLANNED | P2       | `#call #growth #realtime` | Link tham gia call 1-1 hoặc group                                  | Link có expiry, permission, trạng thái invalid rõ            |
| 4.7 Group Voice/Video Call | PLANNED | P2       | `#call #realtime #group`  | Gọi nhóm nhỏ ổn định trước                                         | Join/leave/mute/camera state realtime, không làm vỡ 1-1 call |
| 4.8 Screen Sharing         | PLANNED | P2       | `#call #wow`              | Share screen trong call                                            | Permission UX rõ, fallback khi browser không hỗ trợ          |
| 4.9 Call Memory            | PLANNED | P2       | `#ai #call #privacy #wow` | Sau call tạo card: participants, duration, links, decisions, tasks | Chỉ bật khi participant đồng ý transcribe/record             |

Realtime/WebRTC notes:

- Socket.IO chỉ signaling. Audio/video/screen share đi qua WebRTC.
- Group call có thể cần SFU khi vượt quá nhóm nhỏ. MVP chỉ nên giới hạn rõ số người.
- Call Memory là dữ liệu nhạy cảm, phải có consent UI và trạng thái "not recorded".

Product reason:

- Messenger/WhatsApp có call mạnh, nên PingMe cần ít nhất bắt kịp chất lượng cơ bản.
- Khác biệt của PingMe không phải chỉ "gọi được", mà là sau cuộc gọi người dùng có trí nhớ và next actions.

---

# Phase 5 - Group Focus, Topics And Communities

Tags: `#P2`, `#P3`, `#group`, `#growth`, `#realtime`

Mục tiêu: nhóm không bị hỗn loạn khi đông hơn. Người mới vào hiểu bối cảnh nhanh. Admin có công cụ kiểm soát mà không biến UI thành Slack nặng nề.

| Stage                       | Status   | Priority | Tags                          | Scope                                              | Output / Gate                                             |
| --------------------------- | -------- | -------- | ----------------------------- | -------------------------------------------------- | --------------------------------------------------------- |
| 5.1 Group Topics/Threads    | NEXT     | P2       | `#group #realtime #retention` | Topic tabs trong group, message thuộc topic        | Unread theo topic, jump/search giữ context                |
| 5.2 Invite Links And QR     | PLANNED  | P2       | `#growth #group`              | Link/QR join group public/private                  | Link có expiry, revoke, approval optional                 |
| 5.3 Advanced Permissions    | PLANNED  | P2       | `#group #trust-safety`        | Ai được gửi media/link/pin/invite/mention everyone | Permission matrix dễ hiểu, owner/admin override rõ        |
| 5.4 Group Handover          | PLANNED  | P2       | `#ai #group #wow`             | Khi thêm member mới, tạo summary/history package   | Người mới hiểu nhóm mà không đọc toàn bộ lịch sử          |
| 5.5 Slow Mode And Anti-Spam | PLANNED  | P2       | `#trust-safety #group`        | Rate limit theo group/member                       | Chặn flood nhưng admin có quyền miễn trừ                  |
| 5.6 Admin Audit Log         | PLANNED  | P2       | `#group #trust-safety`        | Log invite, remove, promote, permission change     | Dễ debug tranh chấp trong group                           |
| 5.7 Channel MVP             | PLANNED  | P3       | `#growth #group #realtime`    | Broadcast channel, subscribers, admin post         | Không làm channel trước khi group topics và permission ổn |
| 5.8 Channel Discussion      | PLANNED  | P3       | `#growth #group`              | Link channel post với group discussion             | Comment/discussion có moderation                          |
| 5.9 Stories/Status          | OPTIONAL | P3       | `#growth #mobile`             | Status 24h cho friends/custom audience             | Chỉ làm khi chat/group retention đã tốt                   |

Realtime notes:

- Group topics nên dùng room theo `conversation:<id>` và state topic từ DB, không emit từng user thủ công.
- Unread theo topic phải có read cursor riêng, tránh lẫn với unread toàn group.

Product reason:

- Topics giúp nhóm lớn không rối.
- Group Handover là cơ hội khác biệt tốt hơn screenshot/forward message thủ công.
- Channel/Bot chỉ nên đi sau group vì nếu group chưa ổn, community sẽ khuếch đại lỗi.

---

# Phase 6 - Trust, Privacy And Safety

Tags: `#P2`, `#privacy`, `#trust-safety`, `#growth`

Mục tiêu: người dùng tin PingMe đủ để mời bạn bè, nhóm riêng tư và dùng cho thông tin nhạy cảm. Safety cũng là tính năng growth vì nó giảm nỗi sợ khi nhận tin từ người lạ.

| Stage                         | Status   | Priority | Tags                     | Scope                                                                       | Output / Gate                                                |
| ----------------------------- | -------- | -------- | ------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 6.1 Passkey Login             | NEXT     | P2       | `#privacy #trust-safety` | Đăng nhập bằng passkey/WebAuthn bên cạnh password                           | Account recovery rõ, không lock user khỏi tài khoản          |
| 6.2 Anti-Scam Safety Screen   | PLANNED  | P2       | `#trust-safety #growth`  | Cảnh báo trước khi chat với người lạ/link lạ/group lạ                       | Hiển thị mutuals, report/block nhanh, không gây sợ quá mức   |
| 6.3 Trusted Introduction      | PLANNED  | P2       | `#growth #trust-safety`  | Khi người lạ liên hệ, hiện nguồn giới thiệu/bạn chung/xác thực              | Người nhận có bối cảnh để quyết định accept                  |
| 6.4 Privacy Agreement MVP     | PLANNED  | P2       | `#privacy #wow`          | Per-conversation: forward, save media, auto-delete, AI access, read receipt | Agreement có trạng thái pending/accepted/changed             |
| 6.5 Advanced Chat Privacy     | PLANNED  | P2       | `#privacy`               | Chặn export, auto-download, AI usage nếu agreement yêu cầu                  | Client tôn trọng setting, server enforce phần có thể enforce |
| 6.6 Account Export/Delete     | PLANNED  | P2       | `#privacy #ops`          | Xuất archive, xóa account, xóa media theo policy                            | Người dùng kiểm soát dữ liệu rõ ràng                         |
| 6.7 Moderation Dashboard      | PLANNED  | P2       | `#trust-safety #ops`     | Xem report, xử lý abuse, audit action                                       | Không chỉ lưu report trong DB rồi bỏ đó                      |
| 6.8 E2EE Secret Chat Research | RESEARCH | P4       | `#privacy #security`     | Đánh giá tác động lên search, multi-device, AI, moderation                  | Có design doc trước khi code                                 |
| 6.9 E2EE Secret Chat MVP      | OPTIONAL | P4       | `#privacy #security`     | Chat bí mật client-side encryption                                          | Chỉ làm sau research và threat model                         |

Security notes:

- E2EE không làm sớm vì ảnh hưởng search, backup, multi-device, moderation và AI.
- Privacy Agreement phải nói rõ phần nào server enforce được, phần nào chỉ là client restriction.
- Passkey cần flow recovery, revoke device, và fallback hợp lý.

Product reason:

- Privacy theo conversation là điểm khác biệt sắc hơn setting toàn app.
- Safety screen giúp user yên tâm nhận invite từ bên ngoài.

---

# Phase 7 - Personal Rules And Smart Notifications

Tags: `#P2`, `#retention`, `#notification`, `#ai`

Mục tiêu: giảm notification fatigue nhưng vẫn đảm bảo người dùng không bỏ lỡ việc quan trọng.

| Stage                            | Status  | Priority | Tags                          | Scope                                                             | Output / Gate                                   |
| -------------------------------- | ------- | -------- | ----------------------------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| 7.1 Personal Communication Rules | NEXT    | P2       | `#notification #privacy #wow` | Rule kiểu "sau 22:00 chỉ báo urgent từ family"                    | Rule engine nhỏ, dễ hiểu, có preview tác động   |
| 7.2 Conversation Importance      | PLANNED | P2       | `#notification #ai`           | User pin/mark important, hệ thống gợi ý nhưng user quyết định     | Không tự động quá đà làm user mất kiểm soát     |
| 7.3 Digest Schedule              | PLANNED | P2       | `#notification #retention`    | Daily/weekly recap theo conversation hoặc nhóm                    | Push digest đúng giờ, có link mở Smart Catch-up |
| 7.4 Notification Explainability  | PLANNED | P2       | `#notification #trust-safety` | Mỗi notification quan trọng có lý do: mention, urgent, rule match | User hiểu vì sao bị ping                        |
| 7.5 Quiet Mode Profiles          | PLANNED | P2       | `#notification #mobile`       | Work, sleep, travel, meeting modes                                | Tự động hoặc thủ công, override rõ              |

Product reason:

- Người dùng không cần app chat thêm ồn. Họ cần app biết im lặng đúng lúc và báo đúng thứ.
- Đây là lớp giữ chân lâu dài, nhất là khi group đông lên.

---

# Phase 8 - Platform, Bots And Ecosystem

Tags: `#P3`, `#platform`, `#growth`, `#monetization`

Mục tiêu: mở PingMe thành nền tảng sau khi core chat, group và privacy đã chắc. Không làm phase này quá sớm vì bot/channel sẽ làm tăng độ phức tạp rất nhanh.

| Stage                  | Status   | Priority | Tags                              | Scope                                         | Output / Gate                                                   |
| ---------------------- | -------- | -------- | --------------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| 8.1 Bot Account Type   | PLANNED  | P3       | `#platform`                       | User type `bot`, profile bot, permission bot  | Bot không được đọc conversation nếu chưa được invite/authorized |
| 8.2 Bot Token/API      | PLANNED  | P3       | `#platform #security`             | Token, revoke, rate limit, scoped permissions | API docs tối thiểu, token không log ra server                   |
| 8.3 Slash Commands     | PLANNED  | P3       | `#platform #group`                | `/poll`, `/remind`, `/plan`, custom commands  | Command gợi ý trong input, permission rõ                        |
| 8.4 Webhook Delivery   | PLANNED  | P3       | `#platform #scale`                | Server gọi bot webhook khi có event được phép | Retry/backoff, signature, delivery logs                         |
| 8.5 Inline Buttons     | PLANNED  | P3       | `#platform #realtime`             | Button callbacks trong bot messages           | Callback auth đúng user/conversation                            |
| 8.6 Mini Apps Research | RESEARCH | P4       | `#platform #growth`               | Đánh giá webview mini app trong chat          | Design security sandbox trước                                   |
| 8.7 Bot Marketplace    | OPTIONAL | P4       | `#platform #growth #monetization` | Discover/install bot                          | Chỉ làm khi có bot ecosystem thật                               |

Product reason:

- Telegram đã rất mạnh ở bot. PingMe không nên copy toàn bộ ngay.
- Cách đi tốt hơn: bot phục vụ Conversation Workspace, Shared Plans, Smart Catch-up và personal automation trước.

---

# Phase 9 - Scale, Native Feel And Delivery

Tags: `#P3`, `#scale`, `#mobile`, `#ops`

Mục tiêu: sản phẩm chịu được dữ liệu thật, media thật, nhiều connection thật và có cảm giác gần app native trên điện thoại.

| Stage                           | Status  | Priority | Tags                       | Scope                                                 | Output / Gate                                            |
| ------------------------------- | ------- | -------- | -------------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| 9.1 Redis Adapter For Socket.IO | PLANNED | P3       | `#scale #realtime`         | Multi-server Socket.IO                                | User room/conversation room hoạt động qua nhiều instance |
| 9.2 Redis Presence Store        | PLANNED | P3       | `#scale #presence`         | Online state không chỉ nằm trong memory               | Presence đúng khi deploy nhiều server                    |
| 9.3 Job Queue                   | PLANNED | P3       | `#scale #notification #ai` | Queue upload processing, push, transcription, summary | Job retry, dead letter, observability                    |
| 9.4 CDN/Object Storage          | PLANNED | P3       | `#scale #media`            | Uploads sang object storage/CDN                       | URL bảo mật, cleanup orphan files                        |
| 9.5 Rate Limiting               | PLANNED | P3       | `#trust-safety #scale`     | API/socket abuse protection                           | Limit theo user/IP/action, message rõ khi bị limit       |
| 9.6 PWA Installable             | PLANNED | P3       | `#mobile #growth`          | Manifest, icons, install prompt                       | Dùng tốt trên mobile browser                             |
| 9.7 Mobile Touch Interactions   | PLANNED | P3       | `#mobile #ux`              | Long press, swipe reply, bottom sheets                | Không phá keyboard/accessibility                         |
| 9.8 Mobile Media Capture        | PLANNED | P3       | `#mobile #media`           | Camera/gallery input, compress option                 | Upload ảnh/video thuận tiện trên phone                   |
| 9.9 Observability Dashboard     | PLANNED | P3       | `#ops #scale`              | Health, socket count, job failures, push failures     | Debug production không mù                                |

Product reason:

- Khi thêm AI, media, group, notification, queue và observability không còn là "kỹ thuật phụ".
- Mobile/PWA giúp người dùng thật dùng PingMe thường xuyên hơn.

---

# Phase 10 - Long-Term Differentiators

Tags: `#P4`, `#research`, `#wow`, `#privacy`

Mục tiêu: các hướng lớn có thể tạo moat, nhưng chỉ nên làm khi phase 0-7 đã đủ chín.

| Stage                          | Status   | Priority | Tags                     | Scope                                                      | Output / Gate                           |
| ------------------------------ | -------- | -------- | ------------------------ | ---------------------------------------------------------- | --------------------------------------- |
| 10.1 Local-first AI            | RESEARCH | P4       | `#ai #privacy`           | Summary/search/transcription cục bộ khi có thể             | Prototype và privacy/performance report |
| 10.2 Conversation Portability  | PLANNED  | P4       | `#privacy #wow`          | Export conversation thành archive có media/timeline/search | Dễ đọc, không phụ thuộc PingMe client   |
| 10.3 Availability Handshake    | PLANNED  | P4       | `#call #wow`             | Hai người chọn thời gian rảnh, app gợi ý thời điểm gọi     | Không cần calendar integration ở MVP    |
| 10.4 Personal AI Assistant     | RESEARCH | P4       | `#ai #platform #privacy` | Assistant trả lời trong phạm vi user cho phép              | Permission cực rõ, audit access         |
| 10.5 Paid Workspaces / Premium | RESEARCH | P4       | `#monetization`          | Premium cho AI catch-up, larger storage, workspace tools   | Chỉ bàn khi retention đủ tốt            |

---

## Recommended Next 20 Stages

Danh sách này là hàng đợi hành động gần nhất, đã sắp theo rủi ro và giá trị:

| Order | Stage                               | Priority | Why now                                                           |
| ----- | ----------------------------------- | -------- | ----------------------------------------------------------------- |
| 1     | 0.1 Basic UAT sweep                 | P0       | Không nên xây feature mới trên nền chưa được user acceptance test |
| 2     | 0.2 Long chat UAT                   | P0       | Smart Catch-up/search cần message list dài ổn định                |
| 3     | 0.3 Privacy/search/notification UAT | P0       | Các feature sau phụ thuộc privacy, jump, notification đúng        |
| 4     | 1.1 Saved Messages                  | P1       | Dễ hiểu, tăng daily utility ngay                                  |
| 5     | 1.2 Draft Sync                      | P1       | Hoàn thiện multi-device promise                                   |
| 6     | 1.3 Scheduled Messages              | P1       | Bắt kịp Telegram và tạo thói quen dùng                            |
| 7     | 2.1 Poll MVP                        | P1       | Group hiện đã có nền, poll là next action tự nhiên                |
| 8     | 2.2 Event In Chat                   | P1       | Biến group thành nơi lập kế hoạch                                 |
| 9     | 2.3 Collaborative Checklist         | P1       | Tạo giá trị khác biệt cho nhóm nhỏ                                |
| 10    | 3.1 Smart Catch-up MVP              | P2       | Wow moment mạnh nhất, nhưng cần nền search/jump ổn                |
| 11    | 4.2 Voice Transcription             | P2       | Mở khóa search voice và summary                                   |
| 12    | 3.4 Intent Message                  | P2       | Nền cho Conversation Debt và smart notification                   |
| 13    | 3.3 Conversation Debt               | P2       | Khác biệt hóa rõ so với app chat thông thường                     |
| 14    | 5.1 Group Topics/Threads            | P2       | Cần trước channel/community                                       |
| 15    | 6.1 Passkey Login                   | P2       | Tăng trust và bắt kịp app lớn                                     |
| 16    | 6.2 Anti-Scam Safety Screen         | P2       | Quan trọng khi mở invite/link/group                               |
| 17    | 6.4 Privacy Agreement MVP           | P2       | Tạo định vị riêng cho PingMe                                      |
| 18    | 4.6 Call Link                       | P2       | Mở đường group call/screen share                                  |
| 19    | 5.2 Invite Links And QR             | P2       | Growth loop cho group                                             |
| 20    | 9.3 Job Queue                       | P3       | Cần trước khi AI/transcription/push job tăng tải                  |

---

## Feature Bets By User Value

### Bet 1 - "Tôi quay lại sau 2 giờ và vẫn hiểu chuyện gì xảy ra"

Features:

- Smart Catch-up.
- Mention and priority catch-up.
- Decision Timeline.
- Group Handover.
- Semantic Search.

Primary metric:

- Giảm `time to catch up`.
- Tăng click `jump to original`.
- Tăng D7 retention trong group active.

### Bet 2 - "Tôi không còn quên trả lời"

Features:

- Intent Message.
- Conversation Debt.
- Reminder.
- Smart Notification Digest.
- Personal Communication Rules.

Primary metric:

- Số conversation debt resolved mỗi tuần.
- Giảm số unread cũ quá 24h.
- Tăng reply rate cho message `needs_reply`.

### Bet 3 - "Nhóm của tôi chốt việc trong chat, không cần app phụ"

Features:

- Poll.
- Checklist.
- Event.
- Shared Plans.
- Conversation Workspace.
- Message Evolution.

Primary metric:

- Số plan/checklist/event tạo từ message.
- Số group active sau 7 ngày.
- Số member invited qua group link/QR.

### Bet 4 - "Tôi tin app này với thông tin riêng tư"

Features:

- Passkeys.
- Privacy Agreement.
- Advanced Chat Privacy.
- Account Export/Delete.
- Anti-Scam Safety Screen.
- E2EE research.

Primary metric:

- Số privacy setting được cấu hình.
- Tỉ lệ report/block xử lý.
- Tỉ lệ user hoàn tất passkey setup.

---

## Competitor Catch-up Map

| Market signal                                                                          | PingMe response                                                                   | Priority |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| Telegram có scheduled messages, advanced polls, bots, sticker search, AI bot workflows | Scheduled Messages, Poll MVP, Bot API sau core, sticker/GIF search sau daily loop | P1-P3    |
| WhatsApp có Message Summaries và Advanced Chat Privacy                                 | Smart Catch-up, Privacy Agreement, Advanced Chat Privacy                          | P2       |
| WhatsApp có Group Message History cho người mới vào group                              | Group Handover với summary, recent history và consent rõ                          | P2       |
| Slack có Canvas, Lists, AI recap, workflow                                             | Conversation Workspace, Checklist, Smart Catch-up, Message Evolution              | P2       |
| Messenger tập trung HD calls, noise suppression, voice isolation                       | Call quality pass, Call Link, Group Call, Screen Share, Call Memory               | P2-P3    |

---

## Implementation Guardrails

- Không thêm AI trước khi có permission, privacy gate và delete behavior rõ.
- Không thêm channel trước khi group topics, permissions và moderation ổn.
- Không thêm group call lớn trước khi 1-1 call và call state không còn bug.
- Không thêm bot/platform trước khi rate limit, token security và event permission rõ.
- Không thêm E2EE trước khi có design doc vì nó ảnh hưởng search, AI, moderation và multi-device.
- Mọi feature có realtime phải có event contract trong docs hoặc trong câu trả lời triển khai.

---

## Suggested File Links To Update Later

Khi bắt đầu implement từng nhóm tính năng, nên cập nhật thêm:

- `PIPELINE.md`: status chính của từng stage.
- `TEST_PIPELINE.md`: user acceptance test cho feature mới.
- `docs/DEPLOYMENT.md`: nếu thêm queue, Redis, object storage, TURN/SFU, AI provider.
- `server/socket/socketHandler.js`: event contract server nếu có realtime.
- `client/src/context/SocketContext.jsx` hoặc feature context tương ứng: cleanup listener.
- `client/src/pages/Chat.jsx`: chỉ khi feature thật sự thuộc chat shell.

---

## Reference Links

- Telegram AI bots, chat automation, poll stats, scheduled messages: https://telegram.org/blog/ai-bot-revolution-11-new-features
- Telegram recent feature index 2026: https://telegram.org/blog
- WhatsApp private message summaries: https://blog.whatsapp.com/catch-up-on-conversations-with-private-message-summaries
- WhatsApp advanced chat privacy: https://blog.whatsapp.com/introducing-advanced-chat-privacy
- WhatsApp group message history: https://blog.whatsapp.com/introducing-group-message-history-a-more-private-way-to-catch-up-in-group-chats
- Slack AI summaries/search/workflows: https://slack.com/features/ai
- Slack task lists: https://slack.com/features/task-list
- Messenger HD calls and noise suppression: https://about.fb.com/news/2024/11/introducing-ai-backgrounds-noise-suppression-and-more-messenger-calling/
