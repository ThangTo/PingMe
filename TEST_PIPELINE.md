# PingMe Test Pipeline

Cập nhật: 2026-06-11

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
- Upload một file ảnh avatar hợp lệ.
- Kiểm tra avatar cập nhật trong settings.
- Quay lại chat, kiểm tra avatar user hiện đúng ở rail hoặc nơi hiển thị tài khoản.
- Sửa bio dưới 160 ký tự.
- Lưu profile, reload app và kiểm tra bio vẫn còn.

### Validation Profile

- Nhập tên dưới 3 ký tự, kiểm tra server/client báo lỗi.
- Nhập bio hơn 160 ký tự, kiểm tra không lưu được.
- Chọn file không phải ảnh hoặc ảnh quá 5MB, kiểm tra báo lỗi.

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

## Stage 17 - Advanced A8.1 Message Pagination

### API Cursor

- Mở một conversation có nhiều hơn 40 tin nhắn.
- Gọi `GET /api/messages/conversation/:conversationId?limit=40`, kiểm tra response có `pagination.hasMoreBefore` và `pagination.nextBefore`.
- Gọi tiếp `GET /api/messages/conversation/:conversationId?limit=40&before=<nextBefore>`, kiểm tra tin cũ hơn được trả về, không trùng page đầu.
- Gọi với `before` sai, kiểm tra API trả 400 hoặc 404 thay vì crash server.

### UI Load Older

- Mở conversation dài trên desktop.
- Ban đầu app chỉ tải page mới nhất, vẫn tự scroll xuống cuối.
- Kéo lên gần đầu danh sách, app tự tải thêm tin cũ.
- Không còn nút load thủ công; kéo lên gần đầu là cách duy nhất để auto-load tin cũ.
- Sau khi auto-load, app prepend tin cũ và giữ nguyên vị trí đang đọc, không nhảy xuống cuối.
- Gửi tin mới trong lúc đang ở cuối chat, message realtime vẫn append và hiển thị như cũ.
- Jump tới pinned/search result cũ, app vẫn tải window quanh message và highlight đúng message.

### Mobile

- Mở cùng conversation dài trên mobile.
- Kéo lên đầu, kiểm tra load thêm tin cũ không làm input/header bị lệch.
- Gửi message mới, kiểm tra realtime append và read/avatar marker vẫn đúng.

## Stage 18 - Advanced A8.2 Virtualized Message List

Ghi chú: Stage này dùng `react-virtuoso` để chỉ render các message đang nằm gần viewport. Pagination vẫn giữ nguyên: mở chat lấy page mới nhất, kéo lên đầu để auto-load page cũ.

### Desktop Long Conversation

- Mở conversation có nhiều hơn 80 tin nhắn đã load.
- Kiểm tra không còn chip/nút `Tải tin cũ hơn`; chỉ có pill `Đang tải...` khi request older đang chạy.
- Kéo lên/xuống nhanh, message không bị trắng vùng giữa, không nhảy layout mạnh.
- Kéo lên gần đầu để auto load older, vị trí đang đọc được giữ lại.
- Gửi tin mới khi đang ở cuối chat, app vẫn append và scroll xuống cuối.

### Jump And Metadata

- Ghim một tin cũ hoặc dùng search/global notification để jump tới tin đã load nhưng đang ngoài viewport.
- App phải scroll tới đúng message và highlight.
- Tin nhắn cuối vẫn hiện thời gian/trạng thái mặc định.
- Tin nhắn cũ vẫn ẩn metadata, click trái vào bubble mới hiện metadata.

### Browser Performance Sanity

- Mở DevTools console và chạy:

```js
document.querySelectorAll('[data-message-row="true"]').length
```

- Với conversation dài, số row đang render nên thấp hơn tổng tin đã load rõ rệt.
- Resize cửa sổ desktop và thử mobile viewport, list vẫn không mất message hoặc lệch input.

## Stage 19 - Advanced A1.3 Multi-Device Read Sync

Mục tiêu: cùng một account đăng nhập nhiều tab/thiết bị phải đồng bộ trạng thái đã đọc mà không cần reload.

### Chuẩn Bị

- Mở account A trên 2 session khác nhau: ví dụ Chrome thường và Brave, hoặc Chrome thường và Chrome incognito.
- Mở account B trên một trình duyệt/session khác.
- A và B phải có conversation 1-1.

### Direct Chat Read Sync

- Ở cả 2 session của A, để sidebar nhìn thấy conversation với B.
- B gửi 2-3 tin mới cho A.
- Kiểm tra cả 2 session của A đều tăng unread badge cho conversation đó.
- Ở session A1, mở conversation với B và đọc tới cuối.
- Session A2 phải tự cập nhật unread count về 0 mà không reload.
- Nếu A2 đang mở cùng conversation, các message từ B đang load phải chuyển sang trạng thái đã đọc local.
- Ở session B, read avatar/read status phải cập nhật khi A đọc.

### Read Cursor Không Phụ Thuộc Message Đang Load

- Tạo conversation có nhiều tin nhắn hơn page đang load.
- A1 mở conversation ở cuối và đọc tới tin mới nhất.
- A2 không cần load cùng page message nhưng sidebar vẫn phải mất unread.
- Reload A2, unread count vẫn đúng theo DB, không bị hiện lại các tin cũ là chưa đọc.

### Group Read Sync

- Dùng group có ít nhất A, B, C.
- B gửi vài tin trong group.
- A đăng nhập 2 session, mở group ở A1.
- A2 phải tự cập nhật unread group về 0 hoặc số còn lại đúng theo cursor server trả.
- B/C thấy read avatar của A rơi đúng message cuối A đã đọc.

### Regression

- Tin mới realtime vẫn append bình thường.
- Typing indicator không bị ảnh hưởng.
- Read avatar 1:1 và group không bị nhân đôi.
- Refresh cả 2 session A, unread count/read cursor vẫn đúng.

## Stage 20 - Advanced A4.2 Privacy Settings And Avatar Upload

### Avatar Upload

- Vào `Cài đặt`.
- Ở `Profile cơ bản`, bấm `Tải ảnh lên` và chọn file ảnh hợp lệ dưới 5MB.
- Kiểm tra avatar preview đổi ngay sau khi upload thành công.
- Reload app, kiểm tra avatar vẫn còn.
- Quay lại chat, kiểm tra avatar user hiện đúng ở rail hoặc nơi hiển thị tài khoản.
- Chọn file không phải ảnh hoặc ảnh quá 5MB, kiểm tra báo lỗi và avatar cũ không bị đổi.

### Online Visibility

- Dùng account A và B đã là bạn bè.
- A đặt `Ai thấy trạng thái online` = `Bạn bè`, B phải thấy A online khi A đang mở app.
- A đặt `Ai thấy trạng thái online` = `Không ai`, B phải thấy A offline sau khi lưu hoặc sau khi A reconnect.
- A đặt lại `Mọi người` hoặc `Bạn bè`, B phải thấy online trở lại khi A đang online.

### Avatar Visibility

- A đặt `Ai thấy avatar` = `Mọi người`, B phải thấy avatar A trong search/conversation header/sidebar.
- A đặt `Ai thấy avatar` = `Bạn bè`, bạn bè vẫn thấy avatar; account không phải bạn bè thấy avatar mặc định hoặc trống.
- A đặt `Ai thấy avatar` = `Không ai`, B phải thấy avatar mặc định hoặc trống sau khi reload/fetch lại conversation.

### Regression

- Gửi tin nhắn realtime 1:1 và group vẫn append bình thường.
- Call incoming vẫn hiện đúng tên người gọi.
- Presence socket không emit duplicate khiến online badge nhấp nháy bất thường.

## Stage 21 - Advanced A6.6 Saved Messages

### Entry And Idempotency

- Đăng nhập account A, mở app và kiểm tra sidebar có `Tin nhắn đã lưu` ở đầu danh sách.
- Reload app nhiều lần, kiểm tra không tạo nhiều hơn một conversation Saved cho cùng user.
- Nếu Saved chưa có tin, preview phải là `Lưu note, link, file tại đây`, không hiện tick/time giả.
- Header và detail panel phải hiện đây là `Kho lưu cá nhân`, không có presence, gọi thoại, gọi video, báo cáo hoặc chặn.

### Message, Media And Search

- Trong `Tin nhắn đã lưu`, gửi text, link, ảnh/file và voice message nếu recorder khả dụng.
- Tin vừa gửi phải hiện như tin của chính mình, sidebar preview/time/tick cập nhật sau khi gửi thành công.
- Mở detail panel, kiểm tra media/files/audio/links lấy được item từ Saved như conversation thường.
- Dùng global search tìm nội dung hoặc tên file trong Saved, click kết quả và kiểm tra app nhảy đúng message.

### Multi-Device Realtime

- Đăng nhập account A ở hai tab hoặc hai trình duyệt A1/A2.
- A1 gửi tin trong Saved, A2 phải nhận realtime mà không tăng unread badge và không tạo notification message mới.
- A2 edit/revoke/reaction/pin nếu UI hỗ trợ, A1 phải sync đúng qua socket user room.
- Refresh A1/A2, nội dung Saved vẫn còn và conversation vẫn đứng đầu danh sách.

### Regression

- Direct chat 1:1 vẫn gửi/nhận realtime bình thường, unread và notification không đổi behavior.
- Group chat vẫn gửi/nhận, member management và read receipts không bị ảnh hưởng.
- Chạy `npm run check` trong `server/`, `npm run lint` và `npm run build` trong `client/`, sau đó chạy smoke test khi server local đang mở.

## Stage 22 - Advanced A1.4 Draft Sync

### Text Draft Persistence

- Đăng nhập account A, mở một direct conversation và gõ text nhưng không gửi.
- Chuyển sang conversation khác rồi quay lại, textarea phải khôi phục đúng draft.
- Reload app, mở lại conversation, draft vẫn còn.
- Xóa toàn bộ text trong textarea, chuyển conversation/reload lại, draft không được quay lại.

### Multi-Device Realtime

- Đăng nhập account A ở hai tab hoặc hai trình duyệt A1/A2.
- A1 mở conversation X và gõ draft, A2 mở cùng conversation X phải thấy draft sync sau debounce ngắn.
- A2 sửa draft, A1 phải cập nhật theo nội dung mới nếu A1 không đang gõ local.
- A1 gửi message trong conversation X, A2 phải clear draft và sidebar không còn `Nháp:`.

### Scope Guard

- Chọn file/ảnh hoặc record voice không cần sync preview sang tab khác.
- Reply context không cần sync; draft chỉ lưu text đang gõ.
- Edit message không được ghi đè draft cũ; hủy edit phải quay lại draft nếu có.

### Regression

- Typing indicator vẫn hiện/dừng như cũ trong direct và group.
- Saved Messages vẫn đứng đầu sidebar và draft preview không đổi thứ tự conversation.
- Chạy `npm run check` trong `server/`, `npm run lint` và `npm run build` trong `client/`, sau đó chạy `npm run smoke` khi server local đang mở.

## Stage 23 - Advanced A6.5 Scheduled Messages

### Create, List And Cancel

- Đăng nhập account A, mở direct conversation, nhập text và bấm icon hẹn giờ.
- Chọn thời điểm hợp lệ từ `now + 1 minute` đến `now + 365 days`, submit phải clear input, clear draft và hiện pending strip phía trên input.
- Mở lại conversation hoặc reload app, pending scheduled message vẫn còn.
- Bấm hủy trên pending strip, item phải biến mất và reload lại không quay lại.
- Thử schedule content rỗng, trên 5000 ký tự, thời gian quá khứ hoặc quá 365 ngày; API/UI phải báo lỗi và không tạo pending item.

### Worker Delivery

- Schedule một tin trong direct chat tới thời điểm gần nhất hợp lệ, chờ worker gửi.
- Trước thời điểm gửi, recipient không thấy nội dung pending.
- Khi đến giờ, scheduled item của sender biến mất, message thật append qua `receive_message`, sidebar preview/time cập nhật như gửi thường.
- Lặp lại trong group và `Tin nhắn đã lưu`.
- Nếu sender bị remove khỏi group hoặc direct chat bị block trước giờ gửi, item chuyển failed và không tạo message thật.

### Multi-Device Realtime

- Đăng nhập account A ở hai tab A1/A2.
- A1 tạo scheduled message, A2 phải thấy pending strip sync.
- A2 hủy scheduled message, A1 phải remove pending item.
- A1/A2 cùng mở conversation khi worker gửi, cả hai tab nhận message thật nhưng không duplicate.

### Regression

- Gửi text thường, media/file/audio, sticker, reply và edit message vẫn hoạt động.
- Draft Sync vẫn clear khi schedule thành công và không bị edit mode ghi đè.
- Typing indicator vẫn hoạt động khi gõ text nhưng không bị pending scheduled message ảnh hưởng.
- Chạy `npm run check` trong `server/`, `npm run lint` và `npm run build` trong `client/`, sau đó chạy `npm run smoke` khi server local đang mở.

## Stage 24 - Advanced A6.4 Poll MVP

### Create Poll

- Đăng nhập account A, mở một group conversation và bấm icon bình chọn trong composer.
- Tạo poll với câu hỏi hợp lệ, 2-10 lựa chọn, không trùng option; message optimistic phải xuất hiện trong list và sidebar preview là `Bình chọn: {question}`.
- Reload app, poll vẫn là message thật trong lịch sử chat, có câu hỏi, option và count đúng.
- Thử tạo poll trong direct chat hoặc `Tin nhắn đã lưu`; UI không hiện nút poll và server vẫn phải reject nếu client cũ emit event.

### Validation

- Thử câu hỏi rỗng, trên 160 ký tự, ít hơn 2 option, hơn 10 option, option rỗng, option trùng, option trên 80 ký tự.
- Thử deadline quá khứ, nhỏ hơn `now + 1 minute`, hoặc quá `now + 365 days`; modal/server phải báo lỗi và không tạo message.

### Realtime Vote

- Mở cùng group bằng account A và B.
- A tạo poll, B phải thấy poll qua realtime mà không cần reload.
- B vote một option, A phải thấy count/percent và selected voter list cập nhật ngay.
- B đổi sang option khác, option cũ giảm count và option mới tăng count; click lại cùng option không unvote.
- Bấm voter count, danh sách voter phải hiện tên/avatar của current user và group members.
- Đặt poll hết hạn hoặc dùng poll đã expired; vote mới phải bị disable ở client và server reject nếu emit thủ công.

### Search, Reply And Actions

- Tìm trong conversation bằng câu hỏi poll và text option, kết quả phải highlight/jump đúng poll message.
- Reply vào poll phải hiển thị preview `Bình chọn: ...`.
- Poll message không được vào edit mode; reply, reaction, pin/unpin và revoke vẫn hoạt động.

### Regression

- Gửi text thường, media/file/audio, sticker, reply, edit text message vẫn hoạt động.
- Draft Sync không bị mất khi mở/đóng poll modal; gửi text vẫn clear draft như cũ.
- Scheduled Messages pending strip, create/cancel/sent realtime vẫn hoạt động.
- Group membership update không làm poll rendering hoặc voter list crash.
- Chạy `npm run check` trong `server/`, `npm run lint` và `npm run build` trong `client/`, sau đó chạy `npm run smoke` khi server local đang mở.
