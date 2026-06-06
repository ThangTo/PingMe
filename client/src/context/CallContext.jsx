/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const CallContext = createContext(null);

const initialCallState = {
  status: 'idle', // 'idle' | 'calling' | 'ringing' | 'connected'
  callId: null,
  type: null, // 'voice' | 'video'
  conversationId: null,
  partner: null, // { id, name, avatar }
  isMuted: false,
  isVideoOff: false,
};

const callNoticeText = {
  rejected: 'Cuộc gọi đã bị từ chối.',
  ended: 'Cuộc gọi đã kết thúc.',
  missed: 'Cuộc gọi không có phản hồi.',
  disconnected: 'Người kia đã mất kết nối.',
  offline: 'Người này hiện không online.',
  user_busy: 'Người này đang bận.',
  self_busy: 'Bạn đang ở trong một cuộc gọi khác.',
  failed: 'Không thể bắt đầu cuộc gọi.',
};

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
  const noticeTimerRef = useRef(null);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const showCallNotice = useCallback((message) => {
    if (!message) return;

    clearTimeout(noticeTimerRef.current);
    setCallNotice(message);
    noticeTimerRef.current = setTimeout(() => setCallNotice(''), 2600);
  }, []);

  const closePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  }, []);

  const stopLocalMedia = useCallback(() => {
    setLocalStream((stream) => {
      stream?.getTracks?.().forEach((track) => track.stop());
      return null;
    });
    setRemoteStream(null);
  }, []);

  const resetCall = useCallback(
    (notice) => {
      closePeerConnection();
      stopLocalMedia();
      setCallState(initialCallState);
      showCallNotice(notice);
    },
    [closePeerConnection, showCallNotice, stopLocalMedia],
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

      setCallState({
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
    [showCallNotice, socket, user?.id],
  );

  const acceptCall = useCallback(() => {
    const currentCall = callStateRef.current;
    if (currentCall.status !== 'ringing' || !currentCall.callId) return;

    socket.emit('call_accept', {
      callId: currentCall.callId,
    });
  }, [socket]);

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
    setCallState((prev) => {
      const nextMuted = !prev.isMuted;
      localStream?.getAudioTracks?.().forEach((track) => {
        track.enabled = !nextMuted;
      });
      return { ...prev, isMuted: nextMuted };
    });
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    setCallState((prev) => {
      const nextVideoOff = !prev.isVideoOff;
      localStream?.getVideoTracks?.().forEach((track) => {
        track.enabled = !nextVideoOff;
      });
      return { ...prev, isVideoOff: nextVideoOff };
    });
  }, [localStream]);

  useEffect(() => {
    if (!socket) return undefined;

    const isCurrentCall = (payload = {}) => {
      const currentCall = callStateRef.current;
      return !payload.callId || !currentCall.callId || payload.callId === currentCall.callId;
    };

    const handleCallRinging = (payload) => {
      setCallState((prev) => {
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

      setCallState({
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
    };

    const handleCallAccepted = (payload) => {
      if (!isCurrentCall(payload)) return;

      setCallState((prev) => ({
        ...prev,
        status: 'connected',
        callId: payload.callId || prev.callId,
        type: payload.type || prev.type,
        conversationId: payload.conversationId || prev.conversationId,
        partner: payload.partner || prev.partner,
      }));
    };

    const handleCallConnected = (payload) => {
      if (!isCurrentCall(payload)) return;

      setCallState((prev) => ({
        ...prev,
        status: 'connected',
        callId: payload.callId || prev.callId,
        type: payload.type || prev.type,
        conversationId: payload.conversationId || prev.conversationId,
        partner: payload.partner || prev.partner,
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
    };
  }, [getNoticeFromPayload, resetCall, socket]);

  useEffect(
    () => () => {
      clearTimeout(noticeTimerRef.current);
      closePeerConnection();
      stopLocalMedia();
    },
    [closePeerConnection, stopLocalMedia],
  );

  return (
    <CallContext.Provider
      value={{
        callState,
        setCallState,
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
