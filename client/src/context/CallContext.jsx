/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import incomingCallRingtoneUrl from '../assets/audio/incoming-call-soft.wav';
import { requestNotificationPermission } from '../services/pushNotifications';
import api from '../config/api';

const DEFAULT_RTC_CONFIG = { iceServers: [] };

const CallContext = createContext(null);

const initialCallState = {
  status: 'idle', // 'idle' | 'calling' | 'ringing' | 'connected'
  callId: null,
  type: null, // 'voice' | 'video'
  conversationId: null,
  partner: null, // { id, name, avatar }
  connectedAt: null,
  isMuted: false,
  isVideoOff: false,
};

const callNoticeText = {
  media_error: 'Không thể mở micro/camera.',
  rejected: 'Cuộc gọi đã bị từ chối.',
  ended: 'Cuộc gọi đã kết thúc.',
  missed: 'Cuộc gọi không có phản hồi.',
  disconnected: 'Người kia đã mất kết nối.',
  offline: 'Người này hiện không online.',
  busy: 'Người này đang bận.',
  user_busy: 'Người này đang bận.',
  self_busy: 'Bạn đang ở trong một cuộc gọi khác.',
  failed: 'Không thể bắt đầu cuộc gọi.',
};

const OPEN_CONVERSATION_EVENT = 'pingme:open-conversation';

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within CallProvider');
  return context;
};

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [callState, setCallState] = useState(initialCallState);
  const [callNotice, setCallNotice] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const callStateRef = useRef(initialCallState);
  const peerConnectionRef = useRef(null);
  const rtcConfigRef = useRef(DEFAULT_RTC_CONFIG);
  const pendingIceCandidatesRef = useRef([]);
  const noticeTimerRef = useRef(null);
  const ringtoneAudioRef = useRef(null);
  const ringtoneUnlockedRef = useRef(false);
  const ringtoneUnlockPromiseRef = useRef(null);
  const incomingCallNotificationRef = useRef(null);
  const notificationPermissionRequestedRef = useRef(false);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    if (!user) return undefined;

    let cancelled = false;

    api
      .get('/calls/ice-config')
      .then((response) => {
        if (cancelled) return;
        const iceServers = response.data?.iceServers;
        rtcConfigRef.current = Array.isArray(iceServers) ? { iceServers } : DEFAULT_RTC_CONFIG;
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('Không thể lấy RTC ICE config từ server:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const setCallStateSnapshot = useCallback((nextStateOrUpdater) => {
    setCallState((prev) => {
      const nextState =
        typeof nextStateOrUpdater === 'function' ? nextStateOrUpdater(prev) : nextStateOrUpdater;
      callStateRef.current = nextState;
      return nextState;
    });
  }, []);

  const showCallNotice = useCallback((message) => {
    if (!message) return;

    clearTimeout(noticeTimerRef.current);
    setCallNotice(message);
    noticeTimerRef.current = setTimeout(() => setCallNotice(''), 2600);
  }, []);

  const requestCallNotificationPermission = useCallback(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;
    if (notificationPermissionRequestedRef.current) return;

    notificationPermissionRequestedRef.current = true;
    void requestNotificationPermission()
      .then((permission) => {
        if (permission === 'default') {
          notificationPermissionRequestedRef.current = false;
        }
      })
      .catch((error) => {
        notificationPermissionRequestedRef.current = false;
        console.warn('Không thể xin quyền thông báo:', error);
      });
  }, []);

  const closeIncomingCallNotification = useCallback(() => {
    incomingCallNotificationRef.current?.close();
    incomingCallNotificationRef.current = null;
  }, []);

  const showIncomingCallNotification = useCallback(
    (payload = {}) => {
      if (typeof Notification === 'undefined') return;
      if (Notification.permission !== 'granted') return;
      if (!document.hidden) return;

      closeIncomingCallNotification();

      const callerName = payload.caller?.name || 'Người gọi';
      const callTypeLabel = payload.type === 'video' ? 'video' : 'thoại';
      let notification;

      try {
        notification = new Notification(`Cuộc gọi ${callTypeLabel} đến`, {
          body: `${callerName} đang gọi cho bạn`,
          icon: '/logo.png',
          badge: '/logo.png',
          tag: payload.callId ? `pingme-call-${payload.callId}` : 'pingme-call-incoming',
          renotify: true,
          requireInteraction: true,
          silent: false,
          vibrate: [220, 120, 220, 120, 420],
        });
      } catch (error) {
        console.warn('Không thể hiển thị thông báo cuộc gọi:', error);
        return;
      }

      notification.onclick = () => {
        window.focus();
        if (payload.conversationId) {
          window.dispatchEvent(
            new CustomEvent(OPEN_CONVERSATION_EVENT, {
              detail: { conversationId: payload.conversationId },
            }),
          );
        }
        notification.close();
      };

      incomingCallNotificationRef.current = notification;
    },
    [closeIncomingCallNotification],
  );

  const getRingtoneAudio = useCallback(() => {
    if (typeof Audio === 'undefined') return null;

    if (!ringtoneAudioRef.current) {
      const audio = new Audio(incomingCallRingtoneUrl);
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = 0.52;
      ringtoneAudioRef.current = audio;
    }

    return ringtoneAudioRef.current;
  }, []);

  const unlockRingtoneAudio = useCallback(async () => {
    if (ringtoneUnlockedRef.current) return true;
    if (ringtoneUnlockPromiseRef.current) return false;
    if (callStateRef.current.status !== 'idle') return false;
    const audio = getRingtoneAudio();
    if (!audio) return false;
    ringtoneUnlockPromiseRef.current = true;

    try {
      audio.muted = true;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      ringtoneUnlockedRef.current = true;
      ringtoneUnlockPromiseRef.current = null;
      return true;
    } catch (error) {
      audio.muted = false;
      ringtoneUnlockPromiseRef.current = null;
      console.warn('Không thể bật âm thanh chuông:', error);
      return false;
    }
  }, [getRingtoneAudio]);

  const stopRingtone = useCallback(() => {
    const audio = ringtoneAudioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
  }, []);

  const startRingtone = useCallback(() => {
    const audio = getRingtoneAudio();
    if (!audio || !audio.paused) return;

    audio.currentTime = 0;
    audio.muted = false;
    audio.volume = 0.52;
    void audio.play().catch((error) => {
      console.warn('Không thể phát âm thanh chuông:', error);
    });
  }, [getRingtoneAudio]);

  const closePeerConnection = useCallback(() => {
    pendingIceCandidatesRef.current = [];

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  }, []);

  const startLocalMedia = useCallback(async (type) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video',
    });

    setLocalStream(stream);
    return stream;
  }, []);

  const createPeerConnection = useCallback(
    ({ callId, partnerId }) => {
      closePeerConnection();
      const pc = new RTCPeerConnection(rtcConfigRef.current);

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;

        socket.emit('webrtc_ice_candidate', {
          callId,
          toUserId: partnerId,
          candidate: event.candidate,
        });
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        setRemoteStream(stream);
      };

      peerConnectionRef.current = pc;
      return pc;
    },
    [closePeerConnection, socket],
  );

  const stopLocalMedia = useCallback(() => {
    setLocalStream((stream) => {
      stream?.getTracks?.().forEach((track) => track.stop());
      return null;
    });
    setRemoteStream(null);
  }, []);

  const resetCall = useCallback(
    (notice) => {
      closeIncomingCallNotification();
      stopRingtone();
      closePeerConnection();
      stopLocalMedia();
      setCallStateSnapshot(initialCallState);
      showCallNotice(notice);
    },
    [
      closeIncomingCallNotification,
      closePeerConnection,
      setCallStateSnapshot,
      showCallNotice,
      stopLocalMedia,
      stopRingtone,
    ],
  );

  const getNoticeFromPayload = useCallback((payload, fallbackReason = 'ended') => {
    const reason = payload?.reason || fallbackReason;
    return payload?.message || callNoticeText[reason] || callNoticeText.failed;
  }, []);

  const initiateCall = useCallback(
    (partnerId, type, partnerInfo = {}) => {
      if (!socket?.connected) {
        showCallNotice('Socket chưa kết nối, chưa thể gọi.');
        return;
      }

      if (!partnerId || partnerId === user?.id) {
        showCallNotice('Người nhận cuộc gọi không hợp lệ.');
        return;
      }

      if (!['voice', 'video'].includes(type)) {
        showCallNotice('Loại cuộc gọi không hợp lệ.');
        return;
      }

      if (callStateRef.current.status !== 'idle') {
        showCallNotice('Bạn đang ở trong một cuộc gọi khác.');
        return;
      }

      setCallStateSnapshot({
        ...initialCallState,
        status: 'calling',
        type,
        conversationId: partnerInfo.conversationId || null,
        partner: {
          id: partnerId,
          name: partnerInfo.name || 'Người dùng',
          avatar: partnerInfo.avatar || '',
        },
      });

      socket.emit('call_request', {
        toUserId: partnerId,
        type,
        conversationId: partnerInfo.conversationId || null,
      });
    },
    [setCallStateSnapshot, showCallNotice, socket, user?.id],
  );

  const acceptCall = useCallback(() => {
    const currentCall = callStateRef.current;
    if (currentCall.status !== 'ringing' || !currentCall.callId) return;

    closeIncomingCallNotification();
    stopRingtone();
    socket.emit('call_accept', {
      callId: currentCall.callId,
    });
  }, [closeIncomingCallNotification, socket, stopRingtone]);

  const rejectCall = useCallback(() => {
    const currentCall = callStateRef.current;
    if (currentCall.callId) {
      socket.emit('call_reject', {
        callId: currentCall.callId,
        reason: 'rejected',
      });
    }
    resetCall();
  }, [resetCall, socket]);

  const endCall = useCallback(() => {
    const currentCall = callStateRef.current;
    if (currentCall.callId) {
      socket.emit('call_end', {
        callId: currentCall.callId,
        reason: 'ended',
      });
    }
    resetCall();
  }, [resetCall, socket]);

  const toggleMute = useCallback(() => {
    setCallStateSnapshot((prev) => {
      const nextMuted = !prev.isMuted;
      localStream?.getAudioTracks?.().forEach((track) => {
        track.enabled = !nextMuted;
      });
      return { ...prev, isMuted: nextMuted };
    });
  }, [localStream, setCallStateSnapshot]);

  const toggleVideo = useCallback(() => {
    setCallStateSnapshot((prev) => {
      const nextVideoOff = !prev.isVideoOff;
      localStream?.getVideoTracks?.().forEach((track) => {
        track.enabled = !nextVideoOff;
      });
      return { ...prev, isVideoOff: nextVideoOff };
    });
  }, [localStream, setCallStateSnapshot]);

  useEffect(() => {
    const handleUserGesture = () => {
      void unlockRingtoneAudio();
      requestCallNotificationPermission();
    };

    window.addEventListener('pointerdown', handleUserGesture, { passive: true });
    window.addEventListener('keydown', handleUserGesture);

    return () => {
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
    };
  }, [requestCallNotificationPermission, unlockRingtoneAudio]);

  useEffect(() => {
    if (!socket) return undefined;

    const isCurrentCall = (payload = {}) => {
      const currentCall = callStateRef.current;
      if (!payload.callId) return currentCall.status !== 'idle';
      return Boolean(currentCall.callId) && payload.callId === currentCall.callId;
    };

    const isActiveRtcCall = (payload = {}) => {
      const currentCall = callStateRef.current;
      return (
        Boolean(payload.callId) &&
        currentCall.callId === payload.callId &&
        currentCall.status === 'connected'
      );
    };

    const flushPendingIceCandidates = async () => {
      const pc = peerConnectionRef.current;
      if (!pc?.remoteDescription) return;

      const candidates = pendingIceCandidatesRef.current;
      pendingIceCandidatesRef.current = [];

      for (const candidate of candidates) {
        await pc.addIceCandidate(candidate);
      }
    };

    const handleRtcError = (error, callId, notice = 'Không thể thiết lập cuộc gọi.') => {
      console.error('Lỗi WebRTC:', error);
      if (callId) {
        socket.emit('call_end', {
          callId,
          reason: 'media_error',
        });
      }
      resetCall(notice);
    };

    const handleCallRinging = (payload) => {
      setCallStateSnapshot((prev) => {
        if (prev.status !== 'calling') return prev;
        return {
          ...prev,
          callId: payload.callId,
          type: payload.type || prev.type,
          conversationId: payload.conversationId || prev.conversationId,
          partner: payload.partner || prev.partner,
        };
      });
    };

    const handleCallIncoming = (payload) => {
      const currentCall = callStateRef.current;

      if (currentCall.callId && currentCall.callId === payload.callId) {
        return;
      }

      if (currentCall.status !== 'idle') {
        socket.emit('call_reject', {
          callId: payload.callId,
          reason: 'busy',
        });
        return;
      }

      setCallStateSnapshot({
        ...initialCallState,
        status: 'ringing',
        callId: payload.callId,
        type: payload.type,
        conversationId: payload.conversationId || null,
        partner: {
          id: payload.fromUserId,
          name: payload.caller?.name || 'Người gọi',
          avatar: payload.caller?.avatar || '',
        },
      });
      startRingtone();
      showIncomingCallNotification(payload);
    };

    const handleCallAccepted = async (payload) => {
      if (!isCurrentCall(payload)) return;
      const callId = payload.callId;
      const type = payload.type || callStateRef.current.type;
      const partnerId = payload.fromUserId;

      setCallStateSnapshot((prev) => ({
        ...prev,
        status: 'connected',
        callId: callId || prev.callId,
        type: type || prev.type,
        conversationId: payload.conversationId || prev.conversationId,
        partner: payload.partner || prev.partner,
        connectedAt: Date.now(),
      }));

      try {
        const stream = await startLocalMedia(type);
        if (callStateRef.current.callId !== callId) {
          stream.getTracks().forEach((track) => track.stop());
          setLocalStream(null);
          return;
        }

        const pc = createPeerConnection({
          callId,
          partnerId,
        });

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('webrtc_offer', {
          callId,
          toUserId: partnerId,
          offer,
        });
      } catch (error) {
        handleRtcError(error, callId, 'Không thể mở micro/camera.');
      }
    };

    const handleCallConnected = (payload) => {
      if (!isCurrentCall(payload)) return;

      setCallStateSnapshot((prev) => ({
        ...prev,
        status: 'connected',
        callId: payload.callId || prev.callId,
        type: payload.type || prev.type,
        conversationId: payload.conversationId || prev.conversationId,
        partner: payload.partner || prev.partner,
        connectedAt: prev.connectedAt || Date.now(),
      }));
    };

    const handleCallRejected = (payload) => {
      if (!isCurrentCall(payload)) return;
      resetCall(getNoticeFromPayload(payload, 'rejected'));
    };

    const handleCallEnded = (payload) => {
      if (!isCurrentCall(payload)) return;
      resetCall(getNoticeFromPayload(payload, 'ended'));
    };

    const handleCallBusy = (payload) => {
      resetCall(getNoticeFromPayload(payload, payload?.reason || 'user_busy'));
    };

    const handleCallFailed = (payload) => {
      if (!isCurrentCall(payload)) return;
      resetCall(getNoticeFromPayload(payload, payload?.reason || 'failed'));
    };

    const handleCallResolved = (payload) => {
      if (!isCurrentCall(payload)) return;

      const statusText =
        payload.status === 'accepted'
          ? 'Cuộc gọi đã được nhận ở thiết bị khác.'
          : 'Cuộc gọi đã được xử lý ở thiết bị khác.';
      resetCall(statusText);
    };

    const handleSocketDisconnect = () => {
      resetCall();
    };

    const handleWebrtcOffer = async (payload) => {
      if (!isActiveRtcCall(payload)) return;

      try {
        const currentCall = callStateRef.current;
        const stream = await startLocalMedia(currentCall.type);
        if (callStateRef.current.callId !== payload.callId) {
          stream.getTracks().forEach((track) => track.stop());
          setLocalStream(null);
          return;
        }

        const pc = createPeerConnection({
          callId: payload.callId,
          partnerId: payload.fromUserId,
        });

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        await flushPendingIceCandidates();

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc_answer', {
          callId: payload.callId,
          toUserId: payload.fromUserId,
          answer,
        });
      } catch (error) {
        handleRtcError(error, payload.callId, 'Không thể thiết lập cuộc gọi.');
      }
    };

    const handleWebrtcAnswer = async (payload) => {
      if (!isActiveRtcCall(payload)) return;
      if (!peerConnectionRef.current) return;

      try {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(payload.answer),
        );
        await flushPendingIceCandidates();
      } catch (error) {
        handleRtcError(error, payload.callId, 'Không thể hoàn tất kết nối cuộc gọi.');
      }
    };

    const handleWebrtcIceCandidate = async (payload) => {
      if (!isActiveRtcCall(payload) || !payload.candidate) return;

      try {
        const candidate = new RTCIceCandidate(payload.candidate);

        if (!peerConnectionRef.current?.remoteDescription) {
          pendingIceCandidatesRef.current.push(candidate);
          return;
        }

        await peerConnectionRef.current.addIceCandidate(candidate);
      } catch (error) {
        console.warn('Không thể thêm ICE candidate:', error);
      }
    };

    socket.on('call_ringing', handleCallRinging);
    socket.on('call_incoming', handleCallIncoming);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('call_connected', handleCallConnected);
    socket.on('call_rejected', handleCallRejected);
    socket.on('call_ended', handleCallEnded);
    socket.on('call_busy', handleCallBusy);
    socket.on('call_failed', handleCallFailed);
    socket.on('call_resolved', handleCallResolved);
    socket.on('disconnect', handleSocketDisconnect);
    socket.on('webrtc_offer', handleWebrtcOffer);
    socket.on('webrtc_answer', handleWebrtcAnswer);
    socket.on('webrtc_ice_candidate', handleWebrtcIceCandidate);

    return () => {
      socket.off('call_ringing', handleCallRinging);
      socket.off('call_incoming', handleCallIncoming);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('call_connected', handleCallConnected);
      socket.off('call_rejected', handleCallRejected);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_busy', handleCallBusy);
      socket.off('call_failed', handleCallFailed);
      socket.off('call_resolved', handleCallResolved);
      socket.off('disconnect', handleSocketDisconnect);
      socket.off('webrtc_offer', handleWebrtcOffer);
      socket.off('webrtc_answer', handleWebrtcAnswer);
      socket.off('webrtc_ice_candidate', handleWebrtcIceCandidate);
    };
  }, [
    createPeerConnection,
    getNoticeFromPayload,
    resetCall,
    setCallStateSnapshot,
    showIncomingCallNotification,
    socket,
    startRingtone,
    startLocalMedia,
  ]);

  useEffect(
    () => () => {
      clearTimeout(noticeTimerRef.current);
      closeIncomingCallNotification();
      stopRingtone();
      closePeerConnection();
      stopLocalMedia();
      ringtoneAudioRef.current = null;
    },
    [closeIncomingCallNotification, closePeerConnection, stopLocalMedia, stopRingtone],
  );

  return (
    <CallContext.Provider
      value={{
        callState,
        setCallState: setCallStateSnapshot,
        callNotice,
        localStream,
        remoteStream,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
