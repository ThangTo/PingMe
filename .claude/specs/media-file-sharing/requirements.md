# Media & File Sharing — Requirements Document

## Introduction

Hệ thống chia sẻ media và file cho ứng dụng PingMe — cho phép người dùng gửi ảnh, file đính kèm, reactions, và quản lý media trong cuộc trò chuyện.

## Use Cases

- UC1: Gửi ảnh từ thiết bị hoặc paste vào chat
- UC2: Gửi file đính kèm (PDF, DOC, ZIP...)
- UC3: Preview ảnh trong chat (lightbox)
- UC4: Reaction tin nhắn bằng emoji
- UC5: Xem gallery ảnh của cuộc trò chuyện

## Requirements

### Requirement 1: Upload & Send Images

**User Story:** As a user, I want to send images in chat, so that I can share photos with friends.

#### Acceptance Criteria

1. WHEN user clicks attach button, THEN show native file picker filtered to image types
2. WHEN user selects image(s), THEN show preview before sending
3. WHEN image exceeds 10MB, THEN show error "Kích thước tối đa 10MB"
4. WHEN image is uploading, THEN show progress indicator on message bubble
5. WHEN upload completes, THEN display image in chat with lazy-load
6. WHEN multiple images selected, THEN send as gallery (up to 5 images per message)
7. WHEN image fails to upload, THEN show retry button on bubble
8. WHEN user pastes image from clipboard, THEN treat as image upload

### Requirement 2: File Attachments

**User Story:** As a user, I want to send documents and files, so that I can share PDFs, documents and other files.

#### Acceptance Criteria

1. WHEN user attaches non-image file, THEN show file card in chat (icon + filename + size)
2. WHEN file exceeds 25MB, THEN show error "Kích thước tối đa 25MB"
3. WHEN user clicks file card, THEN download file to device
4. SUPPORTED file types: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, ZIP, RAR, TXT, CSV
5. WHEN unsupported file type, THEN show error "Định dạng không được hỗ trợ"

### Requirement 3: Image Preview (Lightbox)

**User Story:** As a user, I want to tap images to view them full-screen, so that I can see details.

#### Acceptance Criteria

1. WHEN user clicks image in chat, THEN open fullscreen lightbox overlay
2. WHEN lightbox is open, THEN show image centered with dark backdrop (90% opacity)
3. WHEN lightbox is open, THEN show close button (X) top-right
4. WHEN user clicks backdrop, THEN close lightbox
5. WHEN user swipes down on lightbox, THEN close lightbox
6. SUPPORT pinch-to-zoom on mobile

### Requirement 4: Message Reactions

**User Story:** As a user, I want to react to messages with emoji, so that I can respond quickly.

#### Acceptance Criteria

1. WHEN user long-press (500ms) or hovers on message, THEN show reaction button
2. WHEN user clicks reaction button, THEN show emoji picker (6 quick reactions: 👍 ❤️ 😂 🔥 👏 💩)
3. WHEN user selects emoji, THEN add reaction to message and emit via Socket.io
4. WHEN message has reactions, THEN show reaction badges below bubble (emoji + count)
5. WHEN user taps reaction badge, THEN show list of users who reacted
6. WHEN user reacts with same emoji again, THEN remove their reaction (toggle)
7. WHEN user reacts with different emoji, THEN add new reaction alongside existing ones

### Requirement 5: Media Gallery

**User Story:** As a user, I want to see all images shared in a conversation, so that I can find old photos.

#### Acceptance Criteria

1. WHEN user clicks gallery icon in chat header, THEN open media gallery panel
2. WHEN gallery panel is open, THEN show grid of all images in conversation (newest first)
3. WHEN user clicks thumbnail in gallery, THEN open lightbox at that image
4. WHEN gallery is empty, THEN show empty state "Chưa có ảnh nào được chia sẻ"

## Technical Approach

### Backend (Multer + Local Storage)

- `server/uploads/` directory for stored files (gitignore this directory)
- Static file serving: `app.use('/uploads', express.static('uploads'))`
- Multer middleware with `storage` and `limits: { fileSize: 25 * 1024 * 1024 }`
- File naming: `{userId}_{timestamp}_{originalname}`
- Store file metadata (url, filename, size, type) in MongoDB `Message` model
- New field on Message schema: `attachments: [{ type, url, filename, size }]`
- New field on Message schema: `reactions: [{ emoji, userId }]`

### Frontend

- `FormData` for uploading files (not Axios JSON)
- `URL.createObjectURL()` for local preview before upload
- Lightbox: simple overlay div with `position: fixed; inset: 0`
- Emoji picker: simple div with emoji buttons (no external library)

### API Changes

```
POST /api/messages/upload   — Auth   — Multipart form, returns { url, filename, size, type }
```

### Socket Events

```
Client → Server: add_reaction, remove_reaction
Server → Client: reaction_added, reaction_removed
```

## File Structure

```
server/
  uploads/                  ← gitignored

server/middlewares/
  upload.middleware.js      ← Multer config

server/routes/
  message.routes.js         ← POST /upload endpoint

client/src/components/chat/
  ImageLightbox.jsx         ← Lightbox overlay
  EmojiPicker.jsx           ← Emoji reaction picker
  MessageBubble.jsx         ← Updated with reactions + attachments

client/src/components/layout/
  MediaGallery.jsx          ← Full-screen gallery panel
```