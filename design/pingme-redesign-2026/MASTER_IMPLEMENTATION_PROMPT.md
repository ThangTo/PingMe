# Master Prompt Triển Khai Toàn Bộ UI PingMe Redesign 2026

---

Bạn đang làm việc trong repository `D:\Project\PingMe`.

## Mục Tiêu Chính

Hãy triển khai toàn bộ giao diện PingMe theo bộ thiết kế trong:

`design/pingme-redesign-2026/`

Đây là một đợt **redesign giao diện toàn ứng dụng**, không phải viết lại sản phẩm. Phải giữ nguyên các luồng nghiệp vụ, REST API, Socket.IO, WebRTC, state management và hành vi đang hoạt động. Chỉ thay đổi cấu trúc trình bày, component UI, layout, responsive behavior, CSS, animation và visual state cần thiết để giao diện bám sát ảnh thiết kế.

Bạn được yêu cầu tự đọc codebase, lập kế hoạch, triển khai đầy đủ, chạy kiểm tra và báo cáo kết quả. Không dừng lại ở phân tích hoặc chỉ dựng một vài màn hình mẫu.

## Skills Bắt Buộc Phải Sử Dụng

Các Agent Skills thuộc bộ `Leonxlnx/taste-skill` đã được cài global và bật sẵn. Hãy chủ động load, đọc và áp dụng các skill sau trước khi triển khai:

1. `image-to-code`
   - Skill chính để phân tích ảnh và chuyển thiết kế thành code.
   - Bộ ảnh thiết kế đã được duyệt và có sẵn trong `design/pingme-redesign-2026/images/`.
   - Bỏ qua bước tạo ảnh mới của skill này. Không thay thế hoặc tự thiết kế lại ảnh đã có.
   - Xem các ảnh hiện có là nguồn sự thật visual chính, phân tích kỹ rồi implement và so sánh screenshot.

2. `redesign-existing-projects`
   - Audit giao diện và nâng cấp component hiện tại mà không phá chức năng.

3. `design-taste-frontend`
   - Giữ chất lượng thiết kế cao, tránh giao diện generic hoặc templated.

4. `high-end-visual-design`
   - Áp dụng typography, spacing, border, shadow và motion có chủ đích.

5. `full-output-enforcement`
   - Không bỏ dở phase, không dùng placeholder kiểu "implement later", không chỉ dựng một phần màn hình.

Không dùng `gpt-taste`, `industrial-brutalist-ui` hoặc các skill phong cách khác để thay đổi art direction đã duyệt. Không dùng `imagegen-frontend-web`, `imagegen-frontend-mobile` hoặc `brandkit` để tạo thiết kế mới, trừ khi user yêu cầu rõ ràng.

Nếu giao diện và chỉ dẫn trong một skill xung đột với ảnh PingMe đã duyệt, ưu tiên ảnh PingMe và `DESIGN_BIBLE.md`.

## Thứ Tự Đọc Bắt Buộc Trước Khi Sửa Code

Đọc các file sau theo đúng thứ tự:

1. `AGENTS.md`
   - Quy tắc làm việc trong repo.
   - Không được tự ý phá hoặc viết lại logic realtime, Socket.IO và WebRTC.

2. `CLAUDE.md`
   - Tổng quan kiến trúc và ghi chú dự án.

3. `PIPELINE.md`
   - Nguồn trạng thái tính năng chính xác nhất.
   - Xác định tính năng nào đã có thật và tính năng nào chưa có.

4. `TEST_PIPELINE.md`
   - Hiểu các user flow đang cần giữ nguyên.

5. Tài liệu yêu cầu liên quan:
   - `.claude/specs/ROADMAP.md`
   - `.claude/specs/media-file-sharing/requirements.md`
   - `.claude/specs/voice-video-calls/requirements.md`

6. Toàn bộ tài liệu redesign:
   - `design/pingme-redesign-2026/DESIGN_BIBLE.md`
   - `design/pingme-redesign-2026/SCREEN_FLOW_MATRIX.md`
   - `design/pingme-redesign-2026/REVIEW_INDEX.md`
   - `design/pingme-redesign-2026/GALLERY.md`

7. Xem trực tiếp toàn bộ 36 ảnh thiết kế tại:
   - Desktop: `design/pingme-redesign-2026/images/D01.png` đến `D16.png`
   - Mobile: `design/pingme-redesign-2026/images/M01.png` đến `M20.png`

8. Đọc code frontend hiện tại trước khi sửa:
   - `client/src/App.jsx`
   - `client/src/index.css`
   - `client/src/pages/Login.jsx`
   - `client/src/pages/Register.jsx`
   - `client/src/pages/Chat.jsx`
   - Toàn bộ `client/src/components/`
   - Toàn bộ `client/src/context/`
   - `client/src/socket.js`

9. Chỉ đọc phần server để hiểu contract, không thay đổi nếu không thật sự bắt buộc:
   - `server/socket/socketHandler.js`
   - Các REST route/controller/model được frontend hiện tại sử dụng.

## Nguồn Sự Thật Và Cách Xử Lý Xung Đột

Áp dụng thứ tự ưu tiên sau:

### Đối với giao diện

1. Ảnh thiết kế tương ứng trong `design/pingme-redesign-2026/images/`
2. `DESIGN_BIBLE.md`
3. `SCREEN_FLOW_MATRIX.md`
4. Giao diện hiện tại

### Đối với hành vi và dữ liệu

1. Code đang hoạt động và API/socket contract hiện tại
2. `PIPELINE.md`
3. `TEST_PIPELINE.md`
4. `SCREEN_FLOW_MATRIX.md`
5. Ảnh concept

Nếu ảnh concept và logic hiện tại khác nhau, phải giữ logic thật và điều chỉnh cách trình bày để giống ảnh nhất có thể. Không được đổi contract chỉ để khớp ảnh.

## Quy Tắc Không Được Vi Phạm

- Không thay đổi tên Socket.IO event, payload, phòng socket, listener hoặc cleanup listener.
- Không thay đổi signaling/WebRTC/call state machine.
- Không thay đổi REST endpoint, response shape, request shape hoặc DB schema.
- Không thay đổi logic auth, session, notification, contacts, conversation, message, read receipt, typing, reaction, pin, search, upload hoặc call.
- Không xóa handler, callback, prop hoặc state hiện có chỉ vì giao diện mới chưa dùng rõ ràng.
- Không thay dữ liệu thật bằng dữ liệu mock.
- Không làm mất chức năng đang hoạt động.
- Không tạo nút giả trông như có chức năng nhưng bấm không có phản hồi.
- Không revert thay đổi chưa commit của user.
- Không commit `.env`, uploads, `node_modules`, `dist`.
- Không đổi JavaScript/JSX sang TypeScript.
- Không tạo `tailwind.config.js`; dự án dùng Tailwind v4 CSS-first.
- Không dùng icon font hoặc Material Symbols. Dùng `lucide-react` hiện có.
- Không tự vẽ SVG nếu Lucide đã có icon tương ứng.
- Không thêm gradient, glow, glassmorphism dày, orb/blob hoặc card lồng card.
- Không làm layout chỉ đẹp ở một kích thước màn hình.

## Quy Tắc Đối Với Phần Chưa Có Logic Thật

Nếu ảnh thiết kế có một visual state cần thiết để khớp thiết kế nhưng codebase chưa có dữ liệu hoặc logic hỗ trợ:

1. Trước tiên kiểm tra kỹ `PIPELINE.md`, codebase và API để chắc chắn tính năng thực sự chưa tồn tại.
2. Không viết server, API, Socket.IO hoặc DB mới chỉ để phục vụ mock.
3. Được phép tạo **UI mock cô lập**, nhưng phải:
   - Không thay thế dữ liệu thật.
   - Không ảnh hưởng luồng thật.
   - Có tên rõ ràng như `mockPreview`, `demoState` hoặc `visualPlaceholder`.
   - Có comment ngắn bằng tiếng Việt nói rõ đây là mock giao diện.
   - Dễ xóa hoặc kết nối dữ liệu thật sau này.
   - Không làm người dùng tưởng nút đã hoạt động nếu chưa có logic.
4. Ghi lại mọi phần mock trong:
   - `design/pingme-redesign-2026/IMPLEMENTATION_MOCK_REPORT.md`

Mỗi mục mock phải ghi:

| Màn hình | Component/File | Nội dung mock | Lý do chưa dùng dữ liệu thật | Cách nối logic thật sau này |
| -------- | -------------- | ------------- | ---------------------------- | --------------------------- |

Nếu một ảnh thể hiện tính năng thuộc mục `Future` trong tài liệu, không implement tính năng đó. Chỉ được hiển thị khi đã có logic thật hoặc được ghi rõ là concept tương lai.

## Công Nghệ Và Pattern Phải Giữ

- React 19 + Vite.
- Tailwind CSS v4 theo CSS-first.
- `lucide-react` cho icon.
- `framer-motion` chỉ cho animation có ích và nhẹ.
- `react-virtuoso` tiếp tục quản lý message list.
- Component source dùng JavaScript/JSX.
- Comment source dùng tiếng Việt khi cần.
- Tái sử dụng component và pattern hiện có trước khi tạo abstraction mới.
- Theme phải tiếp tục hoạt động với `document.documentElement.dataset.theme`.

## Hệ Thống Visual Bắt Buộc

Triển khai token từ `DESIGN_BIBLE.md` vào `client/src/index.css` bằng CSS variables dùng chung:

- Canvas, surface primary, raised, selected.
- Ink, muted ink, hairline.
- Jade, jade soft, coral, coral soft, focus.
- Radius control 8px, bubble 12px, modal/sheet 16-20px.
- Border 1px là cách phân tầng chính.
- Shadow chỉ dùng cho menu, modal, floating composer và call controls.
- Không dùng letter-spacing âm.

Chế độ sáng và tối phải là cùng một hệ thống component, không tạo hai cây component riêng.

## Mapping Thiết Kế Sang Khu Vực Code

Đối chiếu tối thiểu như sau:

| Ảnh                | Khu vực/component cần kiểm tra và triển khai                                             |
| ------------------ | ---------------------------------------------------------------------------------------- |
| D01, M01           | `App.jsx`, `AuthLayout.jsx`, `Login.jsx`, input/button/validation UI                     |
| D02, M02           | `AuthLayout.jsx`, `Register.jsx`, input/button/validation UI                             |
| D03, M03           | `Chat.jsx`, `AppRail.jsx`, `Sidebar.jsx`, `TopNavBar.jsx`, conversation rows             |
| D04, M04           | Contacts/request views đang được điều khiển từ shell/chat                                |
| D05, M05           | Create group flow/modal/sheet trong chat shell                                           |
| D06, M06           | `ChatArea.jsx`, `Header.jsx`, `MessageList.jsx`, `MessageBubble.jsx`, `MessageInput.jsx` |
| D07, M07           | Group states trong các component chat/message hiện tại                                   |
| D08, M08           | Context menu, reaction picker/detail, desktop popover, mobile action sheet               |
| D09, M09, M10, M12 | `MessageInput.jsx`, attachment preview, edit/reply/revoke, upload, audio/voice UI        |
| D10, M13           | Pinned message list, current-chat search, jump/highlight                                 |
| D11, M14           | `GlobalSearchPanel.jsx`, `NotificationPanel.jsx`                                         |
| D12, M15           | `ChatDetailsPanel.jsx`, `MediaGallery.jsx`, direct conversation details                  |
| D13, M16           | `ChatDetailsPanel.jsx`, group member/admin states                                        |
| D14, M17, M18      | `SettingsPanel.jsx`, avatar/theme/notification/privacy/session/security states           |
| D15, M19           | `IncomingCallModal.jsx`, `CallOverlay.jsx`, audio call states                            |
| D16, M20           | `CallOverlay.jsx`, video call, draggable local PiP và call controls                      |

Mapping này là điểm bắt đầu, không phải giới hạn. Phải lần theo prop, handler và state thật trước khi sửa.

## Yêu Cầu Responsive

### Desktop

- App rail: 76px khi thu gọn, 184px khi mở rộng.
- Conversation column: khoảng 344-380px.
- Chat là vùng co giãn chính.
- Detail panel: khoảng 360-400px và đóng mặc định khi chọn conversation.
- Context menu phải nằm cạnh bubble, z-index đúng, không bị message/reaction che.
- Nội dung không tràn hoặc bị cắt ở viewport hẹp.

### Mobile

- Inbox dùng toàn màn hình và bottom navigation.
- Khi mở chat, chat dùng toàn màn hình và ẩn bottom navigation.
- Details/search/notification/settings dùng navigation stack hoặc full-screen panel.
- Message actions/member actions/reaction details dùng bottom sheet.
- Composer không che typing indicator hoặc tin nhắn cuối.
- Tôn trọng safe area, bàn phím và touch target tối thiểu 44x44px.

## Hành Vi Phải Được Giữ Nguyên Sau Redesign

Ít nhất phải giữ được:

- Đăng nhập, đăng ký, auth redirect.
- Theme sáng/tối/hệ thống.
- Chọn cuộc trò chuyện và tự cuộn đúng vị trí.
- Pagination/virtualized message list và auto-load tin cũ.
- Nhận/gửi message realtime không reload toàn bộ conversation.
- Typing indicator nhiều người, read avatar, sent/delivered/read.
- Reply, edit, revoke, copy, reaction, reaction detail, pin/unpin.
- Pinned list, tìm kiếm và jump/highlight.
- Text + nhiều ảnh, gallery/lightbox, file, audio, voice, link preview.
- Notification center, thông báo trong app, mute toàn cục và theo conversation.
- Contacts, friend request, block/report.
- Tạo nhóm, thêm/xóa thành viên, owner/admin/member.
- Upload avatar, privacy, session devices, password.
- Incoming/waiting/connected/ended audio và video call.
- Draggable local video PiP.

## Kế Hoạch Triển Khai Bắt Buộc

Trước khi sửa code:

1. Chạy `git status --short --branch`.
2. Audit component hiện tại và lập bảng:
   - Màn hình/ảnh.
   - Component đang render.
   - Logic/handler cần giữ.
   - Khoảng cách so với thiết kế.
   - Có cần mock hay không.
3. Viết kế hoạch triển khai theo các phase dưới đây.

Triển khai theo thứ tự:

### Phase 1 - Foundation

- Token CSS, theme, typography, icon/button/input/avatar primitives.
- Responsive shell foundation.
- Không được làm hỏng giao diện đang hoạt động giữa chừng.

### Phase 2 - Auth Và App Shell

- D01-D05, M01-M05.
- Login, register, rail, sidebar, inbox, contacts, create group.

### Phase 3 - Chat Core

- D06-D10, M06-M13.
- Header, message list, bubble, metadata, rich content, composer, actions, pin/search/jump.
- Đây là khu vực rủi ro cao; giữ nguyên handler và realtime state.

### Phase 4 - Search, Notification Và Details

- D11-D13, M14-M16.
- Global search, notification center, details, media gallery, group admin.

### Phase 5 - Settings

- D14, M17-M18.
- Profile/avatar/theme/notification/privacy/session/security.

### Phase 6 - Calls

- D15-D16, M19-M20.
- Incoming call, audio call, video call, local PiP.
- Chỉ thay UI; không sửa WebRTC/signaling nếu không có bug rõ ràng được user yêu cầu.

### Phase 7 - Polish Và Verification

- Loading, empty, error, success, hover, focus, active, disabled.
- Light/dark parity.
- Desktop/mobile parity.
- Kiểm tra overflow, overlap, z-index và text truncation.
- Loại bỏ CSS cũ không còn dùng nhưng chỉ khi chắc chắn không ảnh hưởng behavior.

Hoàn thành và verify từng phase trước khi chuyển sang phase tiếp theo. Không chỉ sửa vài ảnh “đại diện”.

## Cách Đối Chiếu Ảnh

Với mỗi ảnh:

1. Mở ảnh bằng công cụ xem ảnh, không chỉ đọc tên file.
2. Ảnh thường đặt biến thể sáng bên trái và tối bên phải.
3. Ghi nhận:
   - Cấu trúc layout.
   - Khoảng cách và mật độ.
   - Kích thước rail/sidebar/header/panel.
   - Typography hierarchy.
   - Border, background, selected state.
   - Icon và affordance.
   - Trạng thái tương tác đang được minh họa.
4. Triển khai bằng component thật và dữ liệu thật.
5. Chụp screenshot giao diện thực tế ở viewport tương ứng để so sánh.
6. Sửa các khác biệt rõ ràng trước khi coi màn hình hoàn thành.

Không cần tái tạo các device frame trong ảnh mobile; cần tái tạo chính giao diện bên trong màn hình.

## Kiểm Tra Bắt Buộc

Sau mỗi phase và khi hoàn thành:

```powershell
cd client
npm run lint
npm run build
```

Nếu server bị chạm vào vì lý do bất khả kháng:

```powershell
cd server
npm run check
```

Sau khi build thành công:

1. Khởi động app bằng dev server.
2. Dùng browser automation hoặc Playwright để kiểm tra giao diện thực tế.
3. Chụp screenshot tối thiểu ở:
   - Desktop rộng khoảng 1440px.
   - Desktop hẹp khoảng 1024px.
   - Mobile khoảng 390x844.
   - Chế độ sáng và tối.
4. Kiểm tra các flow thật end-to-end, không chỉ trang tĩnh.
5. Kiểm tra console không có lỗi mới.
6. Kiểm tra không có element chồng lấn, chữ tràn, nút quá nhỏ hoặc menu bị che.

## File Báo Cáo Bắt Buộc

Tạo và cập nhật:

`design/pingme-redesign-2026/IMPLEMENTATION_REPORT.md`

Báo cáo phải có:

1. Các phase đã hoàn thành.
2. Mapping ảnh -> component/file đã sửa.
3. Các logic/handler quan trọng đã giữ nguyên.
4. Kết quả lint/build/browser test.
5. Danh sách khác biệt còn lại so với ảnh.
6. Các rủi ro hoặc luồng chưa thể test.

Nếu có mock, tạo thêm:

`design/pingme-redesign-2026/IMPLEMENTATION_MOCK_REPORT.md`

Nếu không có mock, vẫn tạo file và ghi rõ: `Không có UI mock; toàn bộ màn hình dùng dữ liệu và logic thật.`

## Định Nghĩa Hoàn Thành

Task chỉ hoàn thành khi:

- Toàn bộ D01-D16 và M01-M20 đã được đối chiếu và triển khai.
- Light mode và dark mode hoạt động đồng nhất.
- Desktop và mobile đều usable, không chỉ đẹp trong screenshot.
- Các flow hiện có vẫn hoạt động.
- Không thay đổi contract realtime/API/WebRTC.
- Không có lỗi lint/build mới.
- Đã browser-test các flow quan trọng.
- Đã tạo đầy đủ implementation report và mock report.
- Có danh sách file đã sửa và tóm tắt rõ phần nào còn khác ảnh.

Khi báo cáo cuối cùng, trình bày ngắn gọn theo cấu trúc:

1. Đã triển khai gì.
2. Đã kiểm tra gì và kết quả.
3. Phần nào đang mock.
4. Khác biệt còn lại so với thiết kế.
5. File/report quan trọng để review.

Không commit hoặc push nếu user chưa yêu cầu rõ.

---
