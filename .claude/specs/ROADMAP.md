# PingMe Development Roadmap

## Tình trạng hiện tại

- ✅ UI Components hoàn thiện (Login, Register, Chat Interface)
- ✅ Socket.io setup cơ bản
- ✅ MongoDB models (User, Message)
- ✅ Authentication (JWT + httpOnly cookies)
- ✅ Real-time Messaging (Socket.io)
- ✅ Friend Management
- ⚠️ Media & File Sharing (Đang triển khai)
- ⚠️ Voice & Video Calls (Đang triển khai)
- ❌ Group Chat
- ❌ Push Notifications
- ❌ Message Encryption
- ❌ Stories / Status Updates

## Kế hoạch phát triển theo thứ tự ưu tiên

### Phase 1: Authentication & Core Messaging (Hoàn thành)

- ✅ Authentication System — JWT, bcrypt, httpOnly cookies
- ✅ Real-time Messaging — Socket.io, message status, typing indicators
- ✅ Friend Management — Request, accept, reject, friend list
- ✅ UI/UX Refresh — Midnight Command Center redesign

### Phase 2: Media & File Sharing (Ưu tiên cao — Đang triển khai)

**Specs:** `.claude/specs/media-file-sharing/requirements.md`

1. **Upload Images**
   - Native file picker (image/*), max 10MB
   - Preview before sending, progress indicator
   - Multi-image gallery (up to 5 per message)
   - Retry on failure

2. **File Attachments**
   - Non-image files: PDF, DOC, ZIP, etc. — max 25MB
   - File card UI (icon + name + size)
   - Download on click

3. **Image Lightbox**
   - Fullscreen overlay on image tap
   - Pinch-to-zoom, swipe to close

4. **Message Reactions**
   - Long-press to show emoji picker (6 quick emojis)
   - Reaction badges below bubble
   - Toggle: tap again to remove

5. **Media Gallery**
   - Grid view of all images in conversation
   - Click thumbnail → open lightbox

### Phase 3: Voice & Video Calls (Ưu tiên cao — Đang triển khai)

**Specs:** `.claude/specs/voice-video-calls/requirements.md`

1. **Call Initiation**
   - `call_request` Socket.io event
   - Incoming call modal with accept/decline
   - "Calling..." → "Ringing" → Connected states

2. **WebRTC Signaling**
   - Peer connection with STUN (Google public)
   - offer/answer/ICE candidate exchange via Socket.io
   - Graceful fallback on failure

3. **Call UI**
   - Full-screen overlay: mute, camera, speaker, end
   - Local video PIP (picture-in-picture)
   - Remote video fullscreen
   - Call timer

4. **Call State**
   - CallContext (separate from SocketContext)
   - Active call persists across navigation
   - "User busy" when already in call

### Phase 4: Group Chat (Ưu tiên trung bình)

**Specs:** `.claude/specs/group-chat/requirements.md` (chưa tạo)

1. Tạo nhóm (name, avatar, description)
2. Thêm/xóa thành viên
3. Admin roles (kick, promote, rename)
4. Group message history
5. Group settings

### Phase 5: Profile & Settings (Ưu tiên thấp)

**Specs:** `.claude/specs/user-profile-management/requirements.md` (chưa tạo)

1. Xem/sửa profile (username, bio)
2. Đổi avatar (upload image)
3. Đổi mật khẩu
4. Cài đặt thông báo

### Phase 6: Push Notifications (Ưu tiên thấp)

1. Browser push notifications (Notification API)
2. In-app notification bell
3. Notification preferences

### Phase 7: Advanced (Ưu tiên thấp)

1. **Message Encryption** — E2E encryption (Signal Protocol)
2. **Stories / Status** — 24h stories như WhatsApp
3. **Search Messages** — Tìm kiếm trong lịch sử chat
4. **Chat Themes** — Dark/Light mode

## Công nghệ cần bổ sung

### Backend

- ✅ Express, Socket.io, MongoDB/Mongoose (đã có)
- ✅ JWT + bcrypt (đã có)
- ⚠️ multer — upload files
- ⚠️ uuid — file naming

### Frontend

- ✅ React, Socket.io-client, React Router (đã có)
- ⚠️ File Reader API (native) — image preview
- ⚠️ RTCPeerConnection (native) — WebRTC
- ⚠️ getUserMedia (native) — camera/mic

### Voice/Video

- ⚠️ STUN: `stun:stun.l.google.com:19302` (public, free)
- ⚠️ TURN: cần tạo tài khoản (Twilio, Xirsys, hoặc self-host)
