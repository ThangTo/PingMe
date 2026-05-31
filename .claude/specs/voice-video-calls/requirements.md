# Voice & Video Calls — Requirements Document

## Introduction

Hệ thống gọi thoại và gọi video 1-1 cho ứng dụng PingMe, sử dụng WebRTC cho kết nối peer-to-peer và Socket.io để truyền tín hiệu (signaling).

## Use Cases

- UC1: Thực hiện cuộc gọi thoại 1-1
- UC2: Thực hiện cuộc gọi video 1-1
- UC3: Nhận cuộc gọi đến (chấp nhận / từ chối)
- UC4: Kết thúc cuộc gọi
- UC5: Hiển thị trạng thái gọi (calling, ringing, connected)

## Requirements

### Requirement 1: Call Initiation

**User Story:** As a user, I want to initiate a voice or video call, so that I can talk to my friend.

#### Acceptance Criteria

1. WHEN user clicks call button in chat header, THEN start voice call
2. WHEN user clicks video call button in chat header, THEN start video call
3. WHEN call starts, THEN emit `call_request` via Socket.io with { callerId, calleeId, type: 'voice'|'video' }
4. WHEN `call_request` sent, THEN show "Calling..." overlay to caller
5. WHEN `call_request` received by callee, THEN show incoming call modal (ringtone animation)
6. WHEN callee rejects, THEN emit `call_rejected` → close both modals, show toast
7. WHEN callee accepts, THEN emit `call_accepted` → initiate WebRTC handshake
8. WHEN caller ends before accept, THEN emit `call_cancelled` → close callee's modal

### Requirement 2: WebRTC Signaling

**User Story:** As a caller/callee, I want WebRTC to establish a direct connection, so that call works.

#### Acceptance Criteria

1. WHEN call is accepted, THEN caller creates RTCPeerConnection with STUN config
2. WHEN peer connection created, THEN caller gets media stream (audio only for voice, audio+video for video)
3. WHEN caller adds local tracks to peer connection, THEN generate and emit `offer` (SDP)
4. WHEN callee receives `offer`, THEN create peer connection, set remote description, create `answer`, emit `answer`
5. WHEN caller receives `answer`, THEN set remote description
6. WHEN ice candidate generated, THEN emit `ice_candidate` to peer
7. WHEN ice candidate received, THEN add to peer connection
8. WHEN connection established (iceConnectionState = 'connected'), THEN show call UI
9. FALLBACK: if WebRTC fails within 15s, show "Kết nối thất bại" and end call

### Requirement 3: Call UI

**User Story:** As a user in a call, I want to see the call interface, so that I know it's working.

#### Acceptance Criteria

1. WHEN call connects, THEN show call overlay (full-screen or floating)
2. WHEN in voice call, THEN show: callee avatar (large), timer, mute/speaker/end buttons
3. WHEN in video call, THEN show: local video (small, corner), remote video (full), mute/camera/end buttons
4. WHEN mute clicked, THEN toggle audio track enabled state, update button icon
5. WHEN camera clicked (video only), THEN toggle video track enabled state, show avatar if camera off
6. WHEN end call clicked, THEN emit `call_ended`, close peer connection, close UI
7. WHEN remote user ends call, THEN show "Cuộc gọi đã kết thúc", close UI after 2s
8. WHEN tab is hidden during call, THEN continue call (keep audio context alive)

### Requirement 4: STUN/TURN Configuration

**User Story:** As a system, I need to configure WebRTC ICE servers, so that calls work on all networks.

#### Acceptance Criteria

1. USE Google's public STUN servers: `stun:stun.l.google.com:19302`
2. FOR production, configure TURN server (e.g., Twilio, Xirsys) for users behind symmetric NAT
3. IF no ICE candidates found within 10s, THEN show "Không thể kết nối" error

### Requirement 5: Call State Persistence

**User Story:** As a system, I want to track active calls, so that users get notified of missed calls.

#### Acceptance Criteria

1. WHEN user is in a call and navigates to another chat, THEN keep call active (floating UI)
2. WHEN app reloads during call, THEN end call (graceful degradation)
3. WHEN user receives call while already in another call, THEN show "Người dùng đang bận"
4. STORE active call state in-memory only (SocketContext or separate CallContext)

## Technical Approach

### STUN/TURN

```js
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  // Add TURN server URL + credentials for production
];
```

### Socket Events

```
Client → Server:
  call_request    { callerId, calleeId, type: 'voice'|'video' }
  call_cancelled  { callerId, calleeId }
  call_accepted  { callerId, calleeId }
  call_rejected   { callerId, calleeId }
  call_ended     { callerId, calleeId }
  offer          { callerId, calleeId, sdp }
  answer         { callerId, calleeId, sdp }
  ice_candidate  { callerId, calleeId, candidate }

Server → Client (relayed to specific user):
  incoming_call  { callerId, type }
  call_cancelled { callerId }
  call_accepted  { calleeId }
  call_rejected  { calleeId }
  call_ended     { calleeId }
  offer          { callerId, sdp }
  answer         { calleeId, sdp }
  ice_candidate  { fromId, candidate }
  user_busy      { calleeId }
```

### Server State

```js
// In-memory only — lost on restart
const activeCalls = new Map(); // callId → { callerId, calleeId, type, startedAt }
```

### File Structure

```
client/src/context/
  CallContext.jsx            ← Call state: activeCall, localStream, remoteStream, peerConnection

client/src/components/call/
  IncomingCallModal.jsx      ← Ringing modal when receiving call
  CallOverlay.jsx            ← Full call UI (voice + video)
  CallButton.jsx             ← Header buttons (wired to CallContext)

client/src/hooks/
  useWebRTC.js               ← Peer connection logic, offer/answer/ICE handling
  useMediaDevices.js         ← getUserMedia, device selection
```

## UI Design

### Incoming Call Modal
- Centered modal with avatar + name of caller
- Ringing animation (pulsing ring around avatar)
- Two buttons: Accept (green), Decline (red)
- Type indicator: "Cuộc gọi thoại đến" or "Cuộc gọi video đến"

### Call Overlay
- Full-screen dark overlay
- Remote video (or avatar + name for voice)
- Local video (small PIP, bottom-right, draggable if possible)
- Bottom bar: Mute, Camera (video), Speaker, End
- Timer at top: "00:32"

## Key Implementation Notes

1. CallContext should NOT conflict with SocketContext — use separate context
2. Peer connection is only created AFTER call_accepted is received by caller
3. All signaling (offer/answer/ICE) goes through server Socket.io, NOT direct
4. Clean up: peerConnection.close() on call end, revoke all Object URLs
5. Handle permission denied: show "Vui lòng cho phép truy cập micro/camera"
