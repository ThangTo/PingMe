# PingMe Deployment Plan

## Kiến Trúc Khuyến Nghị

- Client: static hosting hỗ trợ SPA fallback.
- Server: Node.js host hỗ trợ WebSocket và tiến trình chạy lâu dài.
- Database: MongoDB Atlas hoặc MongoDB được backup định kỳ.
- Upload: production dùng object storage/CDN; local `server/uploads` chỉ phù hợp development.
- Call: cấu hình TURN có TLS (`turns:`) để WebRTC hoạt động qua NAT/firewall khó.

## Biến Môi Trường

Sao chép `server/.env.example` và `client/.env.example` thành file `.env` tương ứng rồi điền giá trị thật. Không commit `.env`.

Tạo VAPID key cho Web Push:

```bash
cd server
npm run push:vapid
```

TURN không phải secret tự sinh bởi PingMe. Chỉ có STUN thì call qua NAT đối xứng hoặc mạng 4G dễ rớt vì không có relay fallback. Cần dùng dịch vụ TURN hoặc tự triển khai coturn, sau đó điền vào `RTC_ICE_SERVERS_JSON` trong `server/.env` (không commit):

```bash
RTC_ICE_SERVERS_JSON={"iceServers":[{"urls":"stun:stun.l.google.com:19302"},{"urls":["turn:turn.example.com:3478","turn:turn.example.com:3478?transport=tcp","turns:turn.example.com:5349"],"username":"USER","credential":"PASS"}]}
```

Server validate từng entry: entry thiếu `urls` bị bỏ qua, JSON sai cú pháp thì fallback về STUN mặc định (`EnvRtcConfigProvider.js`). Client lấy config qua `GET /api/calls/ice-config`.

Gợi ý provider cho UAT:

- **Metered/Twilio TURN**: dịch vụ có free tier hoặc trial, lấy sẵn credential. Nhanh nhất để test.
- **coturn tự dựng**: kiểm soát hoàn toàn, cần một VPS có IP public; ưu tiên bật `turns:` (TLS) cho mạng chặn UDP.

## Trình Tự Deploy

1. Tạo MongoDB và cấu hình `MONGODB_URI`.
2. Deploy server, cấu hình `CLIENT_URL`, JWT secrets và VAPID keys.
3. Xác nhận `GET /health` trả `status`, `database` và `socketConnections`.
4. Deploy client với `VITE_API_URL` trỏ tới `/api` của server.
5. Kiểm tra CORS, cookie HTTPS, WebSocket upgrade và Service Worker.
6. Kiểm tra gọi WebRTC giữa hai mạng khác nhau để xác nhận TURN.

## File Storage

Production không nên lưu upload trên filesystem tạm của server. Hướng nâng cấp:

1. Upload trực tiếp lên object storage bằng signed URL.
2. Lưu metadata và URL bền vững trong `Message`.
3. Dùng CDN cho ảnh/audio/file.
4. Thêm giới hạn dung lượng, quét loại file và lifecycle cleanup.
