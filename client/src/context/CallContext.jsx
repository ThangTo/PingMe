/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const CallContext = createContext(null);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within CallProvider');
  return context;
};

export const CallProvider = ({ children }) => {
  const { socket: _socket } = useSocket();
  const { user: _user } = useAuth();

  // Trạng thái cuộc gọi
  const [callState, setCallState] = useState({
    status: 'idle', // 'idle' | 'calling' | 'ringing' | 'connected'
    type: null, // 'voice' | 'video'
    partner: null, // { id, name, avatar } - Người đang gọi/nghe
    isMuted: false,
    isVideoOff: false,
  });

  const [localStream, _setLocalStream] = useState(null);
  const [remoteStream, _setRemoteStream] = useState(null);

  // Lưu trữ PeerConnection
  const _peerConnectionRef = useRef(null);

  // TODO (Dành cho bạn): Khởi tạo các hàm xử lý WebRTC và Socket events ở đây

  const initiateCall = (partnerId, type, partnerInfo) => {
    // TODO: Bắt đầu cuộc gọi, lấy luồng media, và emit 'call_request'
    console.log('Initiating call to', partnerId, type, partnerInfo);
  };

  const acceptCall = () => {
    // TODO: Chấp nhận cuộc gọi, tạo RTCPeerConnection và emit 'call_accepted'
    console.log('Accepting call');
  };

  const rejectCall = () => {
    // TODO: Từ chối cuộc gọi, emit 'call_rejected'
    console.log('Rejecting call');
  };

  const endCall = () => {
    // TODO: Kết thúc cuộc gọi, đóng luồng và emit 'call_ended'
    console.log('Ending call');
  };

  const toggleMute = () => {
    // TODO: Tắt/mở micro
  };

  const toggleVideo = () => {
    // TODO: Tắt/mở camera
  };

  return (
    <CallContext.Provider
      value={{
        callState,
        setCallState,
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
