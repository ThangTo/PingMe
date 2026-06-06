# PingMe Test Pipeline

Cập nhật: 2026-06-06

Mục tiêu: test các flow cơ bản sau mỗi mốc implement để biết app đang ổn trước khi chuyển sang feature realtime tiếp theo.

## Cách Dùng

- Dùng ít nhất 2 account khi test chat, friend request, receipt hoặc realtime.
- Test desktop trước, sau đó test mobile viewport.
- Nếu gặp lỗi, ghi lại: bước test, account đang dùng, kết quả mong đợi, kết quả thực tế, console/network error nếu có.
- Chỉ commit/push feature sau khi các mục chính trong stage đó pass.

## Stage 1 - Smoke Test Sau Khi Pull Code

### Client

- Chạy `npm run lint` trong `client/`.
- Chạy `npm run build` trong `client/`.
- Mở app ở Vite dev server.
- Login vào `/chat`.
- Reload app và kiểm tra vẫn giữ session nếu cookie còn hợp lệ.

### Server

- Chạy `npm run check` trong `server/`.
- Chạy server dev.
- Mở `GET /health` và kiểm tra response OK.
- Kiểm tra `.env`, `uploads`, `node_modules`, `dist` không xuất hiện trong `git status`.

## Stage 2 - Profile Và Settings

### Profile Cơ Bản

- Vào `Cài đặt`.
- Sửa tên hiển thị thành tên hợp lệ từ 3 đến 30 ký tự.
- Lưu profile và kiểm tra thông báo thành công.
- Reload app và kiểm tra tên mới vẫn còn.
- Sửa avatar URL bằng một URL hợp lệ.
- Lưu profile và kiểm tra avatar cập nhật trong settings.
- Quay lại chat, kiểm tra avatar user hiện đúng ở rail hoặc nơi hiển thị tài khoản.
- Sửa bio dưới 160 ký tự.
- Lưu profile, reload app và kiểm tra bio vẫn còn.

### Validation Profile

- Nhập tên dưới 3 ký tự, kiểm tra server/client báo lỗi.
- Nhập bio hơn 160 ký tự, kiểm tra không lưu được.
- Nhập avatar không phải URL `http/https`, kiểm tra báo lỗi.

### Đổi Mật Khẩu

- Với tài khoản local, nhập đúng mật khẩu hiện tại và mật khẩu mới ít nhất 6 ký tự.
- Lưu và kiểm tra thông báo thành công.
- Logout, login lại bằng mật khẩu mới.
- Thử đổi mật khẩu với mật khẩu hiện tại sai, kiểm tra báo lỗi.
- Nếu tài khoản không phải local, kiểm tra API/UI báo không hỗ trợ đổi mật khẩu local.

### Theme

- Vào `Cài đặt > Giao diện`.
- Chọn `Sáng`, reload app và kiểm tra theme giữ nguyên.
- Chọn `Tối`, reload app và kiểm tra theme giữ nguyên.
- Chọn `Hệ thống`, đổi system theme nếu có thể và kiểm tra app phản hồi đúng.

## Stage 3 - Friend Request

Dùng 2 account: A và B.

### Gửi Lời Mời

- A vào tìm bạn, tìm B theo tên hoặc email.
- A gửi lời mời cho B.
- Kiểm tra button chuyển sang trạng thái đã gửi hoặc có thể hủy lời mời.
- A thử gửi lại lời mời trùng, kiểm tra không tạo duplicate.

### Hủy Lời Mời Đã Gửi

- A hủy lời mời đã gửi cho B.
- A tìm lại B, kiểm tra trạng thái quay về có thể kết nối.
- B vào lời mời, kiểm tra lời mời từ A không còn.

### Từ Chối Lời Mời

- A gửi lại lời mời cho B.
- B vào `Lời mời`.
- B bấm `Từ chối`.
- Kiểm tra lời mời biến khỏi danh sách.
- A tìm B lại, kiểm tra có thể gửi lời mời mới.

### Chấp Nhận Lời Mời

- A gửi lời mời cho B thêm lần nữa.
- B bấm `Chấp nhận`.
- Kiểm tra A và B xuất hiện trong danh sách chat/friends của nhau.
- Kiểm tra không bị duplicate friend nếu accept nhiều lần hoặc reload.

## Stage 4 - Conversation List Và Mobile Shell

### Desktop

- Mở desktop viewport rộng.
- Kiểm tra layout gồm rail trái, inbox, chat area, detail panel.
- Chọn conversation, kiểm tra inbox vẫn ở trái và chat mở ở giữa.
- Bấm nút more ở chat header để đóng/mở detail panel.
- Bấm `Esc`, kiểm tra detail panel đóng.

### Mobile

- Mở mobile viewport.
- Chưa chọn chat: chỉ thấy danh sách cuộc trò chuyện.
- Chọn chat: danh sách ẩn, chat full screen.
- Bấm back trong chat header, quay lại danh sách.
- Kiểm tra input không bị che, button đủ dễ bấm.

### Empty / Loading / Error State

- Khi chưa có bạn bè, kiểm tra empty state dễ hiểu.
- Khi đang tải danh sách, kiểm tra skeleton không vỡ layout.
- Nếu server tắt, kiểm tra UI báo lỗi thay vì trắng màn hình.

## Stage 5 - Message UI Và Reaction

### Message Bubble

- Gửi text ngắn, text dài nhiều dòng, text có ký tự tiếng Việt.
- Kiểm tra own message nằm bên phải, received message nằm bên trái.
- Kiểm tra timestamp và trạng thái gửi/đã nhận/đã đọc không đè lên text.
- Reload app, kiểm tra history render đúng.

### Reaction Desktop

- Hover vào message, chỉ thấy nút reaction nhỏ.
- Click nút reaction, kiểm tra emoji picker mở.
- Chọn emoji, kiểm tra reaction chip hiện dưới message.
- Click ra ngoài, picker đóng.
- Chuột phải vào message, kiểm tra context menu mở.
- Bấm `Sao chép`, kiểm tra copy nội dung text.
- Bấm `Esc`, kiểm tra menu đóng.

### Reaction Mobile

- Nhấn giữ message, kiểm tra overlay/action sheet mở.
- Chọn emoji, kiểm tra reaction được thêm.
- Bấm `Hủy`, kiểm tra action sheet đóng.
- Tap ngoài vùng sheet, kiểm tra sheet đóng.

Lưu ý: `Chỉnh sửa`, `Xóa`, `Chuyển tiếp`, `Trả lời` hiện là UI shell nếu chưa tới stage tương ứng.

## Stage 6 - Upload Ảnh Và File

### Preview

- Chọn một ảnh hợp lệ.
- Kiểm tra preview hiện đúng thumbnail.
- Bấm close preview, kiểm tra preview biến mất.
- Chọn file hợp lệ như PDF, XLSX, ZIP hoặc TXT.
- Kiểm tra preview hiện tên file và trạng thái sẵn sàng gửi.

### Progress Và Retry

- Gửi ảnh/file.
- Kiểm tra progress bar chạy khi upload.
- Upload thành công thì message được gửi vào chat.
- Nếu upload lỗi, kiểm tra thông báo lỗi và nút `Thử lại`.
- Bấm `Thử lại`, kiểm tra upload chạy lại với file cũ.

### Validation Upload

- Thử file quá lớn, kiểm tra báo giới hạn kích thước.
- Thử định dạng không hỗ trợ, kiểm tra báo lỗi rõ ràng.
- Sau khi lỗi, chọn file hợp lệ khác và gửi được bình thường.

## Stage 7 - Media, File, Link Detail Panel

### Media

- Gửi ít nhất 3 ảnh trong cùng conversation.
- Mở detail panel bên phải.
- Kiểm tra tab `Media` hiển thị grid ảnh.
- Click ảnh, kiểm tra lightbox mở.
- Click nền hoặc nút close, kiểm tra lightbox đóng.

### File

- Gửi một file.
- Kiểm tra section `Tệp` hiển thị tên file, size, ngày.
- Click file, kiểm tra download/open hoạt động.

### Link

- Gửi message có URL `https://...`.
- Kiểm tra section `Liên kết` hiển thị domain và URL.
- Click link, kiểm tra mở tab mới.

### Search Trong Detail Panel

- Nhập từ khóa trùng tên file, kiểm tra file được lọc.
- Nhập từ khóa trùng URL/domain, kiểm tra link được lọc.
- Nhập từ khóa không tồn tại, kiểm tra empty state.

## Stage 8 - Search Và Keyboard

### Inbox Search

- Bấm `Ctrl+K` hoặc `Cmd+K`.
- Kiểm tra focus nhảy vào ô search ở inbox.
- Tìm conversation theo tên.
- Xóa keyword, danh sách trở về đầy đủ.

### Search Trong Chat

- Mở một conversation.
- Bấm icon search trong chat header.
- Nhập từ khóa có trong message.
- Kiểm tra message list lọc ra message phù hợp.
- Nhập từ khóa không có, kiểm tra empty state.
- Bấm close search, kiểm tra danh sách message trở lại bình thường.

### Keyboard Cơ Bản

- Nhập text trong input và bấm Enter, kiểm tra gửi message.
- Nhập text nhiều dòng nếu app hỗ trợ Shift+Enter; nếu chưa hỗ trợ, ghi lại là enhancement.
- Bấm `Esc`, kiểm tra detail panel hoặc menu đang mở được đóng.

## Stage 8.5 - Group Chat MVP

Dùng ít nhất 3 account: A, B, C. A đã kết bạn với B và C.

### Tạo Nhóm

- A mở sidebar và bấm nút `Tạo nhóm`.
- A nhập tên nhóm hợp lệ từ 2 đến 80 ký tự.
- A chọn B và C trong danh sách thành viên.
- A bấm `Tạo nhóm`.
- Kiểm tra group mới xuất hiện trong sidebar của A và được mở ngay.
- B/C đang online kiểm tra group mới xuất hiện realtime hoặc sau khi nhận message đầu tiên.
- Reload A/B/C, kiểm tra group vẫn còn trong sidebar.

### Gửi/Nhận Tin Nhắn Nhóm

- A gửi text vào group.
- B và C phải nhận message realtime mà không reload.
- B gửi message trả lời.
- A và C phải nhận message realtime.
- Kiểm tra bubble bên trái trong group có tên người gửi.
- Reload group, kiểm tra history vẫn có đủ message.

### Typing Nhóm

- A mở group, B bắt đầu gõ.
- A thấy typing indicator trong group.
- B ngừng gõ hoặc gửi message, indicator biến mất.
- C mở group và test tương tự để chắc event đi qua room.

### Media Và Reaction Trong Group

- A gửi 1 ảnh kèm text vào group.
- B/C nhận đúng ảnh và text.
- B reaction vào message của A.
- A/C thấy reaction realtime.
- Mở detail panel trong group, kiểm tra media/file/link được lấy từ group history.

### Regression Direct Chat

- A quay lại chat 1-1 với B.
- Gửi text, ảnh, reaction, read receipt như cũ.
- Kiểm tra direct chat không bị ảnh hưởng bởi room group.

## Stage 9 - CI Và Git Hygiene

- Chạy `git status --short`.
- Kiểm tra không có `.env`, `server/uploads`, `node_modules`, `dist`.
- Chạy `npm run lint` trong `client/`.
- Chạy `npm run build` trong `client/`.
- Chạy `npm run check` trong `server/`.
- Kiểm tra `.github/workflows/ci.yml` tồn tại.
- Sau khi push, kiểm tra GitHub Actions chạy client/server checks.

## Stage 10 - Regression Nhanh Trước Khi Làm Realtime Tiếp

- Login bằng 2 account.
- A gửi message text cho B.
- B nhận message.
- A thấy trạng thái gửi/nhận/đọc như kỳ vọng.
- B reaction vào message của A.
- A thấy reaction cập nhật.
- Reload cả 2 tab, kiểm tra conversation summary, unread count, media/file vẫn đúng.

## Những Phần Chưa Test Ở File Này

Các mục dưới đây thuộc realtime/WebRTC hoặc stage riêng, sẽ có checklist riêng khi bắt đầu:

- Edit/delete message realtime.
- Reply/thread và jump to original.
- Pin message realtime.
- Notification push/service worker.
- Voice/video call signaling và WebRTC.
- Multi-device session revoke.
## Stage 16 - Basic Completion: Session, Social, Search, Notification

### Session Và Thiết Bị

- Login cùng một account trên Brave thường và cửa sổ ẩn danh hoặc Chrome.
- Mở `Cài đặt > Thiết bị đăng nhập`, kiểm tra thấy các phiên và đánh dấu đúng phiên hiện tại.
- Thu hồi một phiên khác, kiểm tra tab tương ứng bị mất socket và không refresh token được nữa.
- Bấm `Thu hồi phiên khác`, kiểm tra chỉ phiên hiện tại còn hoạt động.
- Thu hồi phiên hiện tại, kiểm tra app đăng xuất.

### Realtime Friend Và Block/Report

- A gửi lời mời cho B khi B đang mở app, badge/lời mời của B phải xuất hiện không reload.
- A hủy lời mời, lời mời phải biến mất realtime ở B.
- B accept/reject, trạng thái ở A phải cập nhật không reload.
- A mở chi tiết chat 1-1 với B, báo cáo B và kiểm tra UI báo thành công.
- A chặn B, conversation 1-1 phải đóng; B không thể gửi message, typing hoặc gọi A.
- A vào `Cài đặt > Người đã chặn`, bỏ chặn B; hai người có thể gửi lời mời kết bạn lại.

### Global Search Và Jump

- Gửi một message có keyword hiếm và một file có tên dễ nhận biết.
- Mở `Tìm kiếm` từ rail desktop và nút search mobile.
- Search keyword text và tên file, kiểm tra đúng conversation/sender.
- Click kết quả cũ không nằm trong 50 message mới nhất, app phải mở đúng conversation, tải window quanh message và highlight.

### Notification Center Và Mention

- A nhắn B khi B đang online; bell badge của B tăng realtime.
- B mở notification center, click notification message và kiểm tra jump đúng message.
- B bấm `Đánh dấu đã đọc`, badge về 0 và giữ nguyên sau reload.
- Trong group, A gửi `@Tên người dùng` đúng username của B.
- B phải nhận notification loại mention; các thành viên khác nhận notification message thường.
- Tạo cuộc gọi nhỡ, người nhận kiểm tra có notification cuộc gọi nhỡ.

### Operations

- Chạy `npm run check` trong `server/`.
- Chạy `npm run lint` và `npm run build` trong `client/`.
- Với server đang chạy và seed account đã có, chạy:

```powershell
$env:SMOKE_USER_EMAIL='lan.anh.test@pingme.local'
$env:SMOKE_USER_PASSWORD='123456'
npm run smoke
```

- Mở `GET /health`, kiểm tra có `status`, `database`, `uptimeSeconds`, `socketConnections`.
- Kiểm tra `.env.example` không chứa secret thật và `.env` không xuất hiện trong git status.
