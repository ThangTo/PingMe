/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const rtcConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

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

const RINGTONE_BEEP_MS = 420;
const RINGTONE_LOOP_MS = 1350;

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
  const pendingIceCandidatesRef = useRef([]);
  const noticeTimerRef = useRef(null);
  const ringtoneAudioContextRef = useRef(null);
  const ringtoneTimersRef = useRef([]);
  const ringtoneNodesRef = useRef([]);
  const ringtonePlayingRef = useRef(false);
  const playRingtonePulseRef = useRef(null);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

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

  const getRingtoneAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return null;

    if (!ringtoneAudioContextRef.current) {
      ringtoneAudioContextRef.current = new AudioContextConstructor();
    }

    return ringtoneAudioContextRef.current;
  }, []);

  const unlockRingtoneAudio = useCallback(async () => {
    const audioContext = getRingtoneAudioContext();
    if (!audioContext) return false;

    try {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      return audioContext.state === 'running';
    } catch (error) {
      console.warn('Không thể bật âm thanh chuông:', error);
      return false;
    }
  }, [getRingtoneAudioContext]);

  const clearRingtoneTimers = useCallback(() => {
    ringtoneTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    ringtoneTimersRef.current = [];
  }, []);

  const stopRingtone = useCallback(() => {
    ringtonePlayingRef.current = false;
    clearRingtoneTimers();
    ringtoneNodesRef.current.forEach(({ lowTone, highTone, gain }) => {
      try {
        lowTone.stop();
      } catch {
        // Oscillator có thể đã stop theo lịch trước đó.
      }

      try {
        highTone.stop();
      } catch {
        // Oscillator có thể đã stop theo lịch trước đó.
      }

      lowTone.disconnect();
      highTone.disconnect();
      gain.disconnect();
    });
    ringtoneNodesRef.current = [];
  }, [clearRingtoneTimers]);

  const playRingtonePulse = useCallback(() => {
    if (!ringtonePlayingRef.current) return;

    const audioContext = getRingtoneAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;

    const startAt = audioContext.currentTime;
    const stopAt = startAt + RINGTONE_BEEP_MS / 1000;
    const gain = audioContext.createGain();
    const lowTone = audioContext.createOscillator();
    const highTone = audioContext.createOscillator();

    lowTone.type = 'sine';
    highTone.type = 'sine';
    lowTone.frequency.setValueAtTime(880, startAt);
    highTone.frequency.setValueAtTime(1174.66, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

    lowTone.connect(gain);
    highTone.connect(gain);
    gain.connect(audioContext.destination);
    const activeNodes = { lowTone, highTone, gain };
    ringtoneNodesRef.current.push(activeNodes);

    lowTone.start(startAt);
    highTone.start(startAt);
    lowTone.stop(stopAt);
    highTone.stop(stopAt);

    const cleanupTimerId = setTimeout(() => {
      lowTone.disconnect();
      highTone.disconnect();
      gain.disconnect();
      ringtoneNodesRef.current = ringtoneNodesRef.current.filter((nodes) => nodes !== activeNodes);
    }, RINGTONE_BEEP_MS + 80);
    const nextPulseTimerId = setTimeout(() => {
      playRingtonePulseRef.current?.();
    }, RINGTONE_LOOP_MS);

    ringtoneTimersRef.current.push(cleanupTimerId, nextPulseTimerId);
  }, [getRingtoneAudioContext]);

  useEffect(() => {
    playRingtonePulseRef.current = playRingtonePulse;
  }, [playRingtonePulse]);

  const startRingtone = useCallback(() => {
    if (ringtonePlayingRef.current) return;

    ringtonePlayingRef.current = true;
    void unlockRingtoneAudio().then((canPlay) => {
      if (!ringtonePlayingRef.current) return;

      if (!canPlay) {
        stopRingtone();
        return;
      }

      playRingtonePulse();
    });
  }, [playRingtonePulse, stopRingtone, unlockRingtoneAudio]);

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
      const pc = new RTCPeerConnection(rtcConfig);

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
      stopRingtone();
      closePeerConnection();
      stopLocalMedia();
      setCallStateSnapshot(initialCallState);
      showCallNotice(notice);
    },
    [closePeerConnection, setCallStateSnapshot, showCallNotice, stopLocalMedia, stopRingtone],
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

    stopRingtone();
    socket.emit('call_accept', {
      callId: currentCall.callId,
    });
  }, [socket, stopRingtone]);

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
    };

    window.addEventListener('pointerdown', handleUserGesture, { passive: true });
    window.addEventListener('keydown', handleUserGesture);

    return () => {
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
    };
  }, [unlockRingtoneAudio]);

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
    socket,
    startRingtone,
    startLocalMedia,
  ]);

  useEffect(
    () => () => {
      clearTimeout(noticeTimerRef.current);
      stopRingtone();
      closePeerConnection();
      stopLocalMedia();
      const audioContext = ringtoneAudioContextRef.current;
      if (audioContext && audioContext.state !== 'closed') {
        void audioContext.close();
      }
      ringtoneAudioContextRef.current = null;
    },
    [closePeerConnection, stopLocalMedia, stopRingtone],
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
