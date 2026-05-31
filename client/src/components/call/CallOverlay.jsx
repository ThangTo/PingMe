import { useEffect, useRef } from 'react';
import { useCall } from '../../context/CallContext';

const CallOverlay = () => {
  const { callState, localStream, remoteStream, endCall, toggleMute, toggleVideo } = useCall();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (callState.status !== 'connected' && callState.status !== 'calling') return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center overflow-hidden">
      {/* Remote Video (Full Screen) */}
      <div className="absolute inset-0 w-full h-full">
        {callState.type === 'video' && remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-surface-container">
            <img
              src={callState.partner?.avatar || 'https://via.placeholder.com/150'}
              alt="Partner Avatar"
              className="w-40 h-40 rounded-full border-4 border-white/10 shadow-2xl mb-6"
            />
            <h2 className="text-3xl text-white font-bold">{callState.partner?.name || 'Người gọi'}</h2>
            <p className="text-white/60 mt-2">
              {callState.status === 'calling' ? 'Đang gọi...' : 'Đang kết nối...'}
            </p>
          </div>
        )}
      </div>

      {/* Local Video (PIP) */}
      {callState.type === 'video' && (
        <div className="absolute bottom-28 right-8 w-40 h-60 bg-gray-900 rounded-2xl overflow-hidden border-2 border-white/20 shadow-lg z-10">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/40 backdrop-blur-md px-8 py-4 rounded-full">
        <button
          onClick={toggleMute}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            callState.isMuted ? 'bg-error text-white' : 'bg-white/20 text-white hover:bg-white/30'
          }`}
        >
          <span className="material-symbols-outlined">
            {callState.isMuted ? 'mic_off' : 'mic'}
          </span>
        </button>

        {callState.type === 'video' && (
          <button
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              callState.isVideoOff ? 'bg-error text-white' : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            <span className="material-symbols-outlined">
              {callState.isVideoOff ? 'videocam_off' : 'videocam'}
            </span>
          </button>
        )}

        <button
          onClick={endCall}
          className="w-14 h-14 rounded-full bg-error hover:bg-error/80 flex items-center justify-center text-white shadow-lg transition-colors"
        >
          <span className="material-symbols-outlined text-2xl">call_end</span>
        </button>
      </div>
    </div>
  );
};

export default CallOverlay;
