# PingMe Redesign 2026 - Implementation Report

## Tổng quan
Báo cáo quá trình Audit và Mapping giữa thiết kế trong DESIGN_BIBLE.md / Hình ảnh UI và cấu trúc component hiện tại của PingMe. Mục tiêu là đảm bảo giữ nguyên 100% logic Realtime, Socket, WebRTC, API, chỉ thay đổi giao diện (UI/UX).

## Bảng Audit Component

| Màn hình / Ảnh | Component đang render | Logic / Handler bắt buộc giữ | Khoảng cách so với thiết kế (Thay đổi cần làm) | Có cần Mock không? |
| --- | --- | --- | --- | --- |
| **01 - Auth/App Shell** | `client/src/pages/Login.jsx`<br/>`Register.jsx`<br/>`components/layout/AuthLayout.jsx` | Context Auth (`login`, `register`), error handling, validation, loading state. | Cần áp dụng style Warm Monochrome, bỏ border/shadow cũ. Font chữ (Inter/Outfit) và spacing cần tuân thủ DESIGN_BIBLE. | Không (đã có API) |
| **02 - Sidebar / Layout** | `App.jsx`<br/>`components/layout/Sidebar.jsx`<br/>`AppRail.jsx`<br/>`Header.jsx` | Socket listeners (`conversation_updated`, `user_status`), Context Socket/Auth, Logout, Navigation (Chat, Contacts, Settings). | UI Rail (Left navigation), Sidebar header (Search box), List hội thoại cần cập nhật padding, avatar stack, màu sắc status tinh tế hơn. | Không |
| **03 - Chat Window** | `components/chat/ChatArea.jsx`<br/>`Header.jsx`<br/>`MessageList.jsx`<br/>`MessageBubble.jsx`<br/>`MessageInput.jsx` | Socket `join_conversation`, `send_message`, `typing`, `read_receipt`. WebRTC Call trigger (`initiateCall`). File upload (FormData, MediaRecorder). Virtuoso scroll logic. | Redesign Header (User info, action buttons). MessageBubble cần style mới (bỏ shadow gắt, dùng màu accent-soft/surface-container). MessageInput cần simplify, dùng warm monochrome icons. | Không |
| **04 - Right Panel** | `components/chat/ChatDetails.jsx`<br/>`NotificationPanel.jsx`<br/>`SettingsPanel.jsx`<br/>`GlobalSearchPanel.jsx` | Fetch user/group info, search history, notification websocket events, account setting updates. | Chuyển style các panel thành các drawer/tab sạch sẽ, font to rõ, border mềm (radius 8-12px), loại bỏ thiết kế rườm rà. | Không |

## Nhận xét
- Logic Realtime và Socket.io của PingMe đã hoàn thiện và phân tách tốt ở các custom hooks và Context (CallContext, SocketContext, Virtuoso ref).
- Việc Redesign sẽ chỉ can thiệp vào các class Tailwind v4 trong render của các component, và hệ thống CSS variables trong `index.css`.
- **Tuyệt đối không sửa đổi** logic connect socket, gọi API hay các hàm xử lý state cốt lõi.
