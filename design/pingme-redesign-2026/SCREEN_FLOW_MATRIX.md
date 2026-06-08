# PingMe Redesign 2026 - Ma Trận Luồng Màn Hình

Mỗi dòng là một ảnh concept riêng. Trong mỗi ảnh, chế độ sáng và tối nằm cạnh nhau để review trực tiếp.

## Desktop - 16 Ảnh Ngang

| ID | Màn Hình / Trạng Thái | Điểm Vào | Hành Động Và Đích Đến |
|---|---|---|---|
| D01 | Đăng nhập | Mở app khi chưa đăng nhập | Đăng nhập -> D03; Tạo tài khoản -> D02; validation/loading/error hiển thị tại chỗ |
| D02 | Đăng ký | Từ D01 bấm Tạo tài khoản | Đăng ký thành công -> D01 success; quay lại -> D01 |
| D03 | Inbox shell | Đăng nhập thành công | Tìm kiếm/lọc cuộc trò chuyện; chọn chat -> D06; danh bạ -> D04; tạo nhóm -> D05; thông báo -> D11; cài đặt -> D14 |
| D04 | Danh bạ + lời mời kết bạn | Rail Danh bạ | Tìm user, kết nối/hủy/chấp nhận/từ chối; bấm bạn bè -> D06 |
| D05 | Tạo nhóm | Bấm Tạo nhóm từ inbox | Đặt tên + chọn thành viên + tạo -> D07; hủy -> D03 |
| D06 | Chat 1-1 với timeline đầy đủ | Chọn chat 1-1 | Trả lời/sửa/reaction/menu -> D08; đính kèm -> D09; ghim/tìm kiếm -> D10; chi tiết -> D12; gọi -> D15/D16 |
| D07 | Chat nhóm realtime | Chọn nhóm | Hiển thị người gửi, nhiều người đang soạn, read avatar, mention; chi tiết -> D13 |
| D08 | Thao tác tin nhắn | Bấm chuột phải/hover reaction trên tin nhắn | Chi tiết reaction, trả lời, sửa, thu hồi, ghim; bấm ngoài/Escape để đóng |
| D09 | Composer + upload + ghi âm | Bấm đính kèm/micro trong D06/D07 | Preview chữ + media, tiến trình/thử lại, ghi âm; gửi -> D06/D07 |
| D10 | Tin ghim + tìm trong chat + jump | Bấm thanh ghim hoặc tìm kiếm trên header | Chọn kết quả -> cuộn/highlight tin nhắn; context tin ghim -> xác nhận bỏ ghim |
| D11 | Tìm kiếm toàn cục + trung tâm thông báo | Rail Tìm kiếm/Thông báo | Chọn kết quả/thông báo -> mở cuộc trò chuyện và jump/highlight |
| D12 | Chi tiết chat 1-1 + thư viện | Bấm Thêm ở D06 | Gọi/tìm kiếm/tắt thông báo, block/report an toàn, media/audio/file/link, lightbox |
| D13 | Chi tiết nhóm + quản trị thành viên | Bấm Thêm ở D07 | Mở rộng thành viên, thêm, thăng/hạ quyền, xóa thành viên, các tab thư viện |
| D14 | Trung tâm cài đặt | Rail Cài đặt | Hồ sơ/avatar/giao diện/thông báo/quyền riêng tư/phiên đăng nhập/người bị chặn/mật khẩu; lưu/lỗi/thành công |
| D15 | Cuộc gọi đến + chờ + audio call | Bấm Gọi hoặc nhận cuộc gọi | Tắt chuông/từ chối/chấp nhận; điều khiển audio call; kết thúc -> D06 + nhật ký cuộc gọi |
| D16 | Video call | Bấm Video call và chấp nhận | Remote video toàn màn hình, local PiP kéo được, micro/camera/kết thúc, panel thiết bị/chất lượng |

## Mobile - 20 Ảnh

| ID | Màn Hình / Trạng Thái | Điểm Vào | Hành Động Và Đích Đến |
|---|---|---|---|
| M01 | Đăng nhập | Mở app khi chưa đăng nhập | Đăng nhập -> M03; đăng ký -> M02; lỗi/loading hiển thị tại chỗ |
| M02 | Đăng ký | Từ M01 | Đăng ký -> M01 success; quay lại -> M01 |
| M03 | Inbox + bottom navigation | Đăng nhập thành công/quay lại từ chat | Chọn cuộc trò chuyện -> M06/M07; Danh bạ -> M04; thông báo -> M14; cài đặt -> M17 |
| M04 | Danh bạ + lời mời | Bottom navigation Danh bạ | Tìm kiếm, gửi/hủy/chấp nhận/từ chối; chọn bạn bè -> M06 |
| M05 | Sheet tạo nhóm | Bấm tạo nhóm | Đặt tên + chọn thành viên; tạo -> M07 |
| M06 | Chat 1-1 | Chọn cuộc trò chuyện 1-1 | Quay lại -> M03; tìm kiếm/ghim -> M13; nhấn giữ -> M08; chi tiết -> M15; gọi -> M19/M20 |
| M07 | Chat nhóm | Chọn nhóm | Typing avatar, read avatar, mention; chi tiết -> M16 |
| M08 | Sheet thao tác khi nhấn giữ tin nhắn | Nhấn giữ tin nhắn | Reaction, trả lời, sao chép, sửa, thu hồi, ghim; chạm ngoài/hủy để đóng |
| M09 | Trạng thái trả lời + sửa + thu hồi | Thao tác từ M08 | Composer trả lời/sửa; bubble đã thu hồi; gửi/lưu -> M06/M07 |
| M10 | Composer đính kèm | Bấm đính kèm | Nhiều ảnh + chú thích, file preview, tiến trình upload/thử lại; gửi -> M06/M07 |
| M11 | Album + lightbox | Bấm ảnh/overlay +N | Vuốt ảnh, đóng/quay lại; trở về chat đúng vị trí |
| M12 | Tin nhắn thoại | Nhấn micro/bấm voice message | Preview ghi âm, hủy/gửi, phát/tua |
| M13 | Tin ghim + tìm kiếm + jump | Bấm thanh ghim/tìm kiếm | Chọn mục -> đóng sheet, cuộn/highlight |
| M14 | Tìm kiếm toàn cục + thông báo | Header/hành động dưới cùng | Chọn kết quả -> M06/M07 và jump; đánh dấu đã đọc/tất cả |
| M15 | Chi tiết chat 1-1 | Bấm Thêm trong M06 | Gọi/tìm kiếm/tắt thông báo, các tab media, block/report |
| M16 | Chi tiết nhóm + thành viên | Bấm Thêm trong M07 | Mở rộng thành viên, thêm/thăng quyền/xóa, thư viện |
| M17 | Trung tâm cài đặt | Bottom navigation Cài đặt | Mở hồ sơ/giao diện/thông báo/quyền riêng tư/bảo mật |
| M18 | Các trạng thái chi tiết cài đặt | Từ M17 | Upload avatar, chọn quyền riêng tư, thu hồi phiên đăng nhập, người bị chặn/mật khẩu |
| M19 | Cuộc gọi đến + chờ + audio call | Nhận cuộc gọi/bấm Gọi | Chấp nhận/từ chối/tắt chuông; điều khiển audio; kết thúc -> M06 |
| M20 | Video call | Bấm Video call và chấp nhận | Remote video toàn màn hình, PiP kéo được, micro/camera/kết thúc |

## Trạng Thái Bắt Buộc Phải Có

Những trạng thái sau phải xuất hiện trong ít nhất một ảnh:

- Loading, empty, error và phản hồi thành công.
- Chưa đọc, đã tắt thông báo, online/offline và read avatar.
- Nhiều người cùng đang soạn trong nhóm.
- Tin nhắn đã gửi/đã nhận/đã đọc và metadata ẩn/mở.
- Chi tiết người reaction, trả lời, sửa, thu hồi, ghim.
- Chú thích cho nhiều ảnh, tiến trình/thử lại upload, file, voice, link preview.
- Jump tới kết quả tìm kiếm và highlight.
- Thông báo chưa đọc/đã đọc/tất cả.
- Chủ nhóm/admin/thành viên và các thao tác thành viên.
- Tắt thông báo toàn cục/theo từng cuộc trò chuyện.
- Upload avatar, sáng/tối/hệ thống, quyền riêng tư, thu hồi phiên, người bị chặn, mật khẩu.
- Cuộc gọi audio/video ở trạng thái đến/đang đổ chuông/đang chờ/đã kết nối.

## Phân Biệt Tính Năng Tương Lai

Không đưa vào bộ ảnh chính như tính năng đã có:

- Kênh, tin, sticker, GIF, bình chọn, tin nhắn hẹn giờ.
- Cuộc gọi nhóm, phòng thoại nhóm.
- Secret chat mã hóa đầu cuối.
- Đồng bộ bản nháp và hàng đợi offline.

Nếu minh họa để định hướng sau này, phải gắn nhãn rõ `Future concept`.
