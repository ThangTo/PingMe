# Phase 0 UAT Report

Cập nhật: 2026-06-10

## Kết Luận

Phase 0 đang ở trạng thái `IN_PROGRESS` và không còn blocker đã biết trong các luồng chat cốt lõi. Long-chat UAT đã hoàn tất. Các gate còn lại cần trình duyệt/thiết bị thật: camera và microphone WebRTC, Web Push, avatar hợp lệ trên storage, cùng việc xác nhận hành vi UX khi một session bị thu hồi.

Một lỗi race condition mức major đã được phát hiện và sửa trong `client/src/pages/Chat.jsx`: lịch sử tải chậm từng ghi đè message vừa gửi. Bản sửa đã được kiểm tra lại bằng cách cố ý delay API lịch sử 1,8 giây và gửi message trong lúc request đang chạy.

## Môi Trường

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Database: MongoDB Atlas hiện tại của môi trường phát triển
- Trình duyệt kiểm thử: Chromium desktop `1280x800` và mobile `390x844`
- Tài khoản: các test account trong `TEST_ACCOUNTS.md`
- Không chạy seed vì môi trường đang trỏ tới database từ xa và seed có thể thay đổi quan hệ tài khoản thật

## Kết Quả Theo Stage

| Stage | Kết quả | Bằng chứng chính |
|---|---|---|
| 0.1 Basic UAT sweep | PARTIAL PASS | Auth, direct/group chat, typing, reaction, friend request, block/unblock, media upload, session revoke và call signaling pass |
| 0.2 Long chat UAT | PASS | Hai trang cursor, không trùng ID; Virtuoso render giới hạn; load older giữ vị trí; desktop/mobile không tràn ngang |
| 0.3 Privacy/search/notification | PARTIAL PASS | Search trong chat/global và jump pass; privacy persistence/validation pass; link preview realtime và notification navigation pass |
| 0.4 Release confidence | PASS | Client lint/build, server syntax check, health endpoint và smoke script pass; checklist release đã tạo |
| 0.5 Bug triage | PASS | Bug đã phân loại trong `docs/BUG_TRIAGE.md` |

## Ma Trận UAT

| Khu vực | Kết quả | Ghi chú |
|---|---|---|
| Login và chat shell | PASS | Login desktop/mobile, conversation list và chat view hiển thị đúng |
| Direct realtime | PASS | Gửi/nhận hai account; message tồn tại sau reload |
| Group realtime | PASS | Ba account nhận message; typing và reaction relay đúng thành viên |
| Friend lifecycle | PASS | Send, cancel, reject, accept cập nhật realtime |
| Block enforcement | PASS | UI cập nhật và server từ chối `send_message` từ user bị block |
| Media upload/gallery | PASS | Upload PNG lên R2, gửi attachment realtime, gallery trả đúng metadata |
| Link preview | PASS | `https://example.com` tạo preview `Example Domain` và emit `message_preview_updated` |
| Pagination API | PASS | `limit=40`, page kế tiếp không trùng ID; cursor sai trả `400` |
| Virtualized message list | PASS | Load older tự động, scroll height tăng nhưng vị trí đọc được giữ |
| Search và jump | PASS | Search trong chat `1/1`; global search mở đúng conversation và highlight target |
| Notification center | PASS WITH ISSUE | Click mở đúng message; mark-all-read bền sau reload; còn lệch badge/list count |
| Privacy settings | PARTIAL PASS | Online visibility lưu qua reload và đã khôi phục; validation username/bio/privacy/avatar sai pass |
| Session/device | PASS WITH ISSUE | Revoke other sessions làm refresh token cũ trả `401`; tab cũ chưa tự rời `/chat` ngay |
| Call signaling | PASS | request, ringing, incoming, accept, offer, answer, ICE và end relay đúng |
| Camera/microphone call | MANUAL | Cần hai thiết bị hoặc hai browser profile có media permission |
| Web Push | MANUAL | Cần service worker, quyền notification và kiểm thử khi tab ẩn/đóng |

## Dữ Liệu UAT Đã Tạo

- Tin nhắn text dùng để kiểm tra race, search và link preview
- Một attachment `phase0-logo.png` trên object storage và message tương ứng
- Quan hệ Lan Anh/Bảo Trân đã được đưa về trạng thái không kết bạn, không block sau test
- Privacy online visibility của Lan Anh đã được khôi phục về `friends`
- Một session phụ của Bảo Trân đã bị thu hồi theo đúng bài test

## Release Gate Còn Lại

1. Thực hiện voice/video call thật hai chiều và kiểm tra mute, camera, hang-up, reconnect.
2. Kiểm tra Web Push khi tab background và khi đóng app.
3. Upload avatar hợp lệ, xác nhận avatar visibility bằng account thứ hai, rồi khôi phục avatar.
4. Xác nhận session bị revoke tự logout ở request kế tiếp hoặc bổ sung event/session polling cho UX tức thời.
5. Quyết định và sửa cách hiển thị notification badge khi panel chỉ tải một page.
