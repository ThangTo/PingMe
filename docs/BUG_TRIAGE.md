# Phase 0 Bug Triage

Cập nhật: 2026-06-10

## Quy Ước

- `P0 Blocker`: không thể release hoặc mất dữ liệu/quyền truy cập nghiêm trọng.
- `P1 Major`: flow chính sai, khó dùng hoặc có nguy cơ mất trạng thái.
- `P2 Minor`: flow vẫn dùng được nhưng UX/quan sát sai hoặc gây nhiễu.
- `P3 Polish`: cải thiện chất lượng, không chặn release.

## Danh Sách

| ID | Mức | Trạng thái | Vấn đề | Hướng xử lý / Gate |
|---|---|---|---|---|
| P0-UAT-001 | P1 Major | FIXED, VERIFIED | Initial history fetch có thể ghi đè optimistic/realtime message vừa gửi | Merge message được tạo sau thời điểm fetch; bỏ state update của effect cũ; regression test bằng delayed route |
| P0-UAT-002 | P2 Minor | OPEN | Badge notification trên rail có thể lớn hơn tổng số item panel đang hiển thị do panel chỉ tải một page | Hiển thị `unreadCount` riêng với `loadedCount`, hoặc thêm pagination/infinite load và copy rõ ràng |
| P0-UAT-003 | P2 Minor | OPEN | Login page ghi nhiều lỗi `401` vào console khi auth probe chạy lúc chưa đăng nhập | Auth bootstrap nên coi `401` là trạng thái guest bình thường và tránh log lỗi/network retry dư |
| P0-UAT-004 | P2 Minor | OPEN | Session bị revoke không tự rời `/chat` ngay; refresh token cũ đã trả `401` | Chốt UX: logout ở protected request kế tiếp, polling session, hoặc event revoke theo user room |

## Manual Release Gates

| Gate | Trạng thái | Điều kiện pass |
|---|---|---|
| WebRTC media thật | PENDING | Audio/video hai chiều, mute/camera/end/reconnect pass trên hai thiết bị và mạng khác nhau |
| Web Push | PENDING | Notification tới khi tab background và app đóng; click mở đúng message |
| Avatar và visibility | PENDING | Upload ảnh hợp lệ, account thứ hai thấy/không thấy theo privacy, restore thành công |
| Notification count | PENDING DECISION | Product thống nhất badge là unread toàn bộ hay số item đã tải |

Hiện chưa có `P0 Blocker` mở. Không bắt đầu feature realtime lớn của Phase 1 trước khi các manual release gate trên được xác nhận hoặc được chấp nhận rủi ro rõ ràng.
