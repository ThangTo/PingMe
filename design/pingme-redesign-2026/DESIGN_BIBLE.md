# PingMe Redesign 2026 - Cẩm Nang Thiết Kế

## Mục Tiêu

PingMe là ứng dụng chat hằng ngày, không phải landing page hay dashboard SaaS. Giao diện mới phải:

- Nhanh để quét, ít ồn, thân thiện và có cảm giác "luôn sẵn sàng".
- Ưu tiên cuộc trò chuyện, tin nhắn, media và cuộc gọi thay vì trang trí.
- Đầy đủ chế độ sáng và tối với cùng một hệ thống component.
- Hoạt động tốt trên desktop dày thông tin và mobile app-native.
- Có thể implement bằng React/Tailwind hiện tại mà không cần đổi product flow.

## Hướng Nghệ Thuật

Tên nội bộ: **Quiet Signal**.

Một hệ thống trung tính cao cấp, kết hợp:

- Mặt giấy nhẹ và đường kẻ tinh trên chế độ sáng.
- Graphite và màu mực ấm trên chế độ tối.
- Jade dùng cho online, thành công và cuộc gọi.
- Coral đỏ dùng cho chú ý, chưa đọc và trạng thái nguy hiểm.
- Ảnh đại diện và media là màu sắc chính; UI không cần nhiều màu trang trí.

Không dùng:

- Gradient tím/xanh kiểu AI.
- Glassmorphism dày đặc.
- Card lồng card.
- Pill cho mọi thứ.
- Bo góc lớn quá mức.
- Bố cục hero/marketing trong màn hình sản phẩm.

## Design Tokens

### Chế Độ Sáng

- Canvas: `#F4F3EF`
- Surface primary: `#FBFAF7`
- Surface raised: `#FFFFFF`
- Surface selected: `#EEECE6`
- Ink: `#222320`
- Ink muted: `#73756F`
- Hairline: `#DDDCD5`
- Jade: `#2F8A63`
- Jade soft: `#E1F1E8`
- Coral: `#D85E4A`
- Coral soft: `#F8E7E2`
- Focus: `#356F92`

### Chế Độ Tối

- Canvas: `#111311`
- Surface primary: `#171A17`
- Surface raised: `#1D211E`
- Surface selected: `#262B27`
- Ink: `#F2F1EC`
- Ink muted: `#A5AAA3`
- Hairline: `#303630`
- Jade: `#5BC18D`
- Jade soft: `#1E3B2C`
- Coral: `#F07A68`
- Coral soft: `#482923`
- Focus: `#77B4D5`

## Typography

- Font chính: humanist/product sans tinh tế, gần với Geist/SF Pro.
- Nội dung tin nhắn: 15-16px, line-height thoáng.
- Metadata gọn: 11-12px, không nhỏ hơn.
- Tiêu đề màn hình desktop: 20-24px.
- Tiêu đề màn hình mobile: 20-22px.
- Font weight chủ yếu: 400, 500, 600. Chỉ dùng 700 cho badge/cảnh báo ngắn.
- Không dùng letter-spacing âm. Chữ in hoa chỉ dùng cho section label rất ngắn.

## Hình Khối Và Chất Liệu

- Bo góc control: 8px.
- Bo góc message bubble: 12px, có một góc nhỏ để tạo hướng nói chuyện.
- Bo góc modal/sheet: 16px desktop, 20px mobile.
- Avatar và call control: hình tròn.
- Border 1px là cách phân tầng chính.
- Shadow chỉ dùng cho menu, modal, floating composer và call control.
- Background có grain rất nhẹ, không có orb/blob.

## Desktop Shell

- App rail rộng 76px khi thu gọn, 184px khi mở rộng.
- Cột cuộc trò chuyện rộng 344-380px.
- Chat là vùng co giãn chính.
- Detail panel rộng 360-400px, đóng mặc định khi chọn cuộc trò chuyện.
- Header cao 64px, input zone cao 72-96px tùy preview.
- Vùng tin nhắn rộng tối đa 760-820px, căn giữa trong chat.
- Context menu nằm cạnh bubble, z-index cao hơn tin nhắn và reaction picker.

## Mobile Shell

- Phong cách trung tính cao cấp, phù hợp đa nền tảng; device frame gọn và nhất quán trong bộ ảnh.
- Khi chưa mở chat: inbox toàn màn hình cùng bottom navigation.
- Khi mở chat: chat toàn màn hình, ẩn bottom navigation.
- Chi tiết, thông báo, tìm kiếm và cài đặt là các màn hình trong navigation stack.
- Tác vụ phụ dùng bottom sheet: thao tác tin nhắn, chi tiết reaction và thao tác thành viên.
- Tôn trọng safe area và bàn phím.

## Quy Tắc Component

### Điều Hướng

- Dùng icon + label cho rail/bottom navigation.
- Mục đang active dùng selected surface cùng một thanh/accent nhỏ, không dùng block màu lớn.
- Badge chưa đọc dùng coral nhỏ gọn.

### Conversation Row

- Có avatar, online dot, tên, preview, thời gian, trạng thái chưa đọc/tắt thông báo/đã đọc.
- Dòng đang chọn có surface khác và indicator mảnh.
- Avatar nhóm dùng nhận diện xếp lớp hoặc monogram riêng.

### Tin Nhắn

- Tin nhắn người khác: raised surface + border.
- Tin của mình: selected/tinted surface, không dùng màu brand đậm.
- Chỉ tin nhắn cuối cùng hiển thị metadata; tin nhắn cũ chỉ hiện khi bấm/chạm.
- Read avatar rơi dưới tin nhắn cuối đã đọc.
- Icon ghim nhỏ nằm trên chính tin nhắn được ghim.
- Reply preview là strip nhỏ bên trong bubble.
- Trạng thái thu hồi vẫn giữ vị trí và dễ đọc.

### Nội Dung Phong Phú

- Album 1-4 ảnh theo grid; ảnh thứ 5 trở lên có overlay đếm và mở được lightbox.
- Album nhiều ảnh trên mobile dùng preview xếp chồng/xòe để gợi ý còn nhiều ảnh.
- File card có icon loại file rõ ràng, tên không bị cắt vô lý.
- Voice message có play, waveform/progress và thời lượng.
- Link preview render sau, giữ nội dung tin nhắn và không làm layout nhảy mạnh.

### Menu Và Sheet

- Desktop: popover nằm cạnh đối tượng.
- Mobile: bottom sheet có reaction strip, danh sách thao tác và destructive action tách riêng.
- Bấm/chạm bên ngoài và nhấn Escape sẽ đóng menu.

### Cài Đặt

- Desktop dùng navigation cài đặt bên trái + detail pane, tránh một trang dài chứa nhiều card nối tiếp.
- Mobile dùng grouped list; mỗi nhóm mở sang màn hình chi tiết.
- Upload avatar có trạng thái preview/crop, loading, validation và thành công.

### Cuộc Gọi

- Incoming call cho biết rõ ai đang gọi, loại cuộc gọi và hành động.
- Audio call có avatar, timer, phím tắt chat và controls.
- Video call dùng remote video toàn màn hình; local PiP có affordance kéo.
- Chi tiết chất lượng/thiết bị cuộc gọi nằm trong secondary panel, không chiếm nội dung chính.

## Tương Tác Và Chuyển Động

- Motion 150-240ms, ease-out.
- Tin nhắn mới: fade + translate 4px, không scale mạnh.
- Typing dots animate độc lập; avatar không re-render/giật theo từng ký tự.
- Sheet trượt lên và popover fade/slide nhẹ.
- Jump tới tin nhắn: scroll vào giữa + highlight trong 1,4 giây.
- Cập nhật realtime không reload toàn bộ cuộc trò chuyện.

## Khả Năng Tiếp Cận

- Tap target tối thiểu 44x44px.
- Focus ring rõ khi điều hướng bằng bàn phím.
- Độ tương phản chữ đạt WCAG AA.
- Trạng thái không chỉ dựa vào màu: luôn có icon/label/badge.
- Menu, sheet và modal có hành động đóng/quay lại rõ ràng.

## Quy Tắc Duyệt Thiết Kế

Mỗi ảnh concept phải:

1. Thể hiện một màn hình/trạng thái tập trung.
2. Có biến thể sáng và tối của cùng màn hình.
3. Cho thấy hành động chính và hành động tiếp theo.
4. Không minh họa tính năng chưa có mà không gắn nhãn `Future`.
5. Có thể đối chiếu trực tiếp với `SCREEN_FLOW_MATRIX.md`.
