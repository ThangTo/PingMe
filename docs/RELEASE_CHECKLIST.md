# PingMe Release Checklist

Cập nhật: 2026-06-10

## 1. Preflight

- [ ] Xem `git status`; không đưa `.env`, uploads, `node_modules` hoặc `dist` vào release.
- [ ] Xác nhận biến môi trường frontend/backend, MongoDB, R2, email, Web Push và TURN/STUN.
- [ ] Ghi lại version/commit đang chạy để có điểm rollback.
- [ ] Backup database hoặc xác nhận snapshot gần nhất.

## 2. Static Verification

- [ ] Chạy `npm run lint` trong `client/`.
- [ ] Chạy `npm run build` trong `client/`.
- [ ] Chạy `npm run check` trong `server/`.
- [ ] Chạy `git diff --check`.

## 3. Runtime Smoke

- [ ] `GET /health` trả `200`, database connected và có request ID.
- [ ] Chạy `npm run smoke` trong `server/` bằng test account.
- [ ] Login, refresh session, logout hoạt động.
- [ ] Hai account gửi/nhận direct message realtime.
- [ ] Ba account gửi group message, typing và reaction.
- [ ] Blocked user bị server từ chối gửi message.

## 4. Product Gates

- [ ] Conversation dài load older không nhảy vị trí và không tràn ngang trên mobile.
- [ ] Search trong chat/global mở và highlight đúng message.
- [ ] Notification click mở đúng target; mark read/all giữ sau reload.
- [ ] Upload ảnh/file, progress, retry, gallery và link preview hoạt động.
- [ ] Privacy online/avatar visibility được account thứ hai nhìn thấy đúng.
- [ ] Session revoke làm token cũ không refresh được.
- [ ] Voice/video call thật hai chiều qua mạng khác nhau; TURN fallback hoạt động.
- [ ] Web Push hoạt động khi tab background và khi app đóng.

## 5. Deploy Và Quan Sát

- [ ] Deploy backend trước nếu contract tương thích ngược, sau đó deploy frontend.
- [ ] Kiểm tra health, login, gửi message và upload trên production.
- [ ] Theo dõi error rate, socket connection, reconnect, push failure và upload failure.
- [ ] Kiểm tra không có spike `401`, `5xx`, duplicate listener hoặc duplicate message.

## 6. Rollback

- [ ] Rollback khi auth/send/receive/upload/call bị blocker hoặc error rate tăng bất thường.
- [ ] Khôi phục version backend/frontend trước đó; không rollback schema bằng tay khi chưa có backup.
- [ ] Ghi issue với thời điểm, commit, request ID, browser/device và bước tái hiện.
