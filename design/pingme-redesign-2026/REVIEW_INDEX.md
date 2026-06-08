# PingMe Redesign 2026 - Danh Sách Duyệt

Mở [GALLERY.md](./GALLERY.md) để xem liên tục toàn bộ 36 ảnh. Luồng chi tiết và đích đến của mỗi nút nằm trong [SCREEN_FLOW_MATRIX.md](./SCREEN_FLOW_MATRIX.md).

Chỉ đánh dấu `[x]` sau khi màn hình đã được implement, render trên browser ở cả desktop/mobile liên quan, kiểm tra light/dark và đối chiếu trực tiếp với ảnh nguồn.

## Trạng Thái Kiểm Chứng

- Auth D01-D02/M01-M02: đã render và đối chiếu ở `1440x900`, `390x844`, light và dark.
- App shell D03-D05/D11/D14 và M03-M05/M14/M17: đã render bằng Playwright, đối chiếu light/dark ở desktop và light ở mobile.
- Chat/call đã verify thêm bằng Playwright screenshots: D06/D08/D12/D15/D16 và M06/M08/M15/M19/M20.
- Batch còn lại đã verify bằng Playwright screenshots trong `%TEMP%/pingme-redesign-remaining`: D07/D09/D10/D13 và M07/M10/M12/M13/M16/M18.
- Group admin menu/add-member đã implement cho owner/admin trong `ChatDetailsPanel`; ảnh verify chính dùng state member của `Test gr`, role test tạm đã restore về member sau khi chạy.
- Static checks gần nhất: `npm run lint` và `npm run build` đều pass.
- Google auth trong D01/D02 hiện là preview bị vô hiệu hóa vì backend chưa có OAuth Google.

## Desktop

- [x] D01 Đăng nhập
- [x] D02 Đăng ký
- [x] D03 Inbox shell
- [x] D04 Danh bạ + lời mời
- [x] D05 Tạo nhóm
- [x] D06 Chat 1-1 với timeline đầy đủ
- [x] D07 Chat nhóm realtime
- [x] D08 Thao tác tin nhắn
- [x] D09 Composer + upload + ghi âm
- [x] D10 Tin ghim + tìm kiếm + jump
- [x] D11 Tìm kiếm toàn cục + thông báo
- [x] D12 Chi tiết chat 1-1 + thư viện
- [x] D13 Chi tiết nhóm + quản trị thành viên
- [x] D14 Trung tâm cài đặt
- [x] D15 Cuộc gọi đến/chờ/audio
- [x] D16 Video call

## Mobile

- [x] M01 Đăng nhập
- [x] M02 Đăng ký
- [x] M03 Inbox
- [x] M04 Danh bạ + lời mời
- [x] M05 Tạo nhóm
- [x] M06 Chat 1-1
- [x] M07 Chat nhóm
- [x] M08 Sheet thao tác tin nhắn
- [x] M09 Trả lời/sửa/thu hồi
- [x] M10 Composer đính kèm
- [x] M11 Album + lightbox
- [x] M12 Tin nhắn thoại
- [x] M13 Tin ghim + tìm kiếm + jump
- [x] M14 Tìm kiếm toàn cục + thông báo
- [x] M15 Chi tiết chat 1-1
- [x] M16 Chi tiết nhóm + thành viên
- [x] M17 Trung tâm cài đặt
- [x] M18 Các trạng thái chi tiết cài đặt
- [x] M19 Cuộc gọi đến/chờ/audio
- [x] M20 Video call

## Câu Hỏi Khi Duyệt

1. PingMe có cảm giác riêng và dễ nhận ra hay vẫn giống ứng dụng chat chung chung?
2. Desktop có đủ nhanh để dùng hằng ngày mà không bị nặng kiểu dashboard/card-heavy?
3. Mobile có cảm giác app-native, dễ bấm và không giống website thu nhỏ?
4. Message bubble, media, voice, reaction và read avatar có dễ hiểu?
5. Chế độ sáng/tối có cùng một hệ thống hay giống hai ứng dụng khác nhau?
6. Giao diện cuộc gọi có thể hiện rõ người đang gọi, trạng thái và hành động?
7. Cài đặt có dễ tìm hơn trang dài hiện tại?
