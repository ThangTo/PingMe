# Email OTP Queue Và Brevo

OTP email không được gửi trực tiếp trong HTTP request. API lưu OTP, đẩy job đã mã hóa vào
MongoDB queue và trả response ngay; email worker sẽ gửi email, retry và bỏ qua OTP cũ/hết hạn.

Worker claim job atomically, retry theo exponential backoff và chỉ gửi nếu OTP vẫn còn hiệu lực.
Payload queue được mã hóa AES-256-GCM trước khi lưu vào MongoDB.

## Email Provider

Chọn provider bằng `EMAIL_DRIVER`:

- `brevo`: khuyến nghị cho production.
- `smtp`: giữ lại để dùng Gmail SMTP hoặc SMTP provider khác.
- `console`: chỉ dùng development/test, OTP được in ra terminal.

### Cấu Hình Brevo

1. Trong Brevo, mở phần Senders và tạo/xác minh sender email hoặc domain gửi email.
2. Vào `Settings -> SMTP & API -> API Keys & MCP`, tạo API key cho transactional email.
3. Cấu hình các biến:

```env
EMAIL_DRIVER=brevo
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=no-reply@your-domain.com
BREVO_SENDER_NAME=PingMe
BREVO_TIMEOUT_MS=8000
BREVO_SANDBOX=false
```

`BREVO_SENDER_EMAIL` phải là sender đã được xác minh trong Brevo. Đặt `BREVO_SANDBOX=true`
để Brevo xác thực request nhưng không gửi email thật.

### SMTP Dự Phòng

Đổi `EMAIL_DRIVER=smtp` và giữ các biến `SMTP_*`. Code SMTP vẫn tồn tại độc lập với Brevo.

## Development

Mặc định worker chạy cùng process web trong development, nhưng email vẫn không nằm trong request lifecycle:

```bash
EMAIL_QUEUE_WORKER_ENABLED=true
npm run dev
```

## Production Railway

Tạo hai Railway service cùng trỏ tới GitHub repo PingMe.

### 1. Backend Web Service

- Tên gợi ý: `pingme-api`
- Root Directory: `/server`
- Start Command: `npm start`
- Networking: Generate Domain hoặc giữ custom domain API hiện tại.
- Healthcheck Path: `/health`
- Biến riêng:

```env
NODE_ENV=production
EMAIL_QUEUE_WORKER_ENABLED=false
CLIENT_URL=https://pingme.enso.io.vn
```

Web service chỉ tạo OTP và enqueue job. Nó không gửi email.

### 2. Email Worker Service

- Tên gợi ý: `pingme-email-worker`
- Source: cùng GitHub repo với backend.
- Root Directory: `/server`
- Start Command: `npm run worker:email`
- Không cần Generate Domain và không cần Healthcheck HTTP.
- Biến riêng:

```env
NODE_ENV=production
EMAIL_DRIVER=brevo
EMAIL_QUEUE_POLL_MS=1000
EMAIL_QUEUE_LOCK_MS=60000
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=no-reply@your-domain.com
BREVO_SENDER_NAME=PingMe
BREVO_TIMEOUT_MS=8000
BREVO_SANDBOX=false
```

### 3. Shared Variables Cho Cả Hai Service

Trong Railway vào `Project Settings -> Shared Variables`, tạo các biến sau và share cho
`pingme-api` cùng `pingme-email-worker`:

```env
MONGODB_URI=...
QUEUE_DRIVER=mongodb
QUEUE_ENCRYPTION_KEY=<chuỗi bí mật dài, ngẫu nhiên>
EMAIL_QUEUE_MAX_ATTEMPTS=5
```

Chỉ email worker cần `BREVO_API_KEY`; không share key này cho web service nếu không cần.

Không thay đổi `QUEUE_ENCRYPTION_KEY` khi queue vẫn còn job đang chờ, vì worker sẽ không giải mã
được payload cũ.

### 4. Kiểm Tra Sau Deploy

1. Log `pingme-api` phải có `Server running` và không có `EmailQueue Worker started`.
2. Log `pingme-email-worker` phải có `EmailQueue Worker started`.
3. Xin OTP trên UI; API phải phản hồi gần như ngay lập tức.
4. Log worker phải xử lý job, email xuất hiện trong Brevo Transactional Logs và hộp thư người nhận.
