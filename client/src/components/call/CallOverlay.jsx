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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#111111]">
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
          <div className="flex h-full w-full flex-col items-center justify-center bg-[#111111]">
            <img
              src={callState.partner?.avatar || 'https://via.placeholder.com/150'}
              alt="Partner Avatar"
              className="mb-6 h-40 w-40 rounded-xl border border-white/15 object-cover"
            />
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-white">{callState.partner?.name || 'Người gọi'}</h2>
            <p className="mt-2 text-white/60">
              {callState.status === 'calling' ? 'Đang gọi...' : 'Đang kết nối...'}
            </p>
          </div>
        )}
      </div>

      {/* Local Video (PIP) */}
      {callState.type === 'video' && (
        <div className="absolute bottom-28 right-8 z-10 h-60 w-40 overflow-hidden rounded-xl border border-white/20 bg-[#111111]">
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
      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-md">
        <button
          onClick={toggleMute}
          className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
            callState.isMuted ? 'bg-error text-white' : 'bg-white/15 text-white hover:bg-white/25'
          }`}
        >
          <span className="material-symbols-outlined">
            {callState.isMuted ? 'mic_off' : 'mic'}
          </span>
        </button>

        {callState.type === 'video' && (
          <button
            onClick={toggleVideo}
              className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
                callState.isVideoOff ? 'bg-error text-white' : 'bg-white/15 text-white hover:bg-white/25'
            }`}
          >
            <span className="material-symbols-outlined">
              {callState.isVideoOff ? 'videocam_off' : 'videocam'}
            </span>
          </button>
        )}

        <button
          onClick={endCall}
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-error text-white transition-colors hover:bg-error/90"
        >
          <span className="material-symbols-outlined text-2xl">call_end</span>
        </button>
      </div>
    </div>
  );
};

export default CallOverlay;
