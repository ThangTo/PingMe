# Kế Hoạch Triển Khai PingMe Mobile App

## Mục Tiêu

PingMe nên đi theo 2 bước:

1. Làm PWA mobile trước để người dùng có thể cài từ trình duyệt và test nhanh trên thiết bị thật.
2. Dùng Capacitor để đóng gói native app sau đó, tận dụng lại React UI hiện có.

Hướng này hợp lý hơn React Native ở giai đoạn hiện tại vì PingMe đã có web mobile, Socket.IO, WebRTC, Web Push, OAuth và upload media hoạt động trên React.

## Stage 1 - PWA Mobile

Trạng thái: `READY_TO_TEST`.

Đã có:

- `client/public/manifest.webmanifest`
- Bộ icon PWA trong `client/public/icons/`
- Favicon/tab icon bo góc: `client/public/logo.png`
- Mobile/iOS meta tags trong `client/index.html`
- Service worker được đăng ký từ `client/src/main.jsx`
- `client/public/pingme-sw.js` hỗ trợ:
  - Web Push notification hiện có
  - App shell cache
  - Runtime cache cho static assets/icons/images
  - Navigation fallback về `index.html` khi offline

Cần test:

- Mở production URL trên Chrome Android, kiểm tra menu `Add to Home screen` hoặc install prompt.
- Mở app từ icon ngoài home screen, kiểm tra app chạy dạng standalone, không còn thanh địa chỉ trình duyệt.
- Refresh trực tiếp `/chat`, `/login`, `/register` không bị 404.
- Tắt mạng sau khi đã mở app ít nhất 1 lần, app shell vẫn hiện được.
- Đăng nhập, Socket.IO, WebRTC, upload và notification vẫn cần backend online.
- iPhone Safari: `Share > Add to Home Screen`, mở lại từ icon, kiểm tra status bar và icon.

## Stage 2 - Capacitor Wrapper

Mục tiêu: đóng gói PingMe thành Android/iOS app với codebase React hiện có.

Việc cần làm:

- Cài Capacitor trong `client/`.
- Cấu hình app id:
  - Android: `com.pingme.app`
  - iOS: `com.pingme.app`
- Build web ra `client/dist`.
- Sync dist vào native shells.
- Cấu hình splash screen, app icon, status bar.
- Mở Android Studio/Xcode để chạy trên thiết bị thật.

Lệnh dự kiến:

```bash
cd client
npm install @capacitor/core @capacitor/cli
npx cap init PingMe com.pingme.app --web-dir dist
npm run build
npx cap add android
npx cap add ios
npx cap sync
```

## Stage 3 - Native Permissions

Cần map các quyền đang dùng trên web sang native:

- Camera: video call.
- Microphone: voice/audio/video call.
- Notifications: native push.
- Photo/File picker: gửi ảnh, video, file.

Android cần khai báo trong `AndroidManifest.xml`.

iOS cần khai báo trong `Info.plist`:

- `NSCameraUsageDescription`
- `NSMicrophoneUsageDescription`
- `NSPhotoLibraryUsageDescription`

## Stage 4 - Auth Và Deep Links

Google OAuth hiện tại dùng server-side callback. Native app cần deep link để quay về app sau khi login.

Cần làm:

- Thêm custom scheme: `pingme://auth/callback`
- Thêm universal/app links nếu có domain chính thức.
- Server OAuth callback có thể redirect về:
  - Web: `https://.../chat`
  - Native: `pingme://auth/callback`
- Client native nhận deep link, gọi `/users/me` để nạp session.

Lưu ý: cookie/session trong native WebView có thể khác browser, nên cần test kỹ Google OAuth trên Android/iOS.

## Stage 5 - Push Notification Native

Web Push không phải là native push store-ready.

Hướng native:

- Android: Firebase Cloud Messaging.
- iOS: APNs, có thể đi qua Firebase.
- Server thêm provider push native theo OCP/DIP giống integration boundary hiện có.
- DB lưu thêm native device token theo user/session/device.
- Khi có message/call notification:
  - Web client dùng Web Push subscription hiện có.
  - Native app dùng FCM/APNs token.

## Stage 6 - WebRTC Native Validation

WebRTC trong Capacitor WebView có thể chạy, nhưng cần test thật:

- Audio call Android <-> Web.
- Video call Android <-> Web.
- Audio/video iOS <-> Web.
- Background/lock screen behavior.
- Permission denied/retry flow.
- TURN server khi khác mạng.

Nếu WebView WebRTC không ổn định, lúc đó mới cân nhắc native WebRTC plugin hoặc React Native.

## Stage 7 - Release Pipeline

Android:

- Tạo keystore release.
- Cấu hình signing.
- Build AAB.
- Internal testing trên Google Play Console.

iOS:

- Apple Developer account.
- Bundle id + provisioning profile.
- Build archive bằng Xcode.
- TestFlight.

CI/CD sau cùng:

- GitHub Actions build web.
- Capacitor sync.
- Android build AAB.
- iOS build archive trên macOS runner nếu cần.

## Thứ Tự Nên Làm Tiếp

1. Test PWA trên mobile production trước.
2. Khi PWA ổn, tạo branch riêng `mobile/capacitor`.
3. Setup Android trước vì nhanh hơn iOS.
4. Test các flow bắt buộc: login, chat realtime, media upload R2, call audio/video.
5. Sau Android ổn mới làm iOS/TestFlight.
